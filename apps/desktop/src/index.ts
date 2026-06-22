import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import * as nativePath from "node:path";
import { win32 } from "node:path";
import {
  priceCheckTextRequestSchema,
  priceCheckTextResponseSchema,
  type Item,
  type PriceCheckTextResponse,
} from "@calandra/contract";
import {
  parseClientLogText,
  parseItemText,
  toContractItem,
  type ParsedClientLogLine,
  type ParsedClipboardItem,
} from "@calandra/parser";

export class ClipboardCaptureRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClipboardCaptureRejectedError";
  }
}

export class BuildFileWriteRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuildFileWriteRejectedError";
  }
}

export class LocalBackupRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalBackupRejectedError";
  }
}

export interface Poe2Paths {
  gameDirectory: string;
  clientLogPath: string;
  buildPlannerDirectory: string;
}

export interface ClientLogCursor {
  offset: number;
}

export interface ClientLogAppendResult {
  cursor: ClientLogCursor;
  lines: ParsedClientLogLine[];
}

export interface ClipboardCaptureRequest {
  actionId: string;
  capturedAt: string;
  userInitiated: boolean;
}

export interface ClipboardItemCapture {
  actionId: string;
  capturedAt: string;
  item: ParsedClipboardItem;
  contractItem: Item;
}

export interface ClipboardPriceCheckRequest extends ClipboardCaptureRequest {
  apiBaseUrl: string;
  league: string;
  patch: string;
  fetch?: FetchLike;
}

export interface ClipboardPriceCheckResult {
  actionId: string;
  capturedAt: string;
  capture: ClipboardItemCapture;
  priceCheck: PriceCheckTextResponse;
}

export interface BuildFileWriteRequest {
  buildPlannerDirectory: string;
  fileName: string;
  content: string;
  actionId: string;
  userInitiated: boolean;
}

export interface BuildFileWritePlan {
  actionId: string;
  outputPath: string;
  content: string;
}

export interface BuildPlannerEquipmentLine {
  slot: string;
  name: string;
}

export interface BuildPlannerUpgradeLine {
  slot: string;
  currentName: string;
  candidateName: string;
  scoreDelta: number;
  estimatedCostChaos?: number;
}

export interface BuildPlannerRecommendation {
  name: string;
  className: string;
  level: number;
  league: string;
  patch: string;
  mainSkill?: string;
  passiveSkillIds: string[];
  equipment: BuildPlannerEquipmentLine[];
  upgrades: BuildPlannerUpgradeLine[];
}

export interface BuildPlannerExportRequest {
  buildPlannerDirectory: string;
  actionId: string;
  userInitiated: boolean;
  recommendation: BuildPlannerRecommendation;
}

export type LocalBackupFileKind =
  | "loot-filter"
  | "build-file"
  | "overlay-config";

export interface LocalBackupFileRequest {
  kind: LocalBackupFileKind;
  sourcePath: string;
}

export interface LocalBackupRequest {
  gameDirectory: string;
  backupDirectory: string;
  actionId: string;
  capturedAt: string;
  userInitiated: boolean;
  files: LocalBackupFileRequest[];
}

export interface LocalBackupEntry {
  kind: LocalBackupFileKind;
  sourcePath: string;
  destinationPath: string;
}

export interface LocalBackupPlan {
  actionId: string;
  capturedAt: string;
  backupRoot: string;
  entries: LocalBackupEntry[];
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const poe2DocumentsSegments = ["Documents", "My Games", "Path of Exile 2"];

export function getDefaultPoe2Paths(homeDirectory: string): Poe2Paths {
  const gameDirectory = win32.join(
    stripTrailingSeparators(homeDirectory),
    ...poe2DocumentsSegments,
  );

  return {
    gameDirectory,
    clientLogPath: win32.join(gameDirectory, "Client.txt"),
    buildPlannerDirectory: win32.join(gameDirectory, "BuildPlanner"),
  };
}

export function createInitialClientLogCursor(
  clientLogContent: string,
): ClientLogCursor {
  return {
    offset: clientLogContent.length,
  };
}

export function readClientLogAppend(
  clientLogContent: string,
  cursor: ClientLogCursor,
): ClientLogAppendResult {
  const startingOffset =
    cursor.offset > clientLogContent.length ? 0 : cursor.offset;
  const appendedContent = clientLogContent.slice(startingOffset);
  const completeLength = completeLineLength(appendedContent);
  const completeContent = appendedContent.slice(0, completeLength);

  return {
    cursor: {
      offset: startingOffset + completeLength,
    },
    lines:
      completeContent.trim().length > 0
        ? parseClientLogText(completeContent)
        : [],
  };
}

export function captureClipboardItemText(
  clipboardText: string,
  request: ClipboardCaptureRequest,
): ClipboardItemCapture {
  if (!request.userInitiated) {
    throw new ClipboardCaptureRejectedError(
      "Clipboard item capture must be initiated by a user action",
    );
  }

  const actionId = request.actionId.trim();
  if (actionId.length === 0) {
    throw new ClipboardCaptureRejectedError(
      "Clipboard item capture requires an action id",
    );
  }

  const item = parseItemText(clipboardText);
  return {
    actionId,
    capturedAt: request.capturedAt,
    item,
    contractItem: toContractItem(item),
  };
}

export async function priceClipboardItemText(
  clipboardText: string,
  request: ClipboardPriceCheckRequest,
): Promise<ClipboardPriceCheckResult> {
  const capture = captureClipboardItemText(clipboardText, request);
  const priceCheckRequest = priceCheckTextRequestSchema.parse({
    league: request.league,
    patch: request.patch,
    text: clipboardText,
  });
  const fetchImplementation = request.fetch ?? fetch;
  const response = await fetchImplementation(
    `${normalizeBaseUrl(request.apiBaseUrl)}/price/check-text`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(priceCheckRequest),
    },
  );

