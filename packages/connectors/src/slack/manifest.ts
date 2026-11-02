import type { Manifest } from "../catalog/types.js";
import { createSlackConnector } from "./connector.js";

/** Slack as a catalog entry: channels are company-wide by default, and the ACL narrows private ones. */
export const slackManifest: Manifest = {
  id: "slack",
  name: "Slack",
  defaultZone: "company",
  auth: {
    kind: "oauth2",
    app: "slack",
    authorizeURL: "https://slack.com/oauth/v2/authorize",
    tokenURL: "https://slack.com/api/oauth.v2.access",
    scopes: ["channels:read", "channels:history", "groups:read", "groups:history", "users:read"],
    pkce: false,
    extraParams: {},
  },
  load: ({ id, listToken, baseUrl }) => createSlackConnector({ id, listToken, zone: slackManifest.defaultZone, ...(baseUrl && { baseUrl }) }),
};
