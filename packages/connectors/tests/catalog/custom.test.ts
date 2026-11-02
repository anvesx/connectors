import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { type CustomSpec, customManifest } from "../../src/catalog/http.js";

const doc = {
  address: "a1",
  title: "T",
  version: "v1",
  updatedAt: "2026-01-01T00:00:00Z",
  acl: { allowUsers: ["u"], allowGroups: [], version: 1 },
  zone: "company",
};
let server: Server;
const serve = async (answer: (path: string, auth: string | undefined) => [number, unknown]) => {
  server = createServer((req, res) => {
    const [code, body] = answer(req.url ?? "", req.headers.authorization);
    res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(body));
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
};
const spec = (endpoint: string, canRead: boolean): CustomSpec => ({
  id: "wiki",
  name: "Wiki",
  auth: { kind: "token" },
  defaultZone: "team",
  endpoint,
  canRead,
});
afterEach(() => server?.close());

describe("customManifest", () => {
  it("lists, fetches and forces the manifest's zone, sending the right bearer", async () => {
    const seen: string[] = [];
    const url = await serve((p, a) => {
      seen.push(`${p} ${a}`);
      return p === "/list" ? [200, { items: [doc], nextCursor: "n" }] : [200, { text: "hi", version: "v1" }];
    });
    const c = customManifest(spec(url, false)).load({ id: "wiki:1", listToken: "L" });
    expect(await c.list({ limit: 5 })).toEqual({ items: [{ ...doc, zone: "team" }], nextCursor: "n" });
    expect(await c.fetch("a1", { token: "U" })).toEqual({ text: "hi", version: "v1" });
    expect(seen).toEqual(["/list Bearer L", "/fetch Bearer U"]);
    expect(c.canRead).toBeUndefined();
  });
  it("offers canRead only when declared, and asks the endpoint", async () => {
    const url = await serve((_p, a) => [200, { allowed: a === "Bearer ok" }]);
    const c = customManifest(spec(url, true)).load({ id: "wiki:1", listToken: "L" });
    expect(await c.canRead?.("a1", { token: "ok" })).toBe(true);
    expect(await c.canRead?.("a1", { token: "no" })).toBe(false);
  });
  it("maps statuses and rejects a malformed list", async () => {
    const url = await serve((p) => (p === "/list" ? [200, { items: [{ address: 1 }] }] : [404, {}]));
    const c = customManifest(spec(url, false)).load({ id: "wiki:1", listToken: "L" });
    await expect(c.list({ limit: 1 })).rejects.toThrow(/bad list/);
    await expect(c.fetch("x", { token: "U" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
