import { contentHash } from "@brain/connector-kit";
import type { Acl } from "@brain/core-types";

const unique = (values: readonly string[]): string[] => [...new Set(values)].sort();

/** Sorted, de-duplicated principals; `version` is a stable 32-bit digest, so any membership change bumps it. */
export const buildAcl = (users: readonly string[], groups: readonly string[]): Acl => {
  const allowUsers = unique(users);
  const allowGroups = unique(groups);
  const digest = contentHash(JSON.stringify([allowUsers, allowGroups])).slice(0, 8);
  return { allowUsers, allowGroups, version: Number.parseInt(digest, 16) };
};
