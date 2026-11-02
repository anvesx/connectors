import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { scanRepo } from "../../src/scan.ts";

it("scans packages under packages/", () => {
  const root = mkdtempSync(join(tmpdir(), "fake-guard-"));
  try {
    mkdirSync(join(root, "packages/a/src"), { recursive: true });
    writeFileSync(join(root, "packages/a/package.json"), "{}");
    writeFileSync(join(root, "packages/a/src/fake.ts"), "export const x = 1");
    const { findings, checked } = scanRepo(root);
    expect(checked).toBe(1);
    expect(findings.map((f) => f.rule)).toEqual(["src-ships-fake"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
