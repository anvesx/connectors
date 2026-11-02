import { createSlackConnector } from "../../../index.js";
import { type Replay, type Route, startReplay } from "../../../shared/tests/replay.js";

export const reply = (body: object): { status: number; body: object } => ({ status: 200, body: { ok: true, ...body } });
export const fail = (error: string): { status: number; body: object } => ({ status: 200, body: { ok: false, error } });

export const start = (routes: Record<string, Route>): Promise<Replay> => startReplay(routes);

/** The parameters of every request to `path`, in order. */
export const calls = (replay: Replay, path: string): Record<string, string>[] =>
  replay.seen.filter((r) => r.path.split("?")[0] === path).map((r) => Object.fromEntries(new URL(`http://x${r.path}`).searchParams));

export const slackAt = (replay: Replay, now?: () => number) =>
  createSlackConnector({ id: "sl", listToken: "xoxp-index", baseUrl: `${replay.url}/`, retries: 0, ...(now && { now }) });
