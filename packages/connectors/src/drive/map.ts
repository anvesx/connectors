import type { ListedDoc } from "@brain/connector-kit";
import type { Acl, Zone } from "@brain/core-types";
import { buildAcl } from "../shared/acl.js";
import type { ChangeEvent } from "../shared/types.js";

export type DrivePermission = { type?: string | null; emailAddress?: string | null; domain?: string | null; deleted?: boolean | null };
export type DriveFile = { id?: string | null; name?: string | null; version?: string | null; modifiedTime?: string | null; permissions?: DrivePermission[] };
export type DriveChange = { fileId?: string | null; removed?: boolean | null; file?: { trashed?: boolean | null } | null };

export const DOC_MIME = "application/vnd.google-apps.document";
export const LIST_QUERY = `trashed = false and (mimeType contains 'text/' or mimeType = '${DOC_MIME}')`;
export const LIST_FIELDS = "nextPageToken, files(id, name, mimeType, version, modifiedTime, permissions(type, emailAddress, domain, deleted))";

/** Every live grant lets the principal read: users and groups by email, a domain as `domain:<name>`, link sharing as `anyone`. */
export const mapAcl = (permissions: readonly DrivePermission[] = []): Acl => {
  const live = permissions.filter((p) => !p.deleted);
  const users = live.flatMap((p) => (p.type === "user" && p.emailAddress ? [p.emailAddress] : []));
  const groups = live.flatMap((p) => {
    if (p.type === "group" && p.emailAddress) return [p.emailAddress];
    if (p.type === "domain" && p.domain) return [`domain:${p.domain}`];
    return p.type === "anyone" ? ["anyone"] : [];
  });
  return buildAcl(users, groups);
};

export const mapDoc = (file: DriveFile & { id: string }, zone: Zone): ListedDoc => ({
  address: file.id,
  title: file.name ?? file.id,
  version: file.version ?? "0",
  acl: mapAcl(file.permissions),
  zone,
  updatedAt: file.modifiedTime ?? new Date(0).toISOString(),
});

export const mapChanges = (changes: readonly DriveChange[]): ChangeEvent[] =>
  changes.flatMap((c): ChangeEvent[] => (c.fileId ? [{ address: c.fileId, kind: c.removed || c.file?.trashed ? "delete" : "upsert" }] : []));
