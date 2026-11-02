# unit tests

- `rules.test.ts` each rule fires on a fake, stub or mock and stays quiet on honest code
- `scan.test.ts` the scan finds files under every tier folder, `packages/` included, and counts what it checked
- `baseline.test.ts` the shrink-only ratchet: new findings fail, vanished findings fail, an equal set passes

All inputs are written to a temporary directory.
