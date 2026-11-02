import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { type CustomSpec, customManifest } from "../../src/catalog/http.js";

const acl = { allowUsers: ["u"], allowGroups: [], version: 1 };
const doc = { address: "a", title: "T", version: "v", updatedAt: "2026-01-01T00:00:00Z", acl };
let server: Server;
let seen: { path: string; type: string | undefined; auth: string | undefined }[] = [];
const serve = async (code: number, body: unknown, slashes = "") => {
  seen = [];
  server = createServer((req, res) => {
    seen.push({ path: req.url ?? "", type: req.headers["content-type"], auth: req.headers.authorization });
    res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(body));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const spec: CustomSpec = {
    id: "w",
    name: "W",
    auth: { kind: "token" },
    defaultZone: "team",
    endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}${slashes}`,
    canRead: false,
  };
  return customManifest(spec).load({ id: "w:1", listToken: "L" });
};
afterEach(() => server?.close());

describe("customManifest edges", () => {
  it("strips every trailing slash, posts JSON with a bearer, and enforces the user token", async () => {
    const c = await serve(200, { items: [doc] }, "///");
    expect(c.enforcesUserToken).toBe(true);
    const page = await c.list({ limit: 1 });
    expect(page).not.toHaveProperty("nextCursor");
    expect(seen).toEqual([{ path: "/list", type: "application/json", auth: "Bearer L" }]);
  });
  it("names the url in 404 and 403 errors and the status in others", async () => {
    const at = (c: Awaited<ReturnType<typeof serve>>) => c.fetch("a", { token: "U" });
    await expect(at(await serve(404, {}))).rejects.toMatchObject({ code: "NOT_FOUND", message: /^not found at http:\/\/127\.0\.0\.1:\d+\/fetch$/ });
    server.close();
    await expect(at(await serve(403, {}))).rejects.toMatchObject({ code: "FORBIDDEN", message: /^forbidden at http:\/\/127\.0\.0\.1:\d+\/fetch$/ });
    server.close();
    await expect(at(await serve(500, {}))).rejects.toThrow("custom connector answered 500");
  });
  it("accepts an empty list and rejects items that are not whole documents", async () => {
    expect(await (await serve(200, { items: [] })).list({ limit: 1 })).toEqual({ items: [] });
    const bad: unknown[] = [null, "x", {}, { ...doc, title: 1 }, { ...doc, acl: { allowUsers: 1 } }, { address: "a" }, { ...doc, updatedAt: undefined }];
    for (const item of bad) {
      server.close();
      await expect((await serve(200, { items: [item] })).list({ limit: 1 })).rejects.toThrow("custom connector returned a bad list");
    }
    server.close();
    await expect((await serve(200, { items: [doc, { address: "a" }] })).list({ limit: 1 })).rejects.toThrow("bad list");
    server.close();
    await expect((await serve(200, { items: "nope" })).list({ limit: 1 })).rejects.toThrow("bad list");
  });
  it("drops a next cursor that is not a string", async () => {
    expect(await (await serve(200, { items: [doc], nextCursor: 5 })).list({ limit: 1 })).not.toHaveProperty("nextCursor");
  });
  it("needs both a string text and a string version to fetch", async () => {
    for (const body of [{ text: "t" }, { version: "v" }, { text: 1, version: "v" }, { text: "t", version: 1 }, {}]) {
      server?.close();
      await expect((await serve(200, body)).fetch("a", { token: "U" })).rejects.toThrow("custom connector returned a bad document");
    }
  });
});
