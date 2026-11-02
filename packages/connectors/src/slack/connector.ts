import { WebClient } from "@slack/web-api";
import type { CommonConfig, SourceConnector } from "../shared/types.js";
import { changesSince } from "./changes.js";
import { guardSlack, mapChannel, slackCode, TYPES, toText } from "./map.js";
import { listSlackMembers } from "./members.js";

export type SlackConfig = CommonConfig & { baseUrl?: string; retries?: number; now?: () => number };

/** Slack adapter: each channel is one document (its recent history); public channels read as the workspace group, private ones as their own. */
export const createSlackConnector = (config: SlackConfig): SourceConnector => {
  const client = (token: string) =>
    new WebClient(token, {
      ...(config.baseUrl && { slackApiUrl: config.baseUrl }),
      ...(config.retries !== undefined && { retryConfig: { retries: config.retries } }),
    });
  return {
    id: config.id,
    enforcesUserToken: true,
    async list({ cursor, limit }) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new RangeError("limit must be an integer from 1 to 1000");
      const page = await guardSlack("list", () =>
        client(config.listToken).conversations.list({ types: TYPES, exclude_archived: true, limit, ...(cursor !== undefined && { cursor }) }),
      );
      const items = (page.channels ?? []).flatMap((c) => (c.id ? [mapChannel({ ...c, id: c.id }, config.zone ?? "company")] : []));
      const nextCursor = page.response_metadata?.next_cursor;
      return nextCursor ? { items, nextCursor } : { items };
    },
    async fetch(address, { token }) {
      return guardSlack(address, async () => toText((await client(token).conversations.history({ channel: address, limit: 200 })).messages ?? []));
    },
    async canRead(address, { token }) {
      try {
        await client(token).conversations.info({ channel: address });
        return true;
      } catch (error) {
        const code = slackCode(error);
        if (code === "channel_not_found" || code === "not_in_channel") return false;
        throw error;
      }
    },
    async listMemberships() {
      return guardSlack("memberships", () => listSlackMembers(client(config.listToken)));
    },
    async changes({ token, cursor }) {
      return guardSlack("changes", () => changesSince(client(token), cursor, config.now ?? Date.now));
    },
  };
};
