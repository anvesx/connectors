import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGithubConnector } from "../../src/index.js";
import { fixture, type Replay, startReplay } from "../support/replay.js";

const TREE = "9fb037999f264ba9281fc6cbd2d9dff8d1c1d5b1";
const HEAD = "c5b97d5ae6c19d5c5df71a34c7fbeeda2479ccbc";
const BASE = "1111111111111111111111111111111111111111";
const R = "/repos/acme/handbook";
let replay: Replay;
let github: ReturnType<typeof createGithubConnector>;

beforeAll(async () => {
  replay = await startReplay({
    [R]: { status: 200, body: fixture("github/repo") },
    [`${R}/git/trees/main`]: { status: 200, body: fixture("github/tree") },
    [`${R}/git/trees/${TREE}`]: { status: 200, body: fixture("github/tree") },
    [`${R}/collaborators`]: { status: 200, body: fixture("github/collaborators") },
    [`${R}/teams`]: { status: 404, body: { message: "Not Found" } },
    [`${R}/contents/docs/guide.md`]: { status: 200, body: fixture("github/content") },
    [`${R}/contents/secret.md`]: { status: 403, body: { message: "Forbidden" } },
    [`${R}/branches/main`]: { status: 200, body: fixture("github-changes/branch") },
    [`${R}/compare/${BASE}...${HEAD}`]: { status: 200, body: fixture("github-changes/compare") },
  });
  github = createGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: "index-token", baseUrl: replay.url });
});
afterAll(() => replay.close());

describe("github connector over the vendor SDK", () => {
  it("declares that it enforces the user token", () => expect(github.enforcesUserToken).toBe(true));

  it("pages documents with ACLs and a resumable cursor", async () => {
    const first = await github.list({ limit: 1 });
    expect(first.items.map((d) => d.address)).toEqual(["README.md"]);
    expect(first.items[0]!.acl.allowUsers).toEqual(["hubot", "octocat"]);
    expect(first.nextCursor).toBe(`${TREE}:1`);
    const second = await github.list({ limit: 1, cursor: first.nextCursor! });
    expect(second.items.map((d) => d.address)).toEqual(["docs/guide.md"]);
    expect(second.nextCursor).toBeUndefined();
    expect(replay.seen.at(-1)?.authorization).toBeDefined();
  });

  it("rejects malformed and out-of-range cursors", async () => {
    await expect(github.list({ limit: 5, cursor: "nope" })).rejects.toMatchObject({ code: "BAD_CURSOR" });
    await expect(github.list({ limit: 5, cursor: `${TREE}:9` })).rejects.toMatchObject({ code: "BAD_CURSOR" });
    await expect(github.list({ limit: 0 })).rejects.toThrow(RangeError);
  });

  it("fetches text with the caller's own token and maps 404 and 403", async () => {
    const got = await github.fetch("docs/guide.md", { token: "alice-token" });
    expect(got).toEqual({ text: "# Guide\n\nReimbursement is paid within 10 days.\n", version: "3d21ec53a331a6f037a91c368710b99387d012c1" });
    expect(replay.seen.at(-1)?.authorization).toBe("token alice-token");
    await expect(github.fetch("missing.md", { token: "t" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(github.fetch("secret.md", { token: "t" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reports a baseline, then changes since a cursor", async () => {
    expect(await github.changes({ token: "t" })).toEqual({ events: [], next: HEAD });
    expect(await github.changes({ token: "t", cursor: HEAD })).toEqual({ events: [], next: HEAD });
    const since = await github.changes({ token: "t", cursor: BASE });
    expect(since.next).toBe(HEAD);
    expect(since.events).toHaveLength(5);
    await expect(github.changes({ token: "t", cursor: "2".repeat(40) })).rejects.toMatchObject({ code: "BAD_CURSOR" });
  });
});
