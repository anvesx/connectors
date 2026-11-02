import { describe, expect, it } from "vitest";
import { createDriveConnector } from "../../src/index.js";

const token = process.env["DRIVE_ACCESS_TOKEN"];

// Runs against www.googleapis.com only when DRIVE_ACCESS_TOKEN (an OAuth access token with drive.readonly) is set; skipped otherwise.
describe.skipIf(!token)("drive connector against the live API", () => {
  const drive = () => createDriveConnector({ id: "gd-live", listToken: token ?? "" });

  it("lists documents with ACLs", async () => {
    const page = await drive().list({ limit: 10 });
    expect(page.items.length).toBeGreaterThan(0);
  });

  it("fetches text with the caller's token and maps a missing file and a bad token", async () => {
    const connector = drive();
    const [doc] = (await connector.list({ limit: 1 })).items;
    const got = await connector.fetch(doc!.address, { token: token ?? "" });
    expect(typeof got.text).toBe("string");
    await expect(connector.fetch("no-such-file-id", { token: token ?? "" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(connector.fetch(doc!.address, { token: "invalid-token" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns a baseline cursor, then no events when nothing changed", async () => {
    const connector = drive();
    const baseline = await connector.changes({ token: token ?? "" });
    expect(baseline.next).not.toBe("");
    expect((await connector.changes({ token: token ?? "", cursor: baseline.next })).events).toEqual([]);
  });
});
