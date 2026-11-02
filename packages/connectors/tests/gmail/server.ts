import { createGmailConnector } from "../../src/index.js";
import { fixture, type Replay, type Reply, startReplay } from "../support/replay.js";

const U = "/gmail/v1/users/me";
const ok = (name: string): Reply => ({ status: 200, body: fixture(`gmail/${name}`) });
const err = (status: number, name: string): Reply => ({ status, body: fixture(`gmail/errors/${name}`) });

/** Routes follow the Gmail v1 REST paths; the format query parameter picks metadata, full or minimal bodies. */
export const startGmail = (): Promise<Replay> =>
  startReplay({
    [`${U}/profile`]: ok("profile"),
    [`${U}/messages`]: (url) => {
      const token = url.searchParams.get("pageToken");
      return token === "bad" ? err(400, "bad-request") : ok(token ? "list/second" : "list/first");
    },
    [`${U}/messages/m1`]: (url) =>
      ok(url.searchParams.get("format") === "full" ? "bodies/m1-full" : url.searchParams.get("format") === "minimal" ? "bodies/minimal" : "metadata/m1"),
    [`${U}/messages/m2`]: (url) => ok(url.searchParams.get("format") === "full" ? "bodies/m2-html-only" : "metadata/m2"),
    [`${U}/messages/m3`]: ok("metadata/m3"),
    [`${U}/messages/locked`]: err(403, "forbidden"),
    [`${U}/messages/boom`]: { status: 500, body: { error: { code: 500, message: "boom" } } },
    [`${U}/history`]: (url) => {
      const start = url.searchParams.get("startHistoryId");
      if (start === "1") return err(404, "not-found");
      if (start === "5000") return ok("history/empty");
      return ok(url.searchParams.get("pageToken") ? "history/list-second" : "history/list");
    },
  });

export const gmailFor = (replay: Replay) => createGmailConnector({ id: "gm", listToken: "ya29-index", rootUrl: replay.url });
