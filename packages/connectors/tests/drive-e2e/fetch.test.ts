import { afterEach, describe, expect, it } from "vitest";
import { boot } from "./seed.js";

let h: Awaited<ReturnType<typeof boot>>;
afterEach(() => h.server.close());

describe("drive fetch with the caller's own token", () => {
  it("exports a Google Doc as plain text and reads a text file with alt=media", async () => {
    h = await boot();
    expect(await h.drive.fetch("doc1", { token: "alice" })).toEqual({ text: "Leave policy text", version: "42" });
    expect(h.server.seen.some((r) => r.path.startsWith("/drive/v3/files/doc1/export"))).toBe(true);
    expect(h.server.seen.at(-1)?.authorization).toBe("Bearer alice");
    expect(await h.drive.fetch("txt1", { token: "bob" })).toEqual({ text: "plain notes", version: "7" });
    expect(h.server.seen.at(-1)?.path).toContain("alt=media");
    expect(h.server.seen.at(-1)?.authorization).toBe("Bearer bob");
  });

  it("maps 404 and 403, and refuses a file that is not text", async () => {
    h = await boot();
    await expect(h.drive.fetch("nope", { token: "t" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(h.drive.fetch("doc2", { token: "alice" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(h.drive.fetch("img1", { token: "t" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lets a permitted reader in, and surfaces a 500 as an error instead of a code", async () => {
    h = await boot();
    expect((await h.drive.fetch("doc2", { token: "bob" })).text).toBe("Roadmap text");
    const err = await h.drive.fetch("boom", { token: "t" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toMatchObject({ code: "NOT_FOUND" });
    expect(err).not.toMatchObject({ code: "FORBIDDEN" });
  });

  it("serves the permission list of a file", async () => {
    h = await boot();
    const r = await fetch(`${h.server.url}/drive/v3/files/doc1/permissions`, { headers: { authorization: "Bearer t" } });
    const body = (await r.json()) as { permissions: { emailAddress?: string }[] };
    expect(body.permissions[0]?.emailAddress).toBe("alice@acme.test");
    expect((await fetch(`${h.server.url}/drive/v3/files/doc1/permissions`)).status).toBe(401);
  });
});
