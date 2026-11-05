import { ConnectorError } from "@anvesx/connector-kit";
import { auth, gmail } from "@googleapis/gmail";
import { badCursor, guarded, statusOf, toConnectorError } from "../shared/errors.js";
import { DEFAULT_RETRIES, googleRetry } from "../shared/google/retry.js";
import { isRateLimited, pageCap, retryCap } from "../shared/limits.js";
import type { CommonConfig, SourceConnector } from "../shared/types.js";
import { changesSince } from "./changes.js";
import { mapMessage, toText } from "./map.js";

/** `retries` is how often gaxios retries a 429, 5xx or quota 403 (default 3). `maxPages` defaults to 50 pages of 500 = 25,000 history records per `changes` call. */
export type GmailConfig = CommonConfig & { rootUrl?: string; retries?: number };

export const DEFAULT_MAX_PAGES = 50;

/** Gmail adapter: each message is a document private to the mailbox owner; text is the first text/plain part. */
export const createGmailConnector = (config: GmailConfig): SourceConnector => {
  const maxPages = pageCap(config.maxPages, DEFAULT_MAX_PAGES);
  retryCap(config.retries, DEFAULT_RETRIES); // the client is built per call, so check `retries` here, when the connector is created
  const client = (token: string) => {
    const oauth = new auth.OAuth2();
    oauth.setCredentials({ access_token: token });
    return gmail({
      version: "v1",
      auth: oauth,
      retryConfig: googleRetry(config.retries, config.maxWaitSeconds),
      ...(config.rootUrl ? { rootUrl: config.rootUrl } : {}),
    });
  };
  return {
    id: config.id,
    enforcesUserToken: true,
    async list({ cursor, limit }) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new RangeError("limit must be an integer from 1 to 500");
      const api = client(config.listToken);
      try {
        const owner = (await api.users.getProfile({ userId: "me" })).data.emailAddress ?? "";
        const { data } = await api.users.messages.list({ userId: "me", maxResults: limit, ...(cursor !== undefined && { pageToken: cursor }) });
        const ids = (data.messages ?? []).flatMap((m) => (m.id ? [m.id] : []));
        const meta = await Promise.all(ids.map((id) => api.users.messages.get({ userId: "me", id, format: "metadata", metadataHeaders: ["Subject"] })));
        const items = meta.map((r, i) => mapMessage({ ...r.data, id: ids[i] as string }, owner, config.zone ?? "personal"));
        return data.nextPageToken ? { items, nextCursor: data.nextPageToken } : { items };
      } catch (error) {
        throw cursor !== undefined && statusOf(error) === 400 ? badCursor() : toConnectorError(error, "list");
      }
    },
    async fetch(address, { token }) {
      return guarded(address, async () => {
        const { data } = await client(token).users.messages.get({ userId: "me", id: address, format: "full" });
        const doc = toText(data);
        if (!doc) throw new ConnectorError("NOT_FOUND", `No plain text in message: ${address}`);
        return doc;
      });
    },
    async canRead(address, { token }) {
      try {
        await client(token).users.messages.get({ userId: "me", id: address, format: "minimal" });
        return true;
      } catch (error) {
        const status = statusOf(error);
        if (!isRateLimited(error) && (status === 404 || status === 403)) return false;
        throw toConnectorError(error, "canRead");
      }
    },
    async changes({ token, cursor }) {
      return guarded("changes", () => changesSince(client(token), cursor, maxPages));
    },
  };
};
