import { describe, expect, it } from "vitest";
import { createBuiltinRegistry, hasLiveRecheck } from "../../../index.js";

describe("built-in manifests", () => {
  const r = createBuiltinRegistry();
  it("lists github and drive first with their sign-in settings", () => {
    expect(r.list().map((e) => e.manifest.id)).toContain("drive");
    expect(r.get("github")?.auth).toMatchObject({ kind: "oauth2", app: "github", scopes: ["repo"], pkce: false });
    expect(r.get("drive")?.auth).toMatchObject({ kind: "oauth2", app: "google", pkce: true, extraParams: { access_type: "offline", prompt: "consent" } });
    expect(r.get("drive")?.defaultZone).toBe("team");
  });
  it("lists slack and gmail with OAuth sign-in, the shared google client, and their default zones", () => {
    expect(r.list().map((e) => e.manifest.id)).toEqual(["github", "drive", "slack", "gmail"]);
    expect(r.get("slack")).toMatchObject({ defaultZone: "company", auth: { kind: "oauth2", app: "slack", pkce: false } });
    expect(r.get("gmail")).toMatchObject({ defaultZone: "personal", auth: { kind: "oauth2", app: "google", pkce: true } });
    expect(r.get("gmail")?.auth).toMatchObject({ scopes: ["https://www.googleapis.com/auth/gmail.readonly"] });
  });
  it("loads slack and gmail adapters that carry the id, the zone and canRead", () => {
    const slack = r.get("slack")?.load({ id: "slack:1", listToken: "t" });
    const gmail = r.get("gmail")?.load({ id: "gmail:1", listToken: "t" });
    expect([slack?.id, gmail?.id]).toEqual(["slack:1", "gmail:1"]);
    expect([typeof slack?.canRead, typeof gmail?.canRead]).toEqual(["function", "function"]);
    expect(slack?.enforcesUserToken && gmail?.enforcesUserToken).toBe(true);
    expect(typeof slack?.listMemberships).toBe("function");
  });
  it("loads real adapters that carry the account's id and the live canRead", () => {
    const drive = r.get("drive")?.load({ id: "drive:1", listToken: "t" });
    expect(drive?.id).toBe("drive:1");
    const gh = r.get("github")?.load({ id: "github:1", listToken: "t", repo: { owner: "o", name: "n" } });
    expect(gh?.id).toBe("github:1");
    expect(typeof gh?.canRead).toBe("function");
  });
  it("makes a github load without a repo fail", () => {
    expect(() => r.get("github")?.load({ id: "github:1", listToken: "t" })).toThrow(/repo/);
  });
  it("reports canRead for every adapter without an account", () => {
    for (const e of r.list()) expect(hasLiveRecheck(e.manifest)).toBe(true);
  });
});
