import type { Membership } from "@brain/connector-kit";
import type { Octokit } from "@octokit/rest";
import { statusOf } from "../shared/errors.js";

/** One `owner/slug` group per team with repo access, one pair per member. A team whose members cannot be read fails the whole listing. */
export const listTeamMembers = async (octokit: Octokit, target: { owner: string; repo: string }): Promise<Membership[]> => {
  const teams = await octokit.paginate(octokit.rest.repos.listTeams, { ...target, per_page: 100 }).catch((e: unknown) => {
    if (statusOf(e) === 404) return [];
    throw e;
  });
  const out: Membership[] = [];
  for (const { slug } of teams) {
    const members = await octokit.paginate(octokit.rest.teams.listMembersInOrg, { org: target.owner, team_slug: slug, per_page: 100 });
    for (const m of members) out.push({ group: `${target.owner}/${slug}`, user: m.login });
  }
  return out;
};
