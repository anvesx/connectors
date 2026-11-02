import type { Manifest } from "../catalog/registry/types.js";
import { createGmailConnector } from "./connector.js";

/** Gmail as a catalog entry. It signs in through the shared `google` OAuth client; mail is private by default. */
export const gmailManifest: Manifest = {
  id: "gmail",
  name: "Gmail",
  defaultZone: "personal",
  auth: {
    kind: "oauth2",
    app: "google",
    authorizeURL: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenURL: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    pkce: true,
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  load: ({ id, listToken, baseUrl }) => createGmailConnector({ id, listToken, zone: gmailManifest.defaultZone, ...(baseUrl && { rootUrl: baseUrl }) }),
};