  if (!response.ok) {
    throw new Error(`Calandra price check failed with HTTP ${response.status}`);
  }

  return {
    actionId: capture.actionId,
    capturedAt: capture.capturedAt,
    capture,
    priceCheck: priceCheckTextResponseSchema.parse(await response.json()),
  };
}

export function planBuildFileWrite(
  request: BuildFileWriteRequest,
): BuildFileWritePlan {
  if (!request.userInitiated) {
    throw new BuildFileWriteRejectedError(
      ".build export must be initiated by a user action",
    );
  }

  const actionId = request.actionId.trim();
  if (actionId.length === 0) {
    throw new BuildFileWriteRejectedError(
      ".build export requires an action id",
    );
  }

  const fileName = normalizeBuildFileName(request.fileName);
  const baseDirectory = win32.resolve(request.buildPlannerDirectory);
  const outputPath = win32.resolve(baseDirectory, fileName);
  if (!isPathInsideDirectory(outputPath, baseDirectory)) {
    throw new BuildFileWriteRejectedError(
      ".build export path must stay inside BuildPlanner",
    );
  }

  return {
    actionId,
    outputPath,
    content: request.content,
  };
}

export async function writeBuildFile(
  request: BuildFileWriteRequest,
): Promise<BuildFileWritePlan> {
  const plan = planBuildFileWrite(request);

  await mkdir(win32.dirname(plan.outputPath), { recursive: true });
  await writeFile(plan.outputPath, plan.content, "utf8");

  return plan;
}

export function createBuildPlannerFileContent(
  recommendation: BuildPlannerRecommendation,
) {
  return [
    "# Calandra BuildPlanner export",
    `name=${recommendation.name}`,
    `class=${recommendation.className}`,
    `level=${recommendation.level}`,
    `league=${recommendation.league}`,
    `patch=${recommendation.patch}`,
    `mainSkill=${recommendation.mainSkill ?? ""}`,
    "",
    "[passives]",
    ...recommendation.passiveSkillIds,
    "",
    "[equipment]",
    ...recommendation.equipment.map((item) => `${item.slot}=${item.name}`),
    "",
    "[upgrades]",
    ...recommendation.upgrades.map(formatBuildPlannerUpgrade),
    "",
  ].join("\n");
}

export async function exportBuildPlannerRecommendation(
  request: BuildPlannerExportRequest,
): Promise<BuildFileWritePlan> {
  return writeBuildFile({
    buildPlannerDirectory: request.buildPlannerDirectory,
    fileName: request.recommendation.name,
    content: createBuildPlannerFileContent(request.recommendation),
    actionId: request.actionId,
    userInitiated: request.userInitiated,
  });
}

export function planLocalConfigBackup(
  request: LocalBackupRequest,
): LocalBackupPlan {
  if (!request.userInitiated) {
    throw new LocalBackupRejectedError(
      "Local backup must be initiated by a user action",
    );
  }

  const actionId = request.actionId.trim();
  if (actionId.length === 0) {
    throw new LocalBackupRejectedError("Local backup requires an action id");
  }

  if (request.files.length === 0) {
    throw new LocalBackupRejectedError(
      "Local backup requires at least one file",
    );
  }

  const gameDirectory = win32.resolve(request.gameDirectory);
  const backupDirectory = win32.resolve(request.backupDirectory);
  const backupRoot = win32.resolve(
    backupDirectory,
    "Path of Exile 2",
    normalizeBackupTimestamp(request.capturedAt),
  );

  const entries = request.files.map((file) => {
    const sourcePath = win32.resolve(file.sourcePath);
    if (!isPathInsideDirectory(sourcePath, gameDirectory)) {
      throw new LocalBackupRejectedError(
        "Local backup source path must stay inside the PoE2 directory",
      );
    }

    const relativePath = win32.relative(gameDirectory, sourcePath);
    const destinationPath = win32.resolve(backupRoot, relativePath);
    if (!isPathInsideDirectory(destinationPath, backupRoot)) {
      throw new LocalBackupRejectedError(
        "Local backup destination path must stay inside the backup root",
      );
    }

    return {
      kind: file.kind,
      sourcePath,
      destinationPath,
    };
  });

  return {
    actionId,
    capturedAt: request.capturedAt,
    backupRoot,
    entries,
  };
}

