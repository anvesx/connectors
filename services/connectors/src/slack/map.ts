import { ConnectorError, type ListedDoc } from "@anvesx/connector-kit";
import type { Zone } from "@anvesx/core-types";
import { buildAcl } from "../shared/acl.js";
import { badCursor } from "../shared/errors.js";
import { pageLimit, UpstreamLimitError } from "../shared/limits.js";
import { RATE_LIMITED_CODE } from "./retry.js";

export type SlackChannel = { id?: string; name?: string; is_private?: boolean; updated?: number };
export type SlackMessage = { user?: string; bot_id?: string; text?: string; ts?: string };
type Paged = { response_metadata?: { next_cursor?: string } };

export const WORKSPACE = "slack:workspace";
export const channelGroup = (id: string): string => `slack:channel:${id}`;
export const TYPES = "public_channel,private_channel";

/** A public channel is readable by the whole workspace group; a private one only by its own member group. */
export const mapChannel = (c: SlackChannel & { id: string }, zone: Zone): ListedDoc => ({
  address: c.id,
  title: `#${c.name ?? c.id}`,
  version: String(c.updated ?? 0),
  acl: buildAcl([], [c.is_private ? channelGroup(c.id) : WORKSPACE]),
  zone,
  updatedAt: new Date(c.updated ?? 0).toISOString(),
});

/** Slack returns history newest first; the text reads oldest first, one `author: text` line per message. */
export const toText = (messages: readonly SlackMessage[]): { text: string; version: string } => ({
  text: [...messages]
    .reverse()
    .map((m) => `${m.user ?? m.bot_id ?? "unknown"}: ${m.text ?? ""}\n`)
    .join(""),
  version: messages[0]?.ts ?? "0",
});

const FORBIDDEN = new Set(["not_in_channel", "missing_scope", "access_denied", "invalid_auth", "token_revoked", "token_expired", "account_inactive"]);

/** Slack reports API errors as `ok: false` with HTTP 200; the SDK throws them with the code in `data.error`. */
export const slackCode = (error: unknown): string | undefined => (error as { data?: { error?: unknown } } | null)?.data?.error as string | undefined;

export const guardSlack = async <T>(what: string, run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    const code = slackCode(error);
    if (code === "invalid_cursor") throw badCursor();
    if (code === "channel_not_found") throw new ConnectorError("NOT_FOUND", `Not found: ${what}`);
    if (code !== undefined && FORBIDDEN.has(code)) throw new ConnectorError("FORBIDDEN", `Forbidden: ${what}`);
    // `rateLimitedFetch` (retry.ts) answers a 429 it gives up on with this code.
    if (code === RATE_LIMITED_CODE) throw new UpstreamLimitError("RATE_LIMITED", `Rate limited: ${what}`);
    throw error;
  }
};

/** Follows `next_cursor` until Slack returns an empty one, collecting every page. After `maxPages` pages with more to come it throws PAGE_LIMIT (callers need the complete set). */
export const pages = async <T extends Paged>(what: string, maxPages: number, call: (cursor?: string) => Promise<T>): Promise<T[]> => {
  const out: T[] = [];
  for (let cursor: string | undefined; ; ) {
    const page = await call(cursor);
    out.push(page);
    cursor = page.response_metadata?.next_cursor || undefined;
    if (cursor === undefined) return out;
    if (out.length >= maxPages) throw pageLimit(what, maxPages);
  }
};
