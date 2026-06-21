import { describe, expect, it } from "vitest";
import { collectDependencyPackageJsonPaths, validatePackageManifestLicenses } from "./check-licenses";

describe("license gate", () => {
  it("allows private packages without package-level licenses", () => {
    expect(
      validatePackageManifestLicenses([
        { path: "apps/api/package.json", manifest: { name: "@calandra/api", private: true } }
      ])
    ).toEqual([]);
  });

  it("requires public package manifests to declare a license", () => {
    expect(
      validatePackageManifestLicenses([{ path: "package.json", manifest: { name: "calandra" } }])
    ).toEqual(["package.json: public package is missing a license"]);
  });

  it("rejects forbidden package licenses", () => {
    expect(
      validatePackageManifestLicenses([
        { path: "package.json", manifest: { name: "calandra", license: "AGPL-3.0-only" } }
      ])
    ).toEqual(["package.json: license AGPL-3.0-only is not allowed"]);
  });

  it("collects pnpm dependency package manifests", () => {
    const paths = collectDependencyPackageJsonPaths([
      "node_modules/.pnpm/zod@3.25.76/node_modules/zod/package.json",
      "node_modules/.pnpm/@types+node@20.19.43/node_modules/@types/node/package.json",
      "node_modules/.pnpm/hono@4.12.26/node_modules/hono/dist/cjs/package.json",
      "node_modules/.pnpm/lock.yaml"
    ]);

    expect(paths).toEqual([
      "node_modules/.pnpm/zod@3.25.76/node_modules/zod/package.json",
      "node_modules/.pnpm/@types+node@20.19.43/node_modules/@types/node/package.json"
    ]);
  });
});
