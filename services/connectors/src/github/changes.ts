import type { Octokit } from "@octokit/rest";
import { badCursor, statusOf } from "../shared/errors.js";
import { UpstreamLimitError } from "../shared/limits.js";
import type { ChangeSet } from "../shared/types.js";
import { type CompareFile, mapChanges } from "./map.js";

/** GitHub's compare lists changed files on its first page only, up to 300 for the whole comparison (openapi-types `/repos/{owner}/{repo}/compare/{basehead}`). */
export const COMPARE_FILE_CAP = 300;

type Repo = { owner: string; repo: string };

export const headSha = async (octokit: Octokit, target: Repo): Promise<string> => {
  const { data } = await octokit.rest.repos.get(target);
  return (await octokit.rest.repos.getBranch({ ...target, branch: data.default_branch })).data.commit.sha;
};

/**
 * Cursor is a commit SHA: events are the files changed between it and the current default-branch head. Compare returns files only on
 * page 1 and at most 300 (later pages repeat commit info, never files), so one request is made, with `per_page: 1` to keep the commit list
 * small. Getting 300 files means the diff may be cut off, and a SHA cannot resume it, so that throws PAGE_LIMIT. It cannot tell exactly
 * 300 files from more than 300, so exactly 300 also throws.
 */
export const changesSince = async (octokit: Octokit, target: Repo, cursor: string | undefined): Promise<ChangeSet> => {
  const head = await headSha(octokit, target);
  if (cursor === undefined) return { events: [], next: head };
  if (cursor === head) return { events: [], next: head };
  let files: CompareFile[];
  try {
    const { data } = await octokit.rest.repos.compareCommitsWithBasehead({ ...target, basehead: `${cursor}...${head}`, per_page: 1 });
    files = data.files ?? [];
  } catch (error) {
    if (statusOf(error) === 404 || statusOf(error) === 422) throw badCursor();
    throw error;
  }
  if (files.length >= COMPARE_FILE_CAP)
    throw new UpstreamLimitError(
      "PAGE_LIMIT",
      `changes has ${COMPARE_FILE_CAP} or more changed files, the most GitHub's compare returns; sync from a nearer cursor`,
    );
  return { events: mapChanges(files), next: head };
};
