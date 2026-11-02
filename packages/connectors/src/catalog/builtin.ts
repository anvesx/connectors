import { driveManifest } from "../drive/manifest.js";
import { githubManifest } from "../github/manifest.js";
import { createRegistry, type Registry } from "./registry.js";
import type { Manifest } from "./types.js";

/** A registry holding every manifest that ships with this package. A new app adds one line here. */
export function createBuiltinRegistry(): Registry {
  const r = createRegistry();
  r.register(githubManifest);
  r.register(driveManifest);
  return r;
}

/** Whether the adapter can recheck a reader at the source. Without it (or if it cannot even be built), a connector may only hold personal data. */
export function hasLiveRecheck(m: Manifest): boolean {
  const probe = m.needsRepo ? { owner: "probe", name: "probe" } : undefined;
  try {
    return typeof m.load({ id: "probe", listToken: "", ...(probe && { repo: probe }) }).canRead === "function";
  } catch {
    return false;
  }
}
