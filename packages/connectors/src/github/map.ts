import type { ListedDoc } from "@brain/connector-kit";
import type { Acl, Zone } from "@brain/core-types";
import { buildAcl } from "../shared/acl.js";
import type { ChangeEvent } from "../shared/types.js";

export type TreeEntry = { path?: string; type?: string; sha?: string; size?: number };
export type CompareFile = { filename: string; status: string; previous_filename?: string };

export const MAX_BLOB_BYTES = 1_000_000;

export const isListable = (entry: TreeEntry): entry is TreeEntry & { path: string; sha: string } =>
  entry.type === "blob" && entry.path !== undefined && entry.sha !== undefined && (entry.size ?? 0) <= MAX_BLOB_BYTES;

/** Repo-level ACL: collaborators are users, teams are `owner/slug` groups, a public repo adds the `public` group. */
export const mapAcl = (collaborators: { login: string }[], teams: { slug: string }[], owner: string, isPrivate: boolean): Acl =>
  buildAcl(
    collaborators.map((c) => c.login),
    [...teams.map((t) => `${owner}/${t.slug}`), ...(isPrivate ? [] : ["public"])],
  );

export const mapDoc = (entry: TreeEntry & { path: string; sha: string }, acl: Acl, updatedAt: string, zone: Zone): ListedDoc => ({
  address: entry.path,
  title: entry.path.split("/").pop() ?? entry.path,
  version: entry.sha,
  acl,
  zone,
  updatedAt,
});

export const mapChanges = (files: readonly CompareFile[]): ChangeEvent[] =>
  files.flatMap((file): ChangeEvent[] => {
    if (file.status === "removed") return [{ address: file.filename, kind: "delete" }];
    const moved: ChangeEvent[] = file.status === "renamed" && file.previous_filename ? [{ address: file.previous_filename, kind: "delete" }] : [];
    return [...moved, { address: file.filename, kind: "upsert" }];
  });
