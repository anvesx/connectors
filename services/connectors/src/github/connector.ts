import { ConnectorError } from "@anvesx/connector-kit";
import { badCursor, guarded, statusOf, toConnectorError } from "../shared/errors.js";
import { isRateLimited, pageCap, retryCap } from "../shared/limits.js";
import type { CommonConfig, SourceConnector } from "../shared/types.js";
import { changesSince } from "./changes.js";
import { createClient, DEFAULT_RETRIES, type InternalLimits, type LimitOptions } from "./limits/octokit.js";
import { paginateCapped } from "./limits/paginate.js";
import { isListable, mapAcl, mapDoc } from "./map.js";
import { listTeamMembers } from "./members/members.js";

/** `maxPages` defaults to 30 pages of 100 = 3000 items for each walk (collaborators, teams, team members). `changes` reads one compare page (300 files at most) and ignores it. */
export type GithubConfig = CommonConfig & LimitOptions & { owner: string; repo: string; baseUrl?: string };

export const DEFAULT_MAX_PAGES = 30;

/** GitHub repository adapter: documents are the repo's text blobs on the default branch, the ACL is repo-level. */
export const createGithubConnector = (config: GithubConfig): SourceConnector => buildGithubConnector(config);

/** The same adapter with test-only knobs (`msPerSecond`), kept off the public config and not exported from `index.ts`. */
export const buildGithubConnector = (config: GithubConfig, internal: InternalLimits = {}): SourceConnector => {
  const { owner, repo } = config;
  const target = { owner, repo };
  const maxPages = pageCap(config.maxPages, DEFAULT_MAX_PAGES);
  retryCap(config.maxRetries, DEFAULT_RETRIES); // reject a bad maxRetries when the connector is created, not on the first call
  const client = (token: string) => createClient(token, config.baseUrl, { ...config, ...internal });
  return {
    id: config.id,
    enforcesUserToken: true,
    async list({ cursor, limit }) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new RangeError("limit must be an integer from 1 to 1000");
      const match = cursor === undefined ? null : /^([0-9a-f]{40}):([1-9]\d*)$/.exec(cursor);
      if (cursor !== undefined && match === null) throw badCursor();
      const octokit = client(config.listToken);
      return guarded(`${owner}/${repo}`, async () => {
        const info = (await octokit.rest.repos.get(target)).data;
        const tree = (await octokit.rest.git.getTree({ ...target, tree_sha: match?.[1] ?? info.default_branch, recursive: "true" })).data;
        const docs = tree.tree.filter(isListable);
        const offset = Number(match?.[2] ?? 0);
        if (match !== null && offset >= docs.length) throw badCursor();
        const [collaborators, teams] = await Promise.all([
          paginateCapped(octokit, "collaborators", maxPages, octokit.rest.repos.listCollaborators, { ...target, per_page: 100 }),
          paginateCapped(octokit, "teams", maxPages, octokit.rest.repos.listTeams, { ...target, per_page: 100 }).catch((e: unknown) => {
            if (statusOf(e) === 404) return [];
            throw e;
          }),
        ]);
        const acl = mapAcl(collaborators, teams, owner, info.private);
        const items = docs.slice(offset, offset + limit).map((d) => mapDoc(d, acl, info.pushed_at ?? info.updated_at, config.zone ?? "team"));
        const next = offset + items.length;
        return next < docs.length ? { items, nextCursor: `${tree.sha}:${next}` } : { items };
      });
    },
    async listMemberships() {
      return guarded(`${owner}/${repo}`, () => listTeamMembers(client(config.listToken), target, maxPages));
    },
    async canRead(_address, { token }) {
      try {
        await client(token).rest.repos.get(target);
        return true;
      } catch (e) {
        if (!isRateLimited(e) && (statusOf(e) === 404 || statusOf(e) === 403)) return false;
        throw toConnectorError(e, "canRead");
      }
    },
    async fetch(address, { token, signal }) {
      const octokit = client(token);
      const request = signal ? { signal } : {};
      return guarded(address, async () => {
        const { data } = await octokit.rest.repos.getContent({ ...target, path: address, request });
        if (Array.isArray(data) || data.type !== "file") throw new ConnectorError("NOT_FOUND", `Not a file: ${address}`);
        const content = data.encoding === "base64" ? data.content : (await octokit.rest.git.getBlob({ ...target, file_sha: data.sha, request })).data.content;
        return { text: Buffer.from(content, "base64").toString("utf8"), version: data.sha };
      });
    },
    async changes({ token, cursor }) {
      return guarded(`${owner}/${repo}`, () => changesSince(client(token), target, cursor));
    },
  };
};
