import { afterEach, describe, expect, it } from "vitest";
import { boot } from "./seed.js";

let h: Awaited<ReturnType<typeof boot>>;
afterEach(() => h.server.close());

describe("drive canRead with the asker's token", () => {
  it("is true on 200, false on 403 and 404, and throws on 500", async () => {
    h = await boot();
    expect(await h.drive.canRead?.("doc2", { token: "bob" })).toBe(true);
    expect(h.server.seen.at(-1)?.authorization).toBe("Bearer bob");
    expect(await h.drive.canRead?.("doc2", { token: "alice" })).toBe(false);
    expect(await h.drive.canRead?.("nope", { token: "alice" })).toBe(false);
    await expect(h.drive.canRead?.("boom", { token: "alice" })).rejects.toThrow();
  });

  it("treats a rejected token (401) as an error, not as no access", async () => {
    h = await boot({ tokens: ["good"] });
    await expect(h.drive.canRead?.("doc1", { token: "revoked" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
