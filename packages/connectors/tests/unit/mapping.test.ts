import { describe, expect, it } from "vitest";
import { type DriveChange, type DriveFile, mapAcl as driveAcl, mapChanges as driveChanges, mapDoc as driveDoc } from "../../src/drive/map.js";
import { type CompareFile, isListable, mapAcl, mapChanges, mapDoc, type TreeEntry } from "../../src/github/map.js";
import { buildAcl } from "../../src/shared/acl.js";
import { statusOf, toConnectorError } from "../../src/shared/errors.js";
import { fixture } from "../support/replay.js";

describe("buildAcl", () => {
  it("sorts, de-duplicates and versions deterministically", () => {
    const a = buildAcl(["b", "a", "a"], ["g"]);
    expect(a.allowUsers).toEqual(["a", "b"]);
    expect(buildAcl(["a", "b"], ["g"]).version).toBe(a.version);
    expect(buildAcl(["a"], ["g"]).version).not.toBe(a.version);
  });
});

describe("error mapping", () => {
  it("maps 404 to NOT_FOUND and 401/403 to FORBIDDEN, passes others through", () => {
    expect(toConnectorError({ status: 404 }, "x")).toMatchObject({ code: "NOT_FOUND" });
    expect(toConnectorError({ response: { status: 403 } }, "x")).toMatchObject({ code: "FORBIDDEN" });
    expect(toConnectorError({ code: "401" }, "x")).toMatchObject({ code: "FORBIDDEN" });
    const other = new Error("boom");
    expect(toConnectorError(other, "x")).toBe(other);
    expect(statusOf({ code: "ECONNRESET" })).toBeUndefined();
  });
});

describe("github mapping", () => {
  const tree = fixture<{ tree: TreeEntry[] }>("github/tree").tree;
  it("lists only text-sized blobs", () => {
    expect(tree.filter(isListable).map((e) => e.path)).toEqual(["README.md", "docs/guide.md"]);
  });
  it("maps collaborators, teams and visibility to an ACL", () => {
    const acl = mapAcl(fixture("github/collaborators"), fixture("github/teams"), "acme", true);
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

describe("drive mapping", () => {
  const files = fixture<{ files: (DriveFile & { id: string })[] }>("drive/files-list").files;
  it("maps live grants and ignores deleted ones", () => {
    const acl = driveAcl(files[0]!.permissions);
    expect(acl.allowUsers).toEqual(["alice@acme.test", "bob@acme.test"]);
    expect(acl.allowGroups).toEqual(["domain:acme.test", "hr@acme.test"]);
    expect(driveAcl(files[1]!.permissions)).toMatchObject({ allowUsers: [], allowGroups: ["anyone"] });
    expect(driveAcl(undefined).allowUsers).toEqual([]);
  });
  it("maps a file to a document keyed by id and version", () => {
    expect(driveDoc(files[0]!, "team")).toMatchObject({ address: files[0]!.id, title: "Leave policy", version: "42", updatedAt: "2026-10-28T14:03:11.000Z" });
  });
  it("maps removed and trashed changes to deletes", () => {
    const changes = fixture<{ changes: DriveChange[] }>("drive/changes-list").changes;
    expect(driveChanges(changes).map((e) => e.kind)).toEqual(["upsert", "delete", "delete"]);
  });
});
