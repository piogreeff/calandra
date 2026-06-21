import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function parseEnvKeys(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#") && line.includes("="))
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .filter((key) => /^[A-Z0-9_]+$/.test(key));
}

export function findMissingEnvDocs(envKeys: string[], docsContent: string): string[] {
  return envKeys.filter((key) => !docsContent.includes(key));
}

function main(): void {
  const root = process.cwd();
  const envExample = readFileSync(join(root, ".env.example"), "utf8");
  const selfHosting = readFileSync(join(root, "docs", "SELF_HOSTING.md"), "utf8");
  const missing = findMissingEnvDocs(parseEnvKeys(envExample), selfHosting);

  if (missing.length > 0) {
    console.error(`docs-current failed: document these .env.example keys in docs/SELF_HOSTING.md:\n${missing.join("\n")}`);
    process.exit(1);
  }

  console.log("docs-current verified.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
