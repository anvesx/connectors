import { afterEach, describe, expect, it } from "vitest";
import { createGithubConnector } from "../../../src/index.js";
import { fixture, type Replay, startReplay } from "../../../src/testing/replay.js";

const R = "/repos/acme/handbook";
const HEAD = "c5b97d5ae6c19d5c5df71a34c7fbeeda2479ccbc";
const BASE = "1111111111111111111111111111111111111111";
const COMPARE = `${R}/compare/${BASE}...${HEAD}`;
let replay: Replay;
afterEach(() => replay.close());

/** GitHub's compare lists files on page 1 only, up to 300 for the whole comparison (later pages carry commits, never files). */
const start = async (count: number) => {
  const files = Array.from({ length: count }, (_, i) => ({ filename: `f${i}.md`, status: "modified" }));
  replay = await startReplay({
    [R]: { status: 200, body: fixture("github/repo") },
    [`${R}/branches/main`]: { status: 200, body: fixture("github-changes/branch") },
    [COMPARE]: (url) => ({ status: 200, body: { files: url.searchParams.get("page") === null || url.searchParams.get("page") === "1" ? files : [] } }),
  });
  return createGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: "t", baseUrl: replay.url });
};
const compares = () => replay.seen.filter((r) => decodeURIComponent(r.path).startsWith(COMPARE));

describe("github compare is read once, from page 1", () => {
  it("returns every file below the 300-file cap with a single small request", async () => {
    const set = await (await start(299)).changes({ token: "t", cursor: BASE });
    expect(set.events).toHaveLength(299);
    expect(set.next).toBe(HEAD);
    expect(compares()).toHaveLength(1);
    expect(compares()[0]?.path).toMatch(/per_page=1(&|$)/);
    expect(compares()[0]?.path).not.toContain("page=2");
  });

  it("raises PAGE_LIMIT at 300 files, where GitHub stops listing them", async () => {
    const github = await start(300);
    await expect(github.changes({ token: "t", cursor: BASE })).rejects.toMatchObject({ code: "PAGE_LIMIT", message: expect.stringContaining("300") });
    expect(compares()).toHaveLength(1);
  });

  it("does not fetch a second page when the first one is exactly 100 files", async () => {
    const set = await (await start(100)).changes({ token: "t", cursor: BASE });
    expect(set.events).toHaveLength(100);
    expect(compares()).toHaveLength(1);
  });
});
