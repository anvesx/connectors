import { afterEach, describe, expect, it } from "vitest";
import { createGithubConnector } from "../../../src/index.js";
import { fixture, type Replay, type Route, startReplay } from "../../../src/testing/replay.js";

const R = "/repos/acme/handbook";
let replay: Replay;
afterEach(() => replay.close());

const at = (path: string) => replay.seen.filter((r) => decodeURIComponent(r.path.split("?")[0] ?? "") === path).length;
const connector = (maxPages: number) => createGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: "t", baseUrl: replay.url, maxPages });
/** `Link: rel="next"` pointing at this same endpoint, so the server never runs out of pages. */
const next = (path: string) => ({ link: `<${replay.url}${path}?page=2>; rel="next"` });
const base: Record<string, Route> = {
  [R]: { status: 200, body: fixture("github/repo") },
  [`${R}/git/trees/main`]: { status: 200, body: fixture("github/tree") },
  [`${R}/teams`]: { status: 404, body: { message: "Not Found" } },
};

describe("github paging caps", () => {
  it("stops listing collaborators at maxPages and raises PAGE_LIMIT", async () => {
    replay = await startReplay({ ...base, [`${R}/collaborators`]: () => ({ status: 200, headers: next(`${R}/collaborators`), body: [{ login: "ada" }] }) });
    await expect(connector(3).list({ limit: 10 })).rejects.toMatchObject({ code: "PAGE_LIMIT" });
    expect(at(`${R}/collaborators`)).toBe(3);
  });

  it("returns everything when the last page arrives within maxPages", async () => {
    const page = (url: URL) =>
      url.searchParams.get("page") === "2"
        ? { status: 200, body: [{ login: "bob" }] }
        : { status: 200, headers: next(`${R}/collaborators`), body: [{ login: "ada" }] };
    replay = await startReplay({ ...base, [`${R}/collaborators`]: page });
    const { items } = await connector(2).list({ limit: 10 });
    expect(items[0]?.acl.allowUsers).toEqual(["ada", "bob"]);
    expect(at(`${R}/collaborators`)).toBe(2);
  });
});
