import { describe, expect, it } from "vitest";
import {
  ClientLogParseError,
  parseClientLogLine,
  parseClientLogText,
} from "../src/index";

describe("Client.txt parser", () => {
  it("parses an entered-area line without inventing timezone data", () => {
    const parsed = parseClientLogLine(
      "2026/06/21 13:52:10 12345678 abc [INFO Client 1234] : You have entered Clearfell.",
    );

    expect(parsed).toEqual({
      timestamp: "2026/06/21 13:52:10",
      uptimeMs: 12345678,
      channel: "INFO Client 1234",
      message: "You have entered Clearfell.",
      raw: "2026/06/21 13:52:10 12345678 abc [INFO Client 1234] : You have entered Clearfell.",
      event: {
        type: "area-entered",
        areaName: "Clearfell",
      },
    });
  });

  it("parses a generated-area line with level and seed", () => {
    const parsed = parseClientLogLine(
      '2026/06/21 13:52:11 12345679 abc [INFO Client 1234] : Generating level 68 area "The Riverbank" with seed 987654321',
    );

    expect(parsed.event).toEqual({
      type: "area-generated",
      areaName: "The Riverbank",
      areaLevel: 68,
      seed: "987654321",
    });
  });

  it("keeps unclassified client messages as unknown events", () => {
    const parsed = parseClientLogLine(
      "2026/06/21 13:52:12 12345680 abc [INFO Client 1234] : Connecting to instance server at 127.0.0.1:6112",
    );

    expect(parsed.event).toEqual({ type: "unknown" });
    expect(parsed.message).toBe(
      "Connecting to instance server at 127.0.0.1:6112",
    );
  });

  it("parses log text while skipping blank lines", () => {
    const parsed = parseClientLogText(`
2026/06/21 13:52:10 12345678 abc [INFO Client 1234] : You have entered Clearfell.

2026/06/21 13:52:11 12345679 abc [INFO Client 1234] : You have entered The Riverbank.
`);

    expect(parsed).toHaveLength(2);
    expect(parsed.map((line) => line.event)).toEqual([
      { type: "area-entered", areaName: "Clearfell" },
      { type: "area-entered", areaName: "The Riverbank" },
    ]);
  });

  it("rejects malformed lines so watcher bugs are visible", () => {
    expect(() => parseClientLogLine("not a client log line")).toThrow(
      ClientLogParseError,
    );
  });
});
