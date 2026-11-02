import type { Manifest } from "../catalog/types.js";
import { createDriveConnector } from "./connector.js";

/** Google Drive as a catalog entry. It signs in through the shared `google` OAuth client. */
export const driveManifest: Manifest = {
  id: "drive",
  name: "Google Drive",
  defaultZone: "team",
  auth: {
    kind: "oauth2",
    app: "google",
    authorizeURL: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenURL: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    pkce: true,
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  load: ({ id, listToken, baseUrl }) => createDriveConnector({ id, listToken, zone: driveManifest.defaultZone, ...(baseUrl && { rootUrl: baseUrl }) }),
};
