import { win32 } from "node:path";
import {
  parseClientLogText,
  parseItemText,
  toContractItem,
  type ParsedClientLogLine,
  type ParsedClipboardItem,
} from "@calandra/parser";
import type { Item } from "@calandra/contract";

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

function completeLineLength(content: string): number {
  const lastNewlineIndex = content.lastIndexOf("\n");
  return lastNewlineIndex === -1 ? 0 : lastNewlineIndex + 1;
}

function stripTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/, "");
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

function isPathInsideDirectory(path: string, directory: string): boolean {
  const relative = win32.relative(directory, path);
  return (
    relative.length > 0 &&
    !relative.startsWith("..") &&
    !win32.isAbsolute(relative)
  );
}
