import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGithubConnector } from "../../src/index.js";
import { fixture, type Replay, startReplay } from "../support/replay.js";

const R = "/repos/acme/handbook";
let replay: Replay;
const make = (token = "index") => createGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: token, baseUrl: replay.url });

beforeAll(async () => {
  replay = await startReplay({
    [R]: () => ({ status: 200, body: fixture("github/repo") }),
  });
});
afterAll(() => replay.close());

describe("github canRead with the asker's own token", () => {
  it("is true when the repo answers 200 for that token", async () => {
    expect(await make().canRead?.("README.md", { token: "alice" })).toBe(true);
    expect(replay.seen.at(-1)?.authorization).toBe("token alice");
  });

  it("is false on 404 and 403, the two ways GitHub hides a repo", async () => {
    for (const status of [404, 403]) {
      const r = await startReplay({ [R]: { status, body: { message: "x" } } });
      const c = createGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: "i", baseUrl: r.url });
      expect(await c.canRead?.("README.md", { token: "bob" })).toBe(false);
      await r.close();
    }
  });

  it("throws on a server error instead of guessing", async () => {
    const r = await startReplay({ [R]: { status: 500, body: { message: "boom" } } });
    const c = createGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: "i", baseUrl: r.url });
    await expect(c.canRead?.("README.md", { token: "bob" })).rejects.toThrow();
    await r.close();
  });
});
