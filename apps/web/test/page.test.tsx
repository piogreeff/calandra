import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import Home from "../src/app/page";

vi.stubGlobal("React", React);

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

describe("home dashboard", () => {
  it("shows deterministic advisor rankings and temporary endpoints", async () => {
    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Deterministic upgrade rankings");
    expect(html).toContain("Duskthread Grips");
    expect(html).toContain("+43.4");
    expect(html).toContain("14.47 / chaos");
    expect(html).toContain("No LLM values");
    expect(html).toContain("calandra-api.workers.dev");
    expect(html).toContain("calandra.pages.dev");
  });
});
