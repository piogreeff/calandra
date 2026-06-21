import { describe, expect, it } from "vitest";
import { resolveNextConfig } from "../next.config";

describe("next config", () => {
  it("uses the default production dist directory unless explicitly overridden", () => {
    expect(resolveNextConfig({})).not.toHaveProperty("distDir");
  });

  it("allows the dev server to use an isolated dist directory", () => {
    expect(resolveNextConfig({ NEXT_DIST_DIR: ".next-dev" })).toMatchObject({
      distDir: ".next-dev",
      reactStrictMode: true,
      typedRoutes: true,
    });
  });

  it("enables static export only for the temporary Pages deploy path", () => {
    expect(resolveNextConfig({ NEXT_OUTPUT: "export" })).toMatchObject({
      output: "export",
    });
    expect(resolveNextConfig({ NEXT_OUTPUT: "standalone" })).not.toHaveProperty(
      "output",
    );
  });
});
