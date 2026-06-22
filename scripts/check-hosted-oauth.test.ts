import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { join, normalize } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateHostedOAuthReadiness,
  getWranglerSecretListCommand,
  parseSecretList,
  parseStatusResponse,
} from "./check-hosted-oauth";

const require = createRequire(import.meta.url);

describe("hosted OAuth readiness check", () => {
  it("parses Worker secret names from wrangler JSON", () => {
    expect(
      parseSecretList(
        JSON.stringify([
          { name: "GGG_TOKEN_ENCRYPTION_KEY", type: "secret_text" },
          { name: "SNAPSHOT_WRITE_TOKEN", type: "secret_text" },
        ]),
      ),
    ).toEqual(["GGG_TOKEN_ENCRYPTION_KEY", "SNAPSHOT_WRITE_TOKEN"]);
  });

  it("parses the safe public hosted OAuth status response", () => {
    expect(
      parseStatusResponse(
        JSON.stringify({
          source: "ggg-oauth-status",
          configured: false,
          redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
          requiredScopes: ["account:characters"],
          features: { accountLinking: false, snapshotCapture: false },
        }),
      ),
    ).toEqual({
      configured: false,
      redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
      accountLinking: false,
      snapshotCapture: false,
    });
  });

  it("uses the local Wrangler CLI through node instead of spawning pnpm", () => {
    const command = getWranglerSecretListCommand("C:/repo");

    expect(command).toEqual({
      command: process.execPath,
      args: [
        normalize("C:/repo/apps/api/node_modules/wrangler/bin/wrangler.js"),
        "secret",
        "list",
      ],
      cwd: join("C:/repo", "apps/api"),
    });
  });

  it("reports the current hosted blocker when the API is not configured", () => {
    expect(
      evaluateHostedOAuthReadiness({
        secretNames: ["GGG_TOKEN_ENCRYPTION_KEY", "SNAPSHOT_WRITE_TOKEN"],
        status: {
          configured: false,
          redirectUri: "https://calandra.pages.dev/auth/ggg/callback",
          accountLinking: false,
          snapshotCapture: false,
        },
      }),
    ).toEqual({
      ok: false,
      issues: [
        "live API reports GGG OAuth is not configured",
        "GGG_OAUTH_CLIENT_ID is not visible as a Worker secret; set it as a Worker secret or deployed var",
      ],
      warnings: [
        "GGG_OAUTH_CLIENT_SECRET is not present; token exchange only works if the GGG app is public",
      ],
    });
  });

  it("starts as a tsx CLI without calling the network for help", () => {
    const output = execFileSync(
      process.execPath,
      [require.resolve("tsx/cli"), "scripts/check-hosted-oauth.ts", "--help"],
      { encoding: "utf8" },
    );

    expect(output).toContain("Usage: pnpm hosted:oauth:check");
  });
});
