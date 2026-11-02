import type { WebClient } from "@slack/web-api";
import { badCursor } from "../shared/errors.js";
import type { ChangeEvent, ChangeSet } from "../shared/types.js";
import { pages, TYPES } from "./map.js";

const TS = /^\d{1,12}\.\d{6}$/;
const toTs = (ms: number): string => `${Math.floor(ms / 1000)}.000000`;

/** Cursor is a Slack message timestamp. Channels the token has not joined are skipped; archived and deleted channels are not reported. */
export const changesSince = async (api: WebClient, cursor: string | undefined, now: () => number): Promise<ChangeSet> => {
  if (cursor === undefined) return { events: [], next: toTs(now()) };
  if (!TS.test(cursor)) throw badCursor();
  const listed = await pages((c) => api.conversations.list({ types: TYPES, exclude_archived: true, limit: 200, ...(c && { cursor: c }) }));
  const channels = listed.flatMap((p) => p.channels ?? []).filter((c) => c.id && c.is_member !== false);
  const events: ChangeEvent[] = [];
  let next = cursor;
  for (const { id } of channels) {
    const newest = (await api.conversations.history({ channel: id as string, oldest: cursor, limit: 1 })).messages?.[0]?.ts;
    if (newest === undefined) continue;
    events.push({ address: id as string, kind: "upsert" });
    if (Number(newest) > Number(next)) next = newest;
  }
  return { events, next };
};
