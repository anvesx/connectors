import type { Membership } from "@anvesx/connector-kit";
import type { WebClient } from "@slack/web-api";
import { channelGroup, pages, WORKSPACE } from "./map.js";

/** The workspace group holds every active human; each private channel's group holds that channel's members. */
export const listSlackMembers = async (api: WebClient): Promise<Membership[]> => {
  const users = (await pages((cursor) => api.users.list({ limit: 200, ...(cursor && { cursor }) }))).flatMap((p) => p.members ?? []);
  const out: Membership[] = users.flatMap((u) => (u.id && !u.deleted && !u.is_bot && u.id !== "USLACKBOT" ? [{ group: WORKSPACE, user: u.id }] : []));
  const channels = (
    await pages((cursor) => api.conversations.list({ types: "private_channel", exclude_archived: true, limit: 200, ...(cursor && { cursor }) }))
  ).flatMap((p) => p.channels ?? []);
  for (const channel of channels) {
    if (!channel.id) continue;
    const id = channel.id;
    const ids = (await pages((cursor) => api.conversations.members({ channel: id, limit: 200, ...(cursor && { cursor }) }))).flatMap((p) => p.members ?? []);
    out.push(...ids.map((user) => ({ group: channelGroup(id), user })));
  }
  return out;
};