export async function copyLocalConfigBackup(
  request: LocalBackupRequest,
): Promise<LocalBackupPlan> {
  const plan = planLocalConfigBackup(request);

  for (const entry of plan.entries) {
    await mkdir(win32.dirname(entry.destinationPath), { recursive: true });
    await copyFile(entry.sourcePath, entry.destinationPath);
  }

  return plan;
}

export async function discoverLocalConfigBackupFiles(
  gameDirectory: string,
): Promise<LocalBackupFileRequest[]> {
  const pathApi = getFilesystemPathApi(gameDirectory);
  const gameRoot = pathApi.resolve(gameDirectory);
  const buildPlannerDirectory = pathApi.join(gameRoot, "BuildPlanner");
  const overlayConfigPath = pathApi.join(gameRoot, "Calandra", "overlay.json");
  const files: LocalBackupFileRequest[] = [];

  files.push(
    ...(await discoverDirectoryFiles(
      gameRoot,
      ".filter",
      "loot-filter",
      pathApi,
    )),
    ...(await discoverDirectoryFiles(
      buildPlannerDirectory,
      ".build",
      "build-file",
      pathApi,
    )),
  );

  if (await isRegularFile(overlayConfigPath, pathApi)) {
    files.push({
      kind: "overlay-config",
      sourcePath: overlayConfigPath,
    });
  }

  return files;
}

function completeLineLength(content: string): number {
  const lastNewlineIndex = content.lastIndexOf("\n");
  return lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1;
}

function stripTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/, "");
}

function normalizeBaseUrl(apiBaseUrl: string) {
  return apiBaseUrl.replace(/\/+$/, "");
}

function formatBuildPlannerUpgrade(upgrade: BuildPlannerUpgradeLine) {
  const cost =
    upgrade.estimatedCostChaos === undefined
      ? "unpriced"
      : `${upgrade.estimatedCostChaos} chaos`;

  return `${upgrade.slot}=${upgrade.candidateName} over ${upgrade.currentName} (+${upgrade.scoreDelta}, ${cost})`;
}

function normalizeBuildFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (trimmed.length === 0) {
    throw new BuildFileWriteRejectedError(".build export requires a file name");
  }

  if (
    trimmed.includes("\\") ||
    trimmed.includes("/") ||
    trimmed.includes(":")
  ) {
    throw new BuildFileWriteRejectedError(
      ".build export file name must not contain path separators",
    );
  }

  return trimmed.toLowerCase().endsWith(".build")
    ? trimmed
    : `${trimmed}.build`;
}

function normalizeBackupTimestamp(capturedAt: string): string {
  const trimmed = capturedAt.trim();
  if (trimmed.length === 0) {
    throw new LocalBackupRejectedError("Local backup requires a timestamp");
  }

  return trimmed.replace(/[:.]/g, "-");
}

function isPathInsideDirectory(path: string, directory: string): boolean {
  const relative = win32.relative(directory, path);
  return (
    relative.length > 0 &&
    !relative.startsWith("..") &&
    !win32.isAbsolute(relative)
  );
}

async function discoverDirectoryFiles(
  directory: string,
  extension: string,
  kind: LocalBackupFileKind,
  pathApi: PathApi,
): Promise<LocalBackupFileRequest[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });

    return entries
      .filter(
        (entry) =>
          entry.isFile() && entry.name.toLowerCase().endsWith(extension),
      )
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => ({
        kind,
        sourcePath: pathApi.join(directory, entry.name),
      }));
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function isRegularFile(path: string, pathApi: PathApi): Promise<boolean> {
  try {
    const [entry] = await readdir(pathApi.dirname(path), {
      withFileTypes: true,
    }).then((entries) =>
      entries.filter((entry) => entry.name === pathApi.basename(path)),
    );

    return entry?.isFile() ?? false;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

type PathApi = Pick<
  typeof nativePath,
  "basename" | "dirname" | "join" | "resolve"
>;

function getFilesystemPathApi(path: string): PathApi {
  return path.includes("\\") || /^[A-Za-z]:[\\/]/.test(path)
    ? win32
    : nativePath;
}
