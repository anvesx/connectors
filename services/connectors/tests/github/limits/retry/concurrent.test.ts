import { setTimeout as sleep } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import { createClient } from "../../../../src/github/limits/octokit.js";
import { paginateCapped } from "../../../../src/github/limits/paginate.js";
import { type Replay, type Reply, startReplay } from "../../../../src/testing/replay.js";

let replay: Replay;
afterEach(() => replay.close());

const limited: Reply = { status: 429, headers: { "retry-after": "1" }, body: { message: "Too Many Requests" } };
const ok: Reply = { status: 200, body: [] };
// A route that answers `failures` 429s, then 200. Each route has its own counter, so every path is its own request stream.
const flaky = (failures: number) => {
  let n = 0;
  return () => (n++ < failures ? limited : ok);
};
const calls = (path: string) => replay.seen.filter((r) => r.path.split("?")[0] === path).length;
const client = (maxRetries = 3) => createClient("t", replay.url, { maxRetries, msPerSecond: 20 });

describe("github retry budget is per request, not per client", () => {
  it("three concurrent requests, each 429 x3 then 200, all succeed with 4 calls each", async () => {
    // 3 failures use the whole maxRetries 3; the 4th call succeeds. A client-wide counter gave the three requests 2 + 1 + 1 calls.
    replay = await startReplay({ "/r/1": flaky(3), "/r/2": flaky(3), "/r/3": flaky(3) });
    const o = client();
    const results = await Promise.all([1, 2, 3].map((i) => o.request(`GET /r/${i}`)));
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect([1, 2, 3].map((i) => calls(`/r/${i}`))).toEqual([4, 4, 4]);
  });

  it("two paginated walks at once (as list() does), each 429 x2 then 200, make 3 calls each", async () => {
    replay = await startReplay({ "/repos/acme/handbook/collaborators": flaky(2), "/repos/acme/handbook/teams": flaky(2) });
    const o = client();
    const target = { owner: "acme", repo: "handbook", per_page: 100 };
    const [people, teams] = await Promise.all([
      paginateCapped(o, "collaborators", 5, o.rest.repos.listCollaborators, target),
      paginateCapped(o, "teams", 5, o.rest.repos.listTeams, target),
    ]);
    expect([people, teams]).toEqual([[], []]);
    expect(calls("/repos/acme/handbook/collaborators")).toBe(3); // 2 failures + 1 success
    expect(calls("/repos/acme/handbook/teams")).toBe(3);
  });

  it("a request that always gets 429 makes maxRetries + 1 = 4 calls even while other requests succeed", async () => {
    // Before: every other request reset the shared counter, so the failing one kept going (8 calls with 6 others).
    replay = await startReplay({ "/a": { ...limited }, "/b": ok });
    const o = client();
    const forever = o.request("GET /a").catch((e: unknown) => e);
    for (let i = 0; i < 6; i++) {
      await o.request("GET /b");
      await sleep(10); // spread the 6 requests across the 3 sleeps (20 ms each) of the failing one
    }
    expect(await forever).toMatchObject({ status: 429 });
    expect(calls("/a")).toBe(4);
    expect(calls("/b")).toBe(6);
  });
});
