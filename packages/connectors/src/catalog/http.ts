import { type Connector, ConnectorError, type ListedDoc } from "@anvesx/connector-kit";
import { AclSchema } from "@anvesx/core-types";
import type { Auth, Manifest } from "./types.js";

/** What an admin registers: sign-in settings plus an HTTP endpoint that speaks the connector contract. */
export type CustomSpec = { id: string; name: string; auth: Auth; defaultZone: Manifest["defaultZone"]; endpoint: string; canRead: boolean };

const isDoc = (d: unknown): d is ListedDoc => {
  const o = d as Record<string, unknown>;
  return (
    typeof o === "object" &&
    o !== null &&
    ["address", "title", "version", "updatedAt"].every((k) => typeof o[k] === "string") &&
    AclSchema.safeParse(o.acl).success
  );
};

const post = async (url: string, token: string, body: unknown): Promise<unknown> => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (res.status === 404) throw new ConnectorError("NOT_FOUND", `not found at ${url}`);
  if (res.status === 403) throw new ConnectorError("FORBIDDEN", `forbidden at ${url}`);
  if (!res.ok) throw new Error(`custom connector answered ${res.status}`);
  return res.json();
};

/**
 * A manifest whose adapter calls `POST <endpoint>/list`, `/fetch` and (only when `canRead` is declared) `/can-read` with the caller's token as a bearer.
 * Listed documents are checked for shape and take the manifest's default zone; the endpoint cannot pick its own.
 */
export function customManifest(s: CustomSpec): Manifest {
  const base = s.endpoint.replace(/\/+$/, "");
  return {
    id: s.id,
    name: s.name,
    auth: s.auth,
    defaultZone: s.defaultZone,
    load({ id, listToken }) {
      const c: Connector = {
        id,
        enforcesUserToken: true,
        async list(q) {
          const r = (await post(`${base}/list`, listToken, q)) as { items?: unknown; nextCursor?: unknown };
          if (!Array.isArray(r.items) || !r.items.every(isDoc)) throw new Error("custom connector returned a bad list");
          const items = r.items.map((d) => ({ ...d, zone: s.defaultZone }));
          return typeof r.nextCursor === "string" ? { items, nextCursor: r.nextCursor } : { items };
        },
        async fetch(address, ctx) {
          const r = (await post(`${base}/fetch`, ctx.token, { address })) as { text?: unknown; version?: unknown };
          if (typeof r.text !== "string" || typeof r.version !== "string") throw new Error("custom connector returned a bad document");
          return { text: r.text, version: r.version };
        },
      };
      if (s.canRead) c.canRead = async (address, ctx) => ((await post(`${base}/can-read`, ctx.token, { address })) as { allowed?: unknown }).allowed === true;
      return c;
    },
  };
}
