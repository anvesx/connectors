import type { Connector } from "@anvesx/connector-kit";
import { describe, expect, it } from "vitest";
import { hasLiveRecheck, type LoadConfig, type Manifest } from "../../src/index.js";

const base: Manifest = { id: "m", name: "M", auth: { kind: "pat" }, defaultZone: "team", load: () => ({}) as Connector };
const withCanRead = { id: "p", list: async () => ({ items: [] }), fetch: async () => ({ text: "", version: "1" }), canRead: async () => true };

describe("hasLiveRecheck edges", () => {
  it("probes a repo-bound manifest with a probe repo, an empty token and the probe id", () => {
    const loads: LoadConfig[] = [];
    const m: Manifest = {
      ...base,
      needsRepo: true,
      load: (c) => {
        loads.push(c);
        return withCanRead;
      },
    };
    expect(hasLiveRecheck(m)).toBe(true);
    expect(loads).toEqual([{ id: "probe", listToken: "", repo: { owner: "probe", name: "probe" } }]);
  });
  it("probes a manifest that needs no repo without one", () => {
    const loads: LoadConfig[] = [];
    expect(
      hasLiveRecheck({
        ...base,
        load: (c) => {
          loads.push(c);
          return withCanRead;
        },
      }),
    ).toBe(true);
    expect(loads).toEqual([{ id: "probe", listToken: "" }]);
  });
  it("is false when the adapter has no canRead", () => {
    const { canRead: _, ...without } = withCanRead;
    expect(hasLiveRecheck({ ...base, load: () => without })).toBe(false);
  });
  it("is false, not thrown, when the adapter cannot be built", () => {
    expect(
      hasLiveRecheck({
        ...base,
        load: () => {
          throw new Error("no");
        },
      }),
    ).toBe(false);
  });
});
