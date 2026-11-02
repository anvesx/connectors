import { describe, expect, it } from "vitest";
import { createGithubConnector } from "../../src/index.js";

const token = process.env["GITHUB_TOKEN"];
const slug = process.env["GITHUB_TEST_REPO"];
const [owner = "", repo = ""] = (slug ?? "").split("/");

// Runs against api.github.com only when GITHUB_TOKEN and GITHUB_TEST_REPO (`owner/repo`) are set; skipped otherwise.
describe.skipIf(!token || !slug)("github connector against the live API", () => {
  const github = () => createGithubConnector({ id: "gh-live", owner, repo, listToken: token ?? "" });

  it("lists documents with a repo-level ACL", async () => {
    const page = await github().list({ limit: 25 });
    expect(page.items.length).toBeGreaterThan(0);
    const first = page.items[0]!;
    expect(first.acl.allowUsers.length + first.acl.allowGroups.length).toBeGreaterThan(0);
  });

  it("fetches text with the caller's token and maps a missing path and a bad token", async () => {
    const connector = github();
    const [doc] = (await connector.list({ limit: 1 })).items;
    const got = await connector.fetch(doc!.address, { token: token ?? "" });
    expect(got.version).toBe(doc!.version);
    await expect(connector.fetch("no/such/path.md", { token: token ?? "" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(connector.fetch(doc!.address, { token: "invalid-token" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns a baseline cursor, then no events when nothing changed", async () => {
    const connector = github();
    const baseline = await connector.changes({ token: token ?? "" });
    expect(baseline.events).toEqual([]);
    const again = await connector.changes({ token: token ?? "", cursor: baseline.next });
    expect(again.events).toEqual([]);
  });
});
