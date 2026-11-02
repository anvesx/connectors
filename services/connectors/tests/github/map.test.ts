import { describe, expect, it } from "vitest";
import { type CompareFile, isListable, mapAcl, mapChanges, mapDoc, type TreeEntry } from "../../src/github/map.js";
import { buildAcl } from "../../src/shared/acl.js";
import { fixture } from "../../src/testing/replay.js";

describe("github mapping", () => {
  const tree = fixture<{ tree: TreeEntry[] }>("github/tree").tree;
  it("lists only text-sized blobs", () => {
    expect(tree.filter(isListable).map((e) => e.path)).toEqual(["README.md", "docs/guide.md"]);
  });
  it("maps collaborators, teams and visibility to an ACL", () => {
    const acl = mapAcl(fixture("github-members/collaborators"), fixture("github-members/teams"), "acme", true);
    expect(acl.allowUsers).toEqual(["hubot", "octocat"]);
    expect(acl.allowGroups).toEqual(["acme/docs", "acme/justice-league"]);
    expect(mapAcl([], [], "acme", false).allowGroups).toEqual(["public"]);
  });
  it("maps a blob to a document keyed by path and blob sha", () => {
    const entry = tree.filter(isListable)[1]!;
    expect(mapDoc(entry, buildAcl([], []), "2026-10-30T09:14:02Z", "team")).toMatchObject({
      address: "docs/guide.md",
      title: "guide.md",
      version: "3d21ec53a331a6f037a91c368710b99387d012c1",
      zone: "team",
    });
  });
  it("maps compare files, splitting a rename into delete plus upsert", () => {
    expect(mapChanges(fixture<{ files: CompareFile[] }>("github-changes/compare").files)).toEqual([
      { address: "docs/guide.md", kind: "upsert" },
      { address: "docs/new.md", kind: "upsert" },
      { address: "docs/old.md", kind: "delete" },
      { address: "docs/before.md", kind: "delete" },
      { address: "docs/renamed.md", kind: "upsert" },
    ]);
  });
});
