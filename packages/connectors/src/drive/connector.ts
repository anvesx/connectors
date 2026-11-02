import { ConnectorError } from "@brain/connector-kit";
import { auth, drive } from "@googleapis/drive";
import { badCursor, guarded, statusOf, toConnectorError } from "../shared/errors.js";
import type { CommonConfig, SourceConnector } from "../shared/types.js";
import { changesSince } from "./changes.js";
import { DOC_MIME, LIST_FIELDS, LIST_QUERY, mapDoc } from "./map.js";

export type DriveConfig = CommonConfig & { rootUrl?: string };

/** Google Drive adapter: text files and Google Docs; the ACL is each file's grants (users, groups, domains, link sharing). */
export const createDriveConnector = (config: DriveConfig): SourceConnector => {
  const client = (token: string) => {
    const oauth = new auth.OAuth2();
    oauth.setCredentials({ access_token: token });
    return drive({ version: "v3", auth: oauth, ...(config.rootUrl ? { rootUrl: config.rootUrl } : {}) });
  };
  return {
    id: config.id,
    enforcesUserToken: true,
    async list({ cursor, limit }) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new RangeError("limit must be an integer from 1 to 1000");
      try {
        const params = { q: LIST_QUERY, pageSize: limit, fields: LIST_FIELDS, supportsAllDrives: true, includeItemsFromAllDrives: true };
        const { data } = await client(config.listToken).files.list(cursor === undefined ? params : { ...params, pageToken: cursor });
        const items = (data.files ?? []).flatMap((f) => (f.id ? [mapDoc({ ...f, id: f.id }, config.zone ?? "team")] : []));
        return data.nextPageToken ? { items, nextCursor: data.nextPageToken } : { items };
      } catch (error) {
        throw cursor !== undefined && statusOf(error) === 400 ? badCursor() : toConnectorError(error, "list");
      }
    },
    async fetch(address, { token, signal }) {
      const api = client(token);
      const opts = signal ? { signal } : {};
      return guarded(address, async () => {
        const meta = (await api.files.get({ fileId: address, fields: "mimeType, version", supportsAllDrives: true }, opts)).data;
        const mime = meta.mimeType ?? "";
        if (mime !== DOC_MIME && !mime.startsWith("text/")) throw new ConnectorError("NOT_FOUND", `Not a text document: ${address}`);
        const body =
          mime === DOC_MIME
            ? await api.files.export({ fileId: address, mimeType: "text/plain" }, { ...opts, responseType: "text" })
            : await api.files.get({ fileId: address, alt: "media", supportsAllDrives: true }, { ...opts, responseType: "text" });
        return { text: String(body.data), version: meta.version ?? "0" };
      });
    },
    async canRead(address, { token }) {
      try {
        await client(token).files.get({ fileId: address, fields: "id", supportsAllDrives: true });
        return true;
      } catch (error) {
        const status = statusOf(error);
        if (status === 404 || status === 403) return false;
        throw toConnectorError(error, "canRead");
      }
    },
    async changes({ token, cursor }) {
      return guarded("changes", () => changesSince(client(token), cursor));
    },
  };
};
