import { createGmailConnector } from "../../../index.js";
import { type Replay, type Route, startReplay } from "../../../shared/tests/replay.js";

export const U = "/gmail/v1/users/me";
export const ok = (body: object): { status: number; body: object } => ({ status: 200, body });
export const status = (code: number): { status: number; body: object } => ({ status: code, body: { error: { code, message: `e${code}` } } });
export const start = (routes: Record<string, Route>): Promise<Replay> => startReplay(routes);

/** The parameters of every request to `path`, in order. */
export const calls = (replay: Replay, path: string): Record<string, string>[] =>
  replay.seen.filter((r) => r.path.split("?")[0] === path).map((r) => Object.fromEntries(new URL(`http://x${r.path}`).searchParams));

export const gmailAt = (replay: Replay) => createGmailConnector({ id: "gm", listToken: "ya29-index", rootUrl: replay.url });
export const b64 = (s: string): string => Buffer.from(s).toString("base64url");
