import { createSlackConnector } from "../../src/index.js";
import { fixture, type Replay, type Reply, startReplay } from "../../src/testing/replay.js";

const ok = (name: string): Reply => ({ status: 200, body: fixture(`slack/${name}`) });
const NEWEST = "1762000500.000100";

/** Slack answers 200 with `ok: false` for API errors; routing by channel and `oldest` comes from the request body. */
export const startSlack = (): Promise<Replay> =>
  startReplay({
    "/conversations.list": (url) => {
      if (url.searchParams.get("types") === "private_channel") return ok("channels/private");
      if (url.searchParams.get("cursor") === "bad") return ok("errors/invalid-cursor");
      return url.searchParams.get("cursor") ? ok("channels/second") : ok("channels/first");
    },
    "/conversations.history": (url) => {
      const channel = url.searchParams.get("channel");
      const oldest = url.searchParams.get("oldest");
      if (channel === "C01GEN")
        return oldest === null ? ok("history/page") : oldest < NEWEST ? ok("history/new") : { status: 200, body: { ok: true, messages: [] } };
      if (channel === "G02LEAD") return oldest === null ? ok("errors/not-in-channel") : { status: 200, body: { ok: true, messages: [] } };
      return ok("errors/channel-not-found");
    },
    "/conversations.info": (url) => {
      const channel = url.searchParams.get("channel");
      if (channel === "C01GEN") return ok("channels/info");
      if (channel === "CBOOM") return { status: 500, body: "boom" };
      return channel === "G02LEAD" ? ok("errors/not-in-channel") : ok("errors/channel-not-found");
    },
    "/conversations.members": () => ok("people/members"),
    "/users.list": () => ok("people/users"),
  });

export const slackFor = (replay: Replay, now?: () => number) =>
  createSlackConnector({ id: "sl", listToken: "xoxp-index", baseUrl: `${replay.url}/`, retries: 0, ...(now && { now }) });
