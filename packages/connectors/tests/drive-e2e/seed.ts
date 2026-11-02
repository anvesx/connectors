import { createDriveConnector } from "../../src/index.js";
import { type DFile, DOC, type DriveServer, startDrive } from "../support/drive-server.js";

const user = (emailAddress: string) => ({ type: "user", role: "reader", emailAddress });
export const seed: DFile[] = [
  {
    id: "doc1",
    name: "Leave policy",
    mimeType: DOC,
    version: "42",
    body: "Leave policy text",
    permissions: [user("alice@acme.test"), { type: "domain", role: "reader", domain: "acme.test" }],
  },
  { id: "txt1", name: "notes.txt", mimeType: "text/plain", version: "7", body: "plain notes", permissions: [{ type: "anyone", role: "reader" }] },
  { id: "doc2", name: "Roadmap", mimeType: DOC, version: "3", body: "Roadmap text", permissions: [user("bob@acme.test")], readers: ["bob"] },
  { id: "txt2", name: "todo.txt", mimeType: "text/plain", version: "1", body: "todo", permissions: [user("alice@acme.test")] },
  { id: "img1", name: "logo.png", mimeType: "image/png", version: "1", body: "png", permissions: [] },
  { id: "txt3", name: "faq.txt", mimeType: "text/plain", version: "2", body: "faq", permissions: [] },
];

/** A Drive server holding the seed, and the real connector pointed at it through `rootUrl`. */
export const boot = async (opts: Parameters<typeof startDrive>[1] = {}, listToken = "index") => {
  const server: DriveServer = await startDrive(seed, opts);
  return { server, drive: createDriveConnector({ id: "gd", listToken, rootUrl: server.url }) };
};
