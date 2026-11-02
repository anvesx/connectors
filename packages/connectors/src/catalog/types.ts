import type { Connector } from "@brain/connector-kit";
import type { Zone } from "@brain/core-types";

/** `app` names the OAuth client (id and secret) the sign-in uses; manifests with the same `app` share one client. It defaults to the manifest id. */
export type OAuth2Auth = {
  kind: "oauth2";
  app?: string;
  authorizeURL: string;
  tokenURL: string;
  scopes: string[];
  pkce: boolean;
  extraParams: Record<string, string>;
};
export type Auth = OAuth2Auth | { kind: "token" } | { kind: "pat" };

/** What `load` builds one account's adapter from. `baseUrl` points the adapter at another host (Enterprise, a test server). */
export type LoadConfig = { id: string; listToken: string; baseUrl?: string; repo?: { owner: string; name: string } };

/** A connector app as data: how to sign in, the zone its documents default to, and how to build its adapter. */
export type Manifest = {
  id: string;
  name: string;
  auth: Auth;
  defaultZone: Zone;
  /** True when one account covers one `owner/name` repository, so `load` needs `repo`. */
  needsRepo?: boolean;
  load(config: LoadConfig): Connector;
};
