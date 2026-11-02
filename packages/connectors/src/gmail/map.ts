import type { ListedDoc } from "@brain/connector-kit";
import type { Zone } from "@brain/core-types";
import type { gmail_v1 } from "@googleapis/gmail";
import { buildAcl } from "../shared/acl.js";
import type { ChangeEvent } from "../shared/types.js";

type Message = gmail_v1.Schema$Message;
type Part = gmail_v1.Schema$MessagePart;
type HistoryRecord = gmail_v1.Schema$History;

const header = (m: Message, name: string): string | undefined => m.payload?.headers?.find((h) => h.name?.toLowerCase() === name)?.value ?? undefined;
const decode = (data: string): string => Buffer.from(data, "base64url").toString("utf8");

/** A message is private to the mailbox it sits in, so the ACL is that one address. */
export const mapMessage = (m: Message & { id: string }, owner: string, zone: Zone): ListedDoc => ({
  address: m.id,
  title: header(m, "subject") || "(no subject)",
  version: m.historyId ?? "0",
  acl: buildAcl([owner], []),
  zone,
  updatedAt: new Date(Number(m.internalDate ?? 0)).toISOString(),
});

const plain = (part: Part | undefined): string | undefined => {
  if (!part) return undefined;
  if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
  for (const child of part.parts ?? []) {
    const found = plain(child);
    if (found !== undefined) return found;
  }
  return undefined;
};

/** The first `text/plain` part under a Subject and From header; `undefined` when the message has none. */
export const toText = (m: Message): { text: string; version: string } | undefined => {
  const body = plain(m.payload ?? undefined);
  if (body === undefined) return undefined;
  return { text: `Subject: ${header(m, "subject") ?? ""}\nFrom: ${header(m, "from") ?? ""}\n\n${body}`, version: m.historyId ?? "0" };
};

/** Records are in history order, so a message's last event wins. */
export const mapHistory = (records: readonly HistoryRecord[]): ChangeEvent[] => {
  const last = new Map<string, ChangeEvent["kind"]>();
  for (const r of records) {
    for (const a of r.messagesAdded ?? []) if (a.message?.id) last.set(a.message.id, "upsert");
    for (const d of r.messagesDeleted ?? []) if (d.message?.id) last.set(d.message.id, "delete");
  }
  return [...last].map(([address, kind]) => ({ address, kind }));
};
