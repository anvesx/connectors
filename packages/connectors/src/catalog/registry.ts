import type { Manifest } from "./types.js";

export type Listed = { manifest: Manifest /** Set for a tenant's custom entry, absent for a built-in. */; tenant?: string };
export type Registry = {
  /** Adds a built-in, or a custom entry visible only to `tenant`. Throws on a duplicate or an unsafe id. */
  register(manifest: Manifest, tenant?: string): void;
  get(id: string, tenant?: string): Manifest | undefined;
  /** Built-ins first, then `tenant`'s own entries. */
  list(tenant?: string): Listed[];
};

/** Lowercase letters, digits and dashes: safe inside a graph source `<id>:<account>` and a token-file key. */
export const ID = /^[a-z][a-z0-9-]{0,31}$/;

export function createRegistry(): Registry {
  const builtin = new Map<string, Manifest>();
  const custom = new Map<string, Map<string, Manifest>>();
  const get: Registry["get"] = (id, tenant) => builtin.get(id) ?? (tenant === undefined ? undefined : custom.get(tenant)?.get(id));
  return {
    get,
    register(m, tenant) {
      if (!ID.test(m.id)) throw new RangeError("id must be 1-32 lowercase letters, digits or dashes, starting with a letter");
      if (get(m.id, tenant) !== undefined) throw new RangeError(`manifest already registered: ${m.id}`);
      if (tenant === undefined) builtin.set(m.id, m);
      else custom.set(tenant, (custom.get(tenant) ?? new Map()).set(m.id, m));
    },
    list(tenant) {
      const own = tenant === undefined ? [] : [...(custom.get(tenant)?.values() ?? [])];
      return [...[...builtin.values()].map((manifest) => ({ manifest })), ...own.map((manifest) => ({ manifest, tenant: tenant as string }))];
    },
  };
}
