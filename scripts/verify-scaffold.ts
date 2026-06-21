import { existsSync } from "node:fs";
import { join } from "node:path";

const requiredPaths = [
  "README.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  ".env.example",
  "AGENTS.md",
  ".github/CODEOWNERS",
  "docs/ARCHITECTURE.md",
  "docs/SELF_HOSTING.md",
  "docs/spikes/2026-06-21-poe2-oauth-coverage.md",
  "docs/spikes/2026-06-21-poe2-trade-pricing.md",
  "apps/api/package.json",
  "apps/web/package.json",
  "apps/desktop/package.json",
  "apps/desktop/src-tauri/Cargo.toml",
  "apps/desktop/src-tauri/build.rs",
  "apps/desktop/src-tauri/tauri.conf.json",
  "apps/desktop/src-tauri/capabilities/default.json",
  "apps/desktop/src-tauri/src/lib.rs",
  "apps/desktop/src-tauri/src/main.rs",
  "apps/mcp/package.json",
  "apps/mobile/package.json",
  "packages/contract/package.json",
  "packages/parser/package.json",
  "packages/engine/package.json",
  "packages/dataset/package.json",
  "packages/ggg-api/package.json",
  "packages/ui/package.json",
  "packages/ui/src/index.ts",
  "packages/ui/src/theme.css",
];

const missing = requiredPaths.filter(
  (path) => !existsSync(join(process.cwd(), path)),
);

if (missing.length > 0) {
  console.error(
    `Calandra scaffold is missing required paths:\n${missing.map((path) => `- ${path}`).join("\n")}`,
  );
  process.exit(1);
}

console.log("Calandra scaffold verified.");
