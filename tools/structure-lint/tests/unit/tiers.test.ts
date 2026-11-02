import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkTiers } from "../../src/tiers.ts";
import { cleanFixtures, fixture, packageJson } from "./fixture.js";

afterEach(cleanFixtures);

const manifest = (name: string, dependencies: Record<string, string> = {}) =>
  [`${name}/package.json`, packageJson(`@anvesx/${name.split("/")[1]}`, dependencies)] as const;

const dirs = (root: string, entries: (readonly [string, string])[]) => entries.map(([path]) => join(root, path, ".."));

describe("tier direction rule", () => {
  it("allows only the documented downward dependency edges", () => {
    const entries = [
      manifest("features/core-types"),
      manifest("features/one", { "@anvesx/core-types": "workspace:*" }),
      manifest("services/api", { "@anvesx/one": "workspace:*" }),
      manifest("modules/search", { "@anvesx/api": "workspace:*", "@anvesx/one": "workspace:*" }),
      manifest("apps/web", { "@anvesx/search": "workspace:*", "@anvesx/api": "workspace:*", "@anvesx/one": "workspace:*" }),
      manifest("tools/lint"),
    ];
    const root = fixture(Object.fromEntries(entries));
    expect(checkTiers(root, dirs(root, entries))).toEqual([]);
  });

  it("reports sideways, upward, tool-to-app and anything-to-tool dependencies", () => {
    const entries = [
      manifest("features/core-types"),
      manifest("features/one"),
      manifest("features/two", { "@anvesx/one": "workspace:*" }),
      manifest("services/a"),
      manifest("services/b", { "@anvesx/a": "workspace:*" }),
      manifest("modules/m", { "@anvesx/m2": "workspace:*" }),
      manifest("modules/m2"),
      manifest("apps/web", { "@anvesx/a": "workspace:*", "@anvesx/web2": "workspace:*" }),
      manifest("apps/web2", { "@anvesx/lint": "workspace:*" }),
      manifest("tools/lint", { "@anvesx/one": "workspace:*", "@anvesx/m": "workspace:*", "@anvesx/web2": "workspace:*" }),
    ];
    const root = fixture(Object.fromEntries(entries));
    const found = checkTiers(root, dirs(root, entries));
    expect(found).toHaveLength(6);
    expect(found.filter((item) => item.message.includes("@anvesx/lint"))).toHaveLength(2);
    expect(found[0]?.file).toBe("features/two/package.json");
    expect(found[0]?.message).toContain("may not depend on @anvesx/one");
  });

  it("checks every dependency field and ignores third-party packages", () => {
    const root = fixture({
      "features/core-types/package.json": packageJson("@anvesx/core-types"),
      "features/a/package.json": packageJson("@anvesx/a"),
      "features/b/package.json": JSON.stringify({
        name: "@anvesx/b",
        devDependencies: { "@anvesx/a": "*" },
        peerDependencies: { "@anvesx/a": "*" },
        optionalDependencies: { "@anvesx/a": "*", zod: "*" },
      }),
    });
    const packages = ["core-types", "a", "b"].map((name) => ({
      dir: join(root, "features", name),
      tier: "feature" as const,
    }));
    expect(checkTiers(root, packages)).toHaveLength(3);
  });

  it("raises typed errors for malformed or duplicate manifests", () => {
    const run = (content: string) => {
      const root = fixture({ "features/a/package.json": content });
      return () => checkTiers(root, [join(root, "features/a")]);
    };
    expect(run("{")).toThrow(/invalid JSON/);
    for (const value of ["null", "{}", JSON.stringify({ name: 1 })]) expect(run(value)).toThrow(/package name is missing/);
    for (const value of [null, [], "bad"]) expect(run(JSON.stringify({ name: "@anvesx/a", dependencies: value }))).toThrow(/must be an object/);
    const root = fixture({
      "features/a/package.json": packageJson("same"),
      "features/b/package.json": packageJson("same"),
    });
    expect(() => checkTiers(root, [join(root, "features/a"), join(root, "features/b")])).toThrow(/must be unique/);
  });
});
