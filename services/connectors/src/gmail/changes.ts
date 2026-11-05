import type { gmail_v1 } from "@googleapis/gmail";
import { badCursor, statusOf } from "../shared/errors.js";
import type { ChangeSet } from "../shared/types.js";
import { mapHistory } from "./map.js";

/**
 * Cursor is a Gmail history id. Gmail answers 404 once it has dropped that history, which is a bad cursor.
 * Gmail's page token can resume a walk, so after `maxPages` pages this returns the events so far and `next` = `<history id>:<page token>`
 * for the first page not read yet. Pass it back as the cursor to continue; nothing is lost and no error is thrown.
 */
export const changesSince = async (api: gmail_v1.Gmail, cursor: string | undefined, maxPages: number): Promise<ChangeSet> => {
  if (cursor === undefined) return { events: [], next: (await api.users.getProfile({ userId: "me" })).data.historyId ?? "" };
  const match = /^(\d+)(?::(.+))?$/.exec(cursor);
  if (match === null) throw badCursor();
  const start = match[1] as string;
  const records: gmail_v1.Schema$History[] = [];
  let next = start;
  try {
    for (let page = 1, pageToken = match[2]; ; page++) {
      const { data } = await api.users.history.list({ userId: "me", startHistoryId: start, maxResults: 500, ...(pageToken && { pageToken }) });
      records.push(...(data.history ?? []));
      next = data.historyId ?? next;
      pageToken = data.nextPageToken ?? undefined;
      if (pageToken === undefined) return { events: mapHistory(records), next };
      if (page >= maxPages) return { events: mapHistory(records), next: `${start}:${pageToken}` };
    }
  } catch (error) {
    if (statusOf(error) === 404) throw badCursor();
    throw error;
  }
};
