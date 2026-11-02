import type { Connector } from "@brain/connector-kit";
import { describe, expect, it } from "vitest";
import { createRegistry, type Manifest } from "../../src/index.js";

const conn = (id: string): Connector => ({ id, list: async () => ({ items: [] }), fetch: async () => ({ text: "", version: "1" }) });
const m = (id: string, extra: Partial<Manifest> = {}): Manifest => ({
  id,
  name: id.toUpperCase(),
  auth: { kind: "pat" },
  defaultZone: "team",
  load: (c) => conn(c.id),
  ...extra,
});

describe("createRegistry", () => {
  it("registers, gets and lists built-in manifests for everyone", () => {
    const r = createRegistry();
    r.register(m("a"));
    r.register(m("b"));
    expect(r.get("a")?.name).toBe("A");
    expect(r.get("a", "t1")?.name).toBe("A");
    expect(r.get("zzz")).toBeUndefined();
    expect(r.list("t1").map((e) => e.manifest.id)).toEqual(["a", "b"]);
  });
  it("rejects a duplicate id and an id that is unsafe in a graph source", () => {
    const r = createRegistry();
    r.register(m("a"));
    expect(() => r.register(m("a"))).toThrow(/already registered/);
    for (const bad of ["", "A", "a:b", "a/b", "a b", "x".repeat(40)]) expect(() => r.register(m(bad))).toThrow(/id must/);
  });
  it("keeps a tenant entry invisible to another tenant", () => {
    const r = createRegistry();
    r.register(m("a"));
    r.register(m("mine"), "t1");
    expect(r.get("mine", "t1")?.id).toBe("mine");
    expect(r.get("mine", "t2")).toBeUndefined();
    expect(r.get("mine")).toBeUndefined();
    expect(r.list("t1").map((e) => [e.manifest.id, e.tenant])).toEqual([
      ["a", undefined],
      ["mine", "t1"],
    ]);
    expect(r.list("t2").map((e) => e.manifest.id)).toEqual(["a"]);
  });
  it("lets two tenants use the same custom id but never shadow a built-in", () => {
    const r = createRegistry();
    r.register(m("a"));
    r.register(m("wiki", { name: "one" }), "t1");
    r.register(m("wiki", { name: "two" }), "t2");
    expect(r.get("wiki", "t1")?.name).toBe("one");
    expect(r.get("wiki", "t2")?.name).toBe("two");
    expect(() => r.register(m("wiki"), "t1")).toThrow(/already registered/);
    expect(() => r.register(m("a"), "t1")).toThrow(/already registered/);
  });
});
