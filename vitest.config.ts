import { defineConfig } from "vitest/config";

// Shared by every package: each runs `vitest run --config ../../vitest.config.ts`, so the package
// root stays at five files (structure lint, ADR 0007). Paths are relative to the package folder.
export default defineConfig({ test: { include: ["tests/**/*.test.ts"], coverage: { thresholds: { lines: 90 } } } });
