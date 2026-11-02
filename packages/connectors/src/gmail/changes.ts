import type { gmail_v1 } from "@googleapis/gmail";
import { badCursor, statusOf } from "../shared/errors.js";
import type { ChangeSet } from "../shared/types.js";
import { mapHistory } from "./map.js";

/** Cursor is a Gmail history id. Gmail answers 404 once it has dropped that history, which is a bad cursor. */
export const changesSince = async (api: gmail_v1.Gmail, cursor: string | undefined): Promise<ChangeSet> => {
  if (cursor === undefined) return { events: [], next: (await api.users.getProfile({ userId: "me" })).data.historyId ?? "" };
  if (!/^\d+$/.test(cursor)) throw badCursor();
  const records: gmail_v1.Schema$History[] = [];
  let next = cursor;
  try {
    for (let pageToken: string | undefined; ; ) {
      const { data } = await api.users.history.list({ userId: "me", startHistoryId: cursor, ...(pageToken && { pageToken }) });
      records.push(...(data.history ?? []));
      next = data.historyId ?? next;
      pageToken = data.nextPageToken ?? undefined;
      if (pageToken === undefined) return { events: mapHistory(records), next };
    }
  } catch (error) {
    if (statusOf(error) === 404) throw badCursor();
    throw error;
  }
};
