import type { drive_v3 } from "@googleapis/drive";
import { badCursor, statusOf } from "../shared/errors.js";
import type { ChangeSet } from "../shared/types.js";
import { type DriveChange, mapChanges } from "./map.js";

const FIELDS = "nextPageToken, newStartPageToken, changes(fileId, removed, file(trashed))";

/** Cursor is a Drive change page token. Without one, the current start token is the baseline and no events are returned. */
export const changesSince = async (api: drive_v3.Drive, cursor: string | undefined): Promise<ChangeSet> => {
  if (cursor === undefined) return { events: [], next: (await api.changes.getStartPageToken({ supportsAllDrives: true })).data.startPageToken ?? "" };
  const found: DriveChange[] = [];
  let pageToken: string = cursor;
  try {
    for (;;) {
      const { data } = await api.changes.list({ pageToken, pageSize: 1000, fields: FIELDS, supportsAllDrives: true, includeItemsFromAllDrives: true });
      found.push(...(data.changes ?? []));
      if (data.nextPageToken) pageToken = data.nextPageToken;
      else return { events: mapChanges(found), next: data.newStartPageToken ?? pageToken };
    }
  } catch (error) {
    if (statusOf(error) === 400) throw badCursor();
    throw error;
  }
};
