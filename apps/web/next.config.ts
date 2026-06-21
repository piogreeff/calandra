import type { NextConfig } from "next";

export function resolveNextConfig(
  env: Record<string, string | undefined> = process.env,
): NextConfig {
  const distDir = env["NEXT_DIST_DIR"];

  return {
    reactStrictMode: true,
    typedRoutes: true,
    ...(distDir ? { distDir } : {}),
  };
}

export default resolveNextConfig();
