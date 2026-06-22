import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import GggOAuthCallbackPage from "../src/app/auth/ggg/callback/page";
import { getGggOAuthCallbackRequest } from "../src/components/GggOAuthCallback";

vi.stubGlobal("React", React);

describe("GGG OAuth callback page", () => {
  it("renders the static callback shell for browser completion", () => {
    const html = renderToStaticMarkup(<GggOAuthCallbackPage />);

    expect(html).toContain("Completing GGG account link");
    expect(html).toContain("calandra.pages.dev");
  });

  it("extracts the OAuth state and code from the callback URL", () => {
    expect(
      getGggOAuthCallbackRequest(
        "?state=oauth-state&code=authorization-code&ignored=value",
      ),
    ).toEqual({
      state: "oauth-state",
      code: "authorization-code",
    });
  });

  it("rejects callback URLs without both OAuth values", () => {
    expect(getGggOAuthCallbackRequest("?state=oauth-state")).toBeNull();
    expect(getGggOAuthCallbackRequest("?code=authorization-code")).toBeNull();
  });
});
