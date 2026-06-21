import type { NextConfig } from "next";

export function resolveNextConfig(
  env: Record<string, string | undefined> = process.env,
): NextConfig {
  const distDir = env["NEXT_DIST_DIR"];
  const output = env["NEXT_OUTPUT"] === "export" ? "export" : undefined;

  return {
    reactStrictMode: true,
    typedRoutes: true,
    ...(distDir ? { distDir } : {}),
    ...(output ? { output } : {}),
  };
}

export default resolveNextConfig();
