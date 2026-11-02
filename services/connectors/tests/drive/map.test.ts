import { describe, expect, it } from "vitest";
import { type DriveChange, type DriveFile, mapAcl, mapChanges, mapDoc } from "../../src/drive/map.js";
import { fixture } from "../../src/testing/replay.js";

describe("drive mapping", () => {
  const files = fixture<{ files: (DriveFile & { id: string })[] }>("drive/files-list").files;
  it("maps live grants and ignores deleted ones", () => {
    const acl = mapAcl(files[0]!.permissions);
    expect(acl.allowUsers).toEqual(["alice@acme.test", "bob@acme.test"]);
    expect(acl.allowGroups).toEqual(["domain:acme.test", "hr@acme.test"]);
    expect(mapAcl(files[1]!.permissions)).toMatchObject({ allowUsers: [], allowGroups: ["anyone"] });
    expect(mapAcl(undefined).allowUsers).toEqual([]);
  });
  it("maps a file to a document keyed by id and version", () => {
    expect(mapDoc(files[0]!, "team")).toMatchObject({ address: files[0]!.id, title: "Leave policy", version: "42", updatedAt: "2026-10-28T14:03:11.000Z" });
  });
  it("maps removed and trashed changes to deletes", () => {
    const changes = fixture<{ changes: DriveChange[] }>("drive/changes/changes-list").changes;
    expect(mapChanges(changes).map((e) => e.kind)).toEqual(["upsert", "delete", "delete"]);
  });
});
