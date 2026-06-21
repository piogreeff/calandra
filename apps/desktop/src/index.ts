import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { win32 } from "node:path";
import {
  priceCheckRequestSchema,
  priceCheckResponseSchema,
  type Item,
  type PriceCheckResponse,
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
  priceCheck: PriceCheckResponse;
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
  const priceCheckRequest = priceCheckRequestSchema.parse({
    league: request.league,
    patch: request.patch,
    item: capture.contractItem,
  });
  const fetchImplementation = request.fetch ?? fetch;
  const response = await fetchImplementation(
    `${normalizeBaseUrl(request.apiBaseUrl)}/price/check`,
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
    priceCheck: priceCheckResponseSchema.parse(await response.json()),
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
