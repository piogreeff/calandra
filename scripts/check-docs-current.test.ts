import { describe, expect, it } from "vitest";
import { findMissingEnvDocs, parseEnvKeys } from "./check-docs-current";

describe("docs-current gate", () => {
  it("extracts environment keys from .env.example content", () => {
    expect(
      parseEnvKeys(`
NODE_ENV=development
# comments are ignored
APP_URL=https://calandra.pages.dev
EMPTY_ALLOWED=
`)
    ).toEqual(["NODE_ENV", "APP_URL", "EMPTY_ALLOWED"]);
  });

  it("reports env keys that are missing from self-hosting docs", () => {
    const missing = findMissingEnvDocs(["APP_URL", "API_URL", "GGG_USER_AGENT"], "APP_URL and API_URL are documented.");

    expect(missing).toEqual(["GGG_USER_AGENT"]);
  });
});
