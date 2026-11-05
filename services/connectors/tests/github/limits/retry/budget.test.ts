import { afterEach, describe, expect, it } from "vitest";
import { buildGithubConnector } from "../../../../src/github/connector.js";
import { fixture, type Replay, type Reply, startReplay } from "../../../../src/testing/replay.js";

const FILE = "/repos/acme/handbook/contents/docs/guide.md";
let replay: Replay;
afterEach(() => replay.close());

const down: Reply = { status: 503, body: { message: "down" } };
const limited: Reply = { status: 429, headers: { "retry-after": "0" }, body: { message: "Too Many Requests" } };
const run = async (replies: Reply[], maxRetries: number) => {
  let n = 0;
  replay = await startReplay({ [FILE]: () => replies[n++] ?? { status: 200, body: fixture("github/content") } });
  const github = buildGithubConnector({ id: "gh", owner: "acme", repo: "handbook", listToken: "t", baseUrl: replay.url, maxRetries }, { msPerSecond: 1 });
  return github.fetch("docs/guide.md", { token: "u" }).catch((e: unknown) => e);
};

describe("github maxRetries is one budget shared by 5xx and 429", () => {
  it("alternating 503 and 429 with maxRetries 3 makes 4 calls (1 try + 3 retries), not 8", async () => {
    // 503, 429, 503, 429: the 4th call is the last the budget allows, so the 429 it returns is final.
    const error = await run([down, limited, down, limited, down, limited, down, limited], 3);
    expect(error).toMatchObject({ code: "RATE_LIMITED" });
    expect(replay.seen.length).toBe(4);
  });

  it("429 first then 503 also stops at 4 calls", async () => {
    expect(await run([limited, down, limited, down, limited, down], 3)).toMatchObject({ status: 503 });
    expect(replay.seen.length).toBe(4);
  });

  it("three failures then success is still inside the budget: 4 calls and the file comes back", async () => {
    // 429, 503, 429 use 3 retries' worth of failures; the 4th call succeeds.
    const result = await run([limited, down, limited], 3);
    expect(result).toMatchObject({ text: expect.stringContaining("Guide") });
    expect(replay.seen.length).toBe(4);
  });

  it("503s alone stop at maxRetries 2 + 1 = 3 calls", async () => {
    await run([down, down, down, down, down], 2);
    expect(replay.seen.length).toBe(3);
  });
});
