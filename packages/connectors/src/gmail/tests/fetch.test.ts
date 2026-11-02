import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Replay } from "../../shared/tests/replay.js";
import { gmailFor, startGmail } from "./server.js";

let replay: Replay;
let gmail: ReturnType<typeof gmailFor>;
beforeAll(async () => {
  replay = await startGmail();
  gmail = gmailFor(replay);
});
afterAll(() => replay.close());

describe("gmail fetch and canRead with the asker's own token", () => {
  it("decodes the text/plain part under its subject and sender", async () => {
    const got = await gmail.fetch("m1", { token: "ya29-alice" });
    expect(got).toEqual({ text: "Subject: Expense policy\nFrom: bob@acme.test\n\nReimbursements are paid within 10 days.\n", version: "4100" });
    expect(replay.seen.at(-1)?.authorization).toBe("Bearer ya29-alice");
  });

  it("maps 404 to NOT_FOUND, 403 to FORBIDDEN, and a message with no plain text to NOT_FOUND", async () => {
    await expect(gmail.fetch("gone", { token: "t" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(gmail.fetch("locked", { token: "t" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(gmail.fetch("m2", { token: "t" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("canRead is true on 200 and false on 403 and 404", async () => {
    expect(await gmail.canRead?.("m1", { token: "ya29-alice" })).toBe(true);
    expect(replay.seen.at(-1)?.authorization).toBe("Bearer ya29-alice");
    expect(await gmail.canRead?.("locked", { token: "t" })).toBe(false);
    expect(await gmail.canRead?.("gone", { token: "t" })).toBe(false);
  });

  it("canRead throws on a server error instead of guessing", async () => {
    await expect(gmail.canRead?.("boom", { token: "t" })).rejects.toThrow();
  });
});
