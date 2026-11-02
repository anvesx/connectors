import { describe, expect, it } from "vitest";
import { createBuiltinRegistry, hasLiveRecheck } from "../../src/index.js";

describe("built-in manifests", () => {
  const r = createBuiltinRegistry();
  it("lists github and drive with their sign-in settings", () => {
    expect(r.list().map((e) => e.manifest.id)).toEqual(["github", "drive"]);
    expect(r.get("github")?.auth).toMatchObject({ kind: "oauth2", app: "github", scopes: ["repo"], pkce: false });
    expect(r.get("drive")?.auth).toMatchObject({ kind: "oauth2", app: "google", pkce: true, extraParams: { access_type: "offline", prompt: "consent" } });
    expect(r.get("drive")?.defaultZone).toBe("team");
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
  it("reports canRead for both adapters without an account", () => {
    for (const e of r.list()) expect(hasLiveRecheck(e.manifest)).toBe(true);
  });
});
