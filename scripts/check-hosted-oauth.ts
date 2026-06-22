import { execFileSync } from "node:child_process";
import { join, normalize } from "node:path";
import { pathToFileURL } from "node:url";

const defaultApiUrl = "https://calandra-api.piogreeff.workers.dev";
const requiredSecretNames = [
  "GGG_OAUTH_CLIENT_ID",
  "GGG_TOKEN_ENCRYPTION_KEY",
] as const;

type HostedOAuthStatus = {
  configured: boolean;
  redirectUri: string;
  accountLinking: boolean;
  snapshotCapture: boolean;
};

export function getWranglerSecretListCommand(rootDir = process.cwd()) {
  const cwd = join(rootDir, "apps/api");

  return {
    command: process.execPath,
    args: [
      normalize(join(cwd, "node_modules/wrangler/bin/wrangler.js")),
      "secret",
      "list",
    ],
    cwd,
  };
}

export function parseSecretList(raw: string) {
  const value = JSON.parse(raw) as unknown;

  if (!Array.isArray(value)) {
    throw new Error("wrangler secret list did not return an array");
  }

  return value
    .map((entry) =>
      typeof entry === "object" && entry !== null && "name" in entry
        ? (entry as { name?: unknown }).name
        : undefined,
    )
    .filter((name): name is string => typeof name === "string");
}

export function parseStatusResponse(raw: string): HostedOAuthStatus {
  const value = JSON.parse(raw) as {
    configured?: unknown;
    redirectUri?: unknown;
    features?: {
      accountLinking?: unknown;
      snapshotCapture?: unknown;
    };
  };

  if (
    typeof value.configured !== "boolean" ||
    typeof value.redirectUri !== "string"
  ) {
    throw new Error("hosted OAuth status response is missing required fields");
  }

  return {
    configured: value.configured,
    redirectUri: value.redirectUri,
    accountLinking: value.features?.accountLinking === true,
    snapshotCapture: value.features?.snapshotCapture === true,
  };
}

export function evaluateHostedOAuthReadiness(input: {
  secretNames: readonly string[];
  status: HostedOAuthStatus;
  expectedRedirectUri?: string;
}) {
  const secretSet = new Set(input.secretNames);
  const issues: string[] = [];
  const warnings: string[] = [];
  const expectedRedirectUri = input.expectedRedirectUri?.trim();

  if (!input.status.configured) {
    issues.push("live API reports GGG OAuth is not configured");
  }

  if (
    expectedRedirectUri &&
    input.status.redirectUri !== expectedRedirectUri
  ) {
    issues.push(
      `live API redirect URI ${input.status.redirectUri} does not match registered GGG redirect URI ${expectedRedirectUri}`,
    );
  }

  for (const name of requiredSecretNames) {
    if (!secretSet.has(name)) {
      issues.push(
        name === "GGG_OAUTH_CLIENT_ID"
          ? "GGG_OAUTH_CLIENT_ID is not visible as a Worker secret; set it as a Worker secret or deployed var"
          : `${name} is missing from Worker secrets`,
      );
    }
  }

  if (!secretSet.has("GGG_OAUTH_CLIENT_SECRET")) {
    warnings.push(
      "GGG_OAUTH_CLIENT_SECRET is not present; token exchange only works if the GGG app is public",
    );
  }

  return {
    ok:
      issues.length === 0 &&
      input.status.accountLinking &&
      input.status.snapshotCapture,
    issues,
    warnings,
  };
}

async function main() {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }

  const apiUrl = getArgValue("--api-url") ?? defaultApiUrl;
  const expectedRedirectUri =
    getArgValue("--registered-redirect-uri") ??
    process.env.GGG_OAUTH_REDIRECT_URI;
  const wrangler = getWranglerSecretListCommand();
  const secretListOutput = execFileSync(wrangler.command, wrangler.args, {
    cwd: wrangler.cwd,
    encoding: "utf8",
  });
  const statusResponse = await fetch(
    `${apiUrl.replace(/\/$/, "")}/auth/ggg/status`,
  );
  const statusBody = await statusResponse.text();
  const secretNames = parseSecretList(secretListOutput);
  const status = parseStatusResponse(statusBody);
  const readiness = evaluateHostedOAuthReadiness({
    secretNames,
    status,
    expectedRedirectUri,
  });

  console.log(`Calandra hosted OAuth readiness`);
  console.log(`API: ${apiUrl}`);
  console.log(`Redirect: ${status.redirectUri}`);
  if (expectedRedirectUri) {
    console.log(`Registered redirect: ${expectedRedirectUri}`);
  }
  console.log(
    `Account linking: ${status.accountLinking ? "enabled" : "disabled"}`,
  );
  console.log(
    `Snapshot capture: ${status.snapshotCapture ? "enabled" : "disabled"}`,
  );
  console.log(`Worker secrets: ${secretNames.join(", ") || "(none)"}`);

  for (const issue of readiness.issues) {
    console.error(`Issue: ${issue}`);
  }

  for (const warning of readiness.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  process.exitCode = readiness.ok ? 0 : 1;
}

function getArgValue(name: string) {
  const prefix = `${name}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

function printHelp() {
  console.log(
    "Usage: pnpm hosted:oauth:check [--api-url=https://calandra-api.piogreeff.workers.dev] [--registered-redirect-uri=https://calandra.pages.dev/auth/ggg/callback]",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
