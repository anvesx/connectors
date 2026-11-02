import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGithubConnector } from "../../src/index.js";
import { fixture, type Replay, startReplay } from "../support/replay.js";

const R = "/repos/acme/handbook";
let replay: Replay;
const connector = () => createGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: "index-token", baseUrl: replay.url });

beforeAll(async () => {
  replay = await startReplay({
    [`${R}/teams`]: { status: 200, body: fixture("github/teams") },
    "/orgs/acme/teams/justice-league/members": { status: 200, body: fixture("github-members/justice-league") },
    "/orgs/acme/teams/docs/members": { status: 200, body: fixture("github-members/docs") },
  });
});
afterAll(() => replay.close());

describe("github team memberships over the vendor SDK", () => {
  it("lists one pair per member of each team that can read the repo", async () => {
    const pairs = await connector().listMemberships?.();
    expect(pairs).toEqual([
      { group: "acme/justice-league", user: "octocat" },
      { group: "acme/justice-league", user: "hubot" },
      { group: "acme/docs", user: "octocat" },
    ]);
    expect(replay.seen.every((s) => s.authorization === "token index-token")).toBe(true);
  });

  it("returns nothing for a personal repo whose teams endpoint is 404", async () => {
    const empty = await startReplay({});
    const solo = createGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: "t", baseUrl: empty.url });
    expect(await solo.listMemberships?.()).toEqual([]);
    await empty.close();
  });

  it("fails the whole listing when a team's members cannot be read, so a partial list never prunes edges", async () => {
    const denied = await startReplay({ [`${R}/teams`]: { status: 200, body: fixture("github/teams") } });
    const c = createGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: "t", baseUrl: denied.url });
    await expect(c.listMemberships?.()).rejects.toMatchObject({ code: "NOT_FOUND" });
    await denied.close();
  });
});
