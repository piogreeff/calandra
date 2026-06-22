import { describe, expect, it } from "vitest";
import { resolveInitialGggAccount } from "../src/components/GggOAuthLinkPanel";

describe("GggOAuthLinkPanel helpers", () => {
  it("uses the account query parameter when it is present", () => {
    expect(resolveInitialGggAccount("example", "?account=Pio%20Account")).toBe(
      "Pio Account",
    );
  });

  it("falls back to the configured default account for blank query values", () => {
    expect(resolveInitialGggAccount("example", "?account=%20%20")).toBe(
      "example",
    );
    expect(resolveInitialGggAccount("example", "")).toBe("example");
  });
});
