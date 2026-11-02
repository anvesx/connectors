import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gmailManifest } from "../../../index.js";
import type { Replay } from "../../../shared/tests/replay.js";
import { b64, calls, gmailAt, ok, start, status, U } from "./helper.js";

const part = (mimeType: string, text?: string, parts?: object[]) => ({ mimeType, ...(text && { body: { data: b64(text) } }), ...(parts && { parts }) });
let replay: Replay;
beforeAll(async () => {
  replay = await start({
    [`${U}/profile`]: ok({ emailAddress: "me@x.io" }),
    [`${U}/messages`]: ok({ messages: [] }),
    [`${U}/messages/none`]: ok({ id: "none" }),
    [`${U}/messages/bare`]: ok({ id: "bare", payload: part("text/plain", "body") }),
    [`${U}/messages/nested`]: ok({
      id: "nested",
      historyId: "3",
      payload: {
        headers: [
          { name: "From", value: "a@b" },
          { name: "subject", value: "S" },
        ],
        ...part("multipart/mixed", undefined, [
          part("text/html", "<p>"),
          part("text/plain"),
          part("multipart/alternative", undefined, [part("text/plain", "deep")]),
        ]),
      },
    }),
    [`${U}/messages/html`]: ok({ id: "html", payload: part("text/html", "<p>") }),
    [`${U}/messages/auth`]: status(401),
  });
});
afterAll(() => replay.close());
const ctx = { token: "ya29-u" };

describe("gmail fetch and canRead edges", () => {
  it("finds the first text/plain part in nested parts and reads subject and from case-insensitively", async () => {
    expect(await gmailAt(replay).fetch("nested", ctx)).toEqual({ text: "Subject: S\nFrom: a@b\n\ndeep", version: "3" });
  });
  it("leaves missing headers and history id empty or zero", async () => {
    expect(await gmailAt(replay).fetch("bare", ctx)).toEqual({ text: "Subject: \nFrom: \n\nbody", version: "0" });
  });
  it("names the address when a message has no plain text or no payload", async () => {
    await expect(gmailAt(replay).fetch("html", ctx)).rejects.toMatchObject({ code: "NOT_FOUND", message: "No plain text in message: html" });
    await expect(gmailAt(replay).fetch("none", ctx)).rejects.toMatchObject({ code: "NOT_FOUND", message: "No plain text in message: none" });
  });
  it("checks readability with the minimal format and names canRead when the token is rejected", async () => {
    expect(await gmailAt(replay).canRead?.("bare", ctx)).toBe(true);
    expect(calls(replay, `${U}/messages/bare`).at(-1)).toEqual({ format: "minimal" });
    await expect(gmailAt(replay).canRead?.("auth", ctx)).rejects.toMatchObject({ code: "FORBIDDEN", message: "Forbidden: canRead" });
  });
  it("loads from the manifest against another host, in the personal zone", async () => {
    const c = gmailManifest.load({ id: "gm:1", listToken: "ya29-m", baseUrl: replay.url });
    expect(await c.list({ limit: 1 })).toEqual({ items: [] });
    expect(replay.seen.at(-1)?.authorization).toBe("Bearer ya29-m");
  });
});
