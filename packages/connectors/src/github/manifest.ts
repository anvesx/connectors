import type { Manifest } from "../catalog/types.js";
import { createGithubConnector } from "./connector.js";

/** GitHub as a catalog entry. One account covers one `owner/name` repository. */
export const githubManifest: Manifest = {
  id: "github",
  name: "GitHub",
  defaultZone: "team",
  needsRepo: true,
  auth: {
    kind: "oauth2",
    app: "github",
    authorizeURL: "https://github.com/login/oauth/authorize",
    tokenURL: "https://github.com/login/oauth/access_token",
    scopes: ["repo"],
    pkce: false,
    extraParams: {},
  },
  load({ id, listToken, baseUrl, repo }) {
    if (!repo) throw new Error("a github account needs a repo (owner/name)");
    const zone = githubManifest.defaultZone;
    return createGithubConnector({ id, listToken, owner: repo.owner, repo: repo.name, zone, ...(baseUrl && { baseUrl }) });
  },
};
