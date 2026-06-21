import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type PackageManifest = {
  name?: string;
  private?: boolean;
  license?: string;
};

type ManifestRecord = {
  path: string;
  manifest: PackageManifest;
};

const forbiddenLicenses = new Set(["AGPL-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later"]);

export function validatePackageManifestLicenses(records: ManifestRecord[]): string[] {
  return records.flatMap(({ path, manifest }) => {
    if (manifest.private === true) {
      return [];
    }

    if (!manifest.license) {
      return [`${path}: public package is missing a license`];
    }

    if (forbiddenLicenses.has(manifest.license)) {
      return [`${path}: license ${manifest.license} is not allowed`];
    }

    return [];
  });
}

export function collectDependencyPackageJsonPaths(paths: string[]): string[] {
  return paths.filter((path) => {
    const normalized = path.replaceAll("\\", "/");
    const packagePath = normalized.split("/node_modules/")[1];
    if (!normalized.startsWith("node_modules/.pnpm/") || !packagePath?.endsWith("/package.json")) {
      return false;
    }

    const packageSegments = packagePath.split("/");
    return packageSegments.length === 2 || (packageSegments[0]?.startsWith("@") && packageSegments.length === 3);
  });
}

function listPackageJsonPaths(root: string, current: string): string[] {
  return readdirSync(join(root, current), { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(current, entry.name);

    if (entry.isDirectory()) {
      return listPackageJsonPaths(root, entryPath);
    }

    return entry.name === "package.json" ? [entryPath] : [];
  });
}

function findWorkspacePackageJsons(root: string): string[] {
  const packageJsons = ["package.json"];

  for (const workspaceRoot of ["apps", "packages"]) {
    const absoluteWorkspaceRoot = join(root, workspaceRoot);
    if (!existsSync(absoluteWorkspaceRoot)) {
      continue;
    }

    for (const entry of readdirSync(absoluteWorkspaceRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        packageJsons.push(join(workspaceRoot, entry.name, "package.json"));
      }
    }
  }

  return packageJsons;
}

function readManifest(root: string, path: string): ManifestRecord {
  return {
    path,
    manifest: JSON.parse(readFileSync(join(root, path), "utf8")) as PackageManifest
  };
}

function main(): void {
  const root = process.cwd();
  const dependencyRoot = join(root, "node_modules", ".pnpm");
  const dependencyPackageJsons = existsSync(dependencyRoot)
    ? collectDependencyPackageJsonPaths(listPackageJsonPaths(root, join("node_modules", ".pnpm")))
    : [];
  const records = [...findWorkspacePackageJsons(root), ...dependencyPackageJsons]
    .filter((path) => existsSync(join(root, path)))
    .map((path) => readManifest(root, path));
  const failures = validatePackageManifestLicenses(records);

  if (failures.length > 0) {
    console.error(`license check failed:\n${failures.join("\n")}`);
    process.exit(1);
  }

  console.log("package license manifests verified.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
