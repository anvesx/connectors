import type { Octokit } from "@octokit/rest";
import { badCursor, statusOf } from "../shared/errors.js";
import type { ChangeSet } from "../shared/types.js";
import { type CompareFile, mapChanges } from "./map.js";

const PAGE = 100;
const MAX_PAGES = 30;

type Repo = { owner: string; repo: string };

export const headSha = async (octokit: Octokit, target: Repo): Promise<string> => {
  const { data } = await octokit.rest.repos.get(target);
  return (await octokit.rest.repos.getBranch({ ...target, branch: data.default_branch })).data.commit.sha;
};

/** Cursor is a commit SHA: events are the files changed between it and the current default-branch head. */
export const changesSince = async (octokit: Octokit, target: Repo, cursor: string | undefined): Promise<ChangeSet> => {
  const head = await headSha(octokit, target);
  if (cursor === undefined) return { events: [], next: head };
  if (cursor === head) return { events: [], next: head };
  const files: CompareFile[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data } = await octokit.rest.repos.compareCommitsWithBasehead({ ...target, basehead: `${cursor}...${head}`, per_page: PAGE, page });
      files.push(...(data.files ?? []));
      if ((data.files ?? []).length < PAGE) break;
    }
  } catch (error) {
    if (statusOf(error) === 404 || statusOf(error) === 422) throw badCursor();
    throw error;
  }
  return { events: mapChanges(files), next: head };
};
