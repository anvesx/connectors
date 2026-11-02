import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDriveConnector } from "../../src/index.js";
import { fixture, type Replay, startReplay } from "../support/replay.js";

const F = "/drive/v3/files";
let replay: Replay;
let drive: ReturnType<typeof createDriveConnector>;

beforeAll(async () => {
  replay = await startReplay({
    [`${F}/open`]: { status: 200, body: { id: "open" } },
    [`${F}/locked`]: { status: 403, body: fixture("drive/error-403") },
    [`${F}/gone`]: { status: 404, body: { error: { code: 404, message: "File not found: gone." } } },
    [`${F}/broken`]: { status: 500, body: { error: { code: 500, message: "boom" } } },
  });
  drive = createDriveConnector({ id: "gd", listToken: "index", rootUrl: replay.url });
});
afterAll(() => replay.close());

describe("drive canRead with the asker's own token", () => {
  it("is true when the file answers 200 for that token", async () => {
    expect(await drive.canRead?.("open", { token: "alice" })).toBe(true);
    expect(replay.seen.at(-1)?.authorization).toBe("Bearer alice");
  });
  it("is false on 403 and 404, the two ways Drive hides a file", async () => {
    expect(await drive.canRead?.("locked", { token: "bob" })).toBe(false);
    expect(await drive.canRead?.("gone", { token: "bob" })).toBe(false);
  });
  it("throws on a server error instead of guessing", async () => {
    await expect(drive.canRead?.("broken", { token: "bob" })).rejects.toThrow();
  });
});
