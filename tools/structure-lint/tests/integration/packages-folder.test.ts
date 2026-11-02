import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { cleanFixtures, fixture, packageJson } from "../unit/fixture.js";

afterEach(cleanFixtures);

it("lints packages under packages/ like any other tier folder", () => {
  const root = fixture({
    "packages/a/package.json": packageJson("@scope/a"),
    "packages/a/README.md": "# package",
    "packages/a/src/README.md": "# source",
    "packages/a/src/long.ts": Array(81).fill("x").join("\n"),
    "packages/a/tests/.keep": "",
  });
  const result = spawnSync(process.execPath, [resolve("bin/cli.mjs"), "--root", root], { encoding: "utf8" });
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("packages/a/src/long.ts:lines:");
  expect(result.stdout).toContain("checked 1 packages");
});
