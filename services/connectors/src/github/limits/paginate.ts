import type { Octokit } from "@octokit/rest";
import { pageLimit } from "../../shared/limits.js";

type Page<T> = { data: T[]; headers: { link?: string } };
/** Any Octokit list endpoint, such as `octokit.rest.repos.listTeams`, seen as "params in, one page out". */
type Route<P, T> = (params: P) => Promise<{ data: T[] }>;

/**
 * Like `octokit.paginate`, but fetches at most `maxPages` pages, using Octokit's own page iterator (it follows the Link header).
 * If a `next` page still exists after the cap, the result would be incomplete, so it throws PAGE_LIMIT instead of returning part of it.
 */
export const paginateCapped = async <P, T>(octokit: Octokit, what: string, maxPages: number, route: Route<P, T>, params: P): Promise<T[]> => {
  const items: T[] = [];
  let pages = 0;
  // The iterator is typed for Octokit's own endpoint objects; the cast only narrows it to the shape of a page that we use.
  for await (const page of octokit.paginate.iterator(route as never, params as never) as AsyncIterable<Page<T>>) {
    items.push(...page.data);
    pages += 1;
    if (pages < maxPages) continue;
    if (/rel="next"/.test(page.headers.link ?? "")) throw pageLimit(what, maxPages);
    break;
  }
  return items;
};
