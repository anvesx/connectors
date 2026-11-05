import { WebClient } from "@slack/web-api";
import { DEFAULT_MAX_WAIT_SECONDS, pageCap, retryCap } from "../shared/limits.js";
import type { CommonConfig, SourceConnector } from "../shared/types.js";
import { changesSince } from "./changes/changes.js";
import { guardSlack, mapChannel, slackCode, TYPES, toText } from "./map.js";
import { listSlackMembers } from "./members/members.js";
import { rateLimitedFetch } from "./retry.js";

/**
 * `retries` is how often one request is retried (default 3, see `retry.ts`), 429s, 5xx and network failures together, so at most `retries + 1` HTTP calls;
 * a `Retry-After` above `maxWaitSeconds` fails at once. The SDK's own retries are switched off so they cannot multiply it. `maxPages` defaults to 100 pages of 200 = 20,000 items for each listing walk.
 */
export type SlackConfig = CommonConfig & { baseUrl?: string; retries?: number; now?: () => number };

/** The SDK's own default (`tenRetriesInAboutThirtyMinutes` in @slack/web-api/dist/retry-policies.js) is 10 retries over about 30 minutes: too long to block a sync. */
export const DEFAULT_RETRIES = 3;
export const DEFAULT_MAX_PAGES = 100;

/** Slack adapter: each channel is one document (its recent history); public channels read as the workspace group, private ones as their own. */
export const createSlackConnector = (config: SlackConfig): SourceConnector => {
  const maxPages = pageCap(config.maxPages, DEFAULT_MAX_PAGES);
  const retries = retryCap(config.retries, DEFAULT_RETRIES);
  const client = (token: string) =>
    new WebClient(token, {
      ...(config.baseUrl && { slackApiUrl: config.baseUrl }),
      retryConfig: { retries: 0 }, // retries live in rateLimitedFetch, one budget per request
      fetch: rateLimitedFetch(retries, config.maxWaitSeconds ?? DEFAULT_MAX_WAIT_SECONDS),
    });
  return {
    id: config.id,
    enforcesUserToken: true,
    async list({ cursor, limit }) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new RangeError("limit must be an integer from 1 to 1000");
      const page = await guardSlack("list", () =>
        client(config.listToken).conversations.list({ types: TYPES, exclude_archived: true, limit, ...(cursor !== undefined && { cursor }) }),
      );
      const items = (page.channels ?? []).flatMap((c) => (c.id ? [mapChannel({ ...c, id: c.id }, config.zone ?? "company")] : []));
      const nextCursor = page.response_metadata?.next_cursor;
      return nextCursor ? { items, nextCursor } : { items };
    },
    async fetch(address, { token }) {
      return guardSlack(address, async () => toText((await client(token).conversations.history({ channel: address, limit: 200 })).messages ?? []));
    },
    async canRead(address, { token }) {
      try {
        await client(token).conversations.info({ channel: address });
        return true;
      } catch (error) {
        const code = slackCode(error);
        if (code === "channel_not_found" || code === "not_in_channel") return false;
        return guardSlack(address, () => Promise.reject(error)); // maps a rate limit (and the rest) the way list and fetch do
      }
    },
    async listMemberships() {
      return guardSlack("memberships", () => listSlackMembers(client(config.listToken), maxPages));
    },
    async changes({ token, cursor }) {
      return guardSlack("changes", () => changesSince(client(token), cursor, config.now ?? Date.now, maxPages));
    },
  };
};
