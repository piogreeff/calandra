export type MaintainerIngestionExecutionContext =
  | "maintainer"
  | "client"
  | "self-host";

export type MaintainerIngestionSource = {
  kind: "game-data" | "economy";
  host: "poe2db.tw" | "poe.ninja";
  url: string;
};

export type MaintainerIngestionRequest = {
  executionContext: MaintainerIngestionExecutionContext;
  sourceUrls: readonly string[];
};

const allowedSources = [
  { kind: "game-data", host: "poe2db.tw", url: "https://poe2db.tw/" },
  { kind: "economy", host: "poe.ninja", url: "https://poe.ninja/poe2" },
] as const satisfies readonly MaintainerIngestionSource[];

const bannedSourceHosts = new Set(["mobalytics.gg", "maxroll.gg"]);

export function getMaintainerIngestionSources() {
  return [...allowedSources];
}

export function validateMaintainerIngestionRequest(
  request: MaintainerIngestionRequest,
) {
  if (request.executionContext !== "maintainer") {
    throw new Error(
      "Dataset ingestion sources are maintainer-only; clients and self-hosts must consume published artifacts.",
    );
  }

  return {
    executionContext: request.executionContext,
    sources: request.sourceUrls.map(toMaintainerIngestionSource),
  };
}

function toMaintainerIngestionSource(url: string): MaintainerIngestionSource {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, "");

  if (bannedSourceHosts.has(host)) {
    throw new Error(
      "Dataset ingestion may not use Mobalytics or Maxroll sources.",
    );
  }

  const source = allowedSources.find((candidate) => candidate.host === host);

  if (!source) {
    throw new Error(`Dataset ingestion source is not allowed: ${host}`);
  }

  return {
    kind: source.kind,
    host: source.host,
    url,
  };
}
