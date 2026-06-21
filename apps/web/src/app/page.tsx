import {
  Activity,
  Bot,
  ChevronRight,
  Database,
  Gauge,
  Hammer,
  History,
  KeyRound,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  WalletCards,
} from "lucide-react";
import type { UpgradeAdvisorResponse } from "@calandra/contract";
import { defaultTheme } from "../lib/theme";
import { DatasetSearchPanel } from "../components/DatasetSearchPanel";
import { DesktopPathsPanel } from "../components/DesktopPathsPanel";
import { ThemeSelector } from "../components/ThemeSelector";
import {
  dashboardDatasetVersion,
  defaultApiBaseUrl,
  getDashboardDataset,
  getDashboardSnapshotDiff,
  getDashboardSnapshots,
} from "../lib/read-api";

const navItems = [
  { label: "Overview", icon: Gauge, current: true },
  { label: "Character", icon: Swords },
  { label: "Gear", icon: ShieldCheck },
  { label: "Crafting", icon: Hammer },
  { label: "Economy", icon: Activity },
  { label: "Snapshots", icon: History },
  { label: "Settings", icon: Settings },
];

const advisorPreview = {
  source: "deterministic-engine",
  upgrades: [
    {
      slot: "Gloves",
      currentName: "Frayed Mail Mitts",
      candidateName: "Duskthread Grips",
      currentScore: 58.2,
      candidateScore: 101.6,
      scoreDelta: 43.4,
      estimatedCostChaos: 3,
      valuePerChaos: 14.4667,
      currentMissingStats: ["fire_resistance", "attack_speed"],
      candidateMissingStats: [],
    },
    {
      slot: "Amulet",
      currentName: "Amber Talisman",
      candidateName: "Stormbind Charm",
      currentScore: 76.8,
      candidateScore: 98,
      scoreDelta: 21.2,
      estimatedCostChaos: 8,
      valuePerChaos: 2.65,
      currentMissingStats: ["lightning_damage"],
      candidateMissingStats: ["life"],
    },
    {
      slot: "Boots",
      currentName: "Threadbare Shoes",
      candidateName: "Wanderstep Boots",
      currentScore: 64,
      candidateScore: 79.5,
      scoreDelta: 15.5,
      estimatedCostChaos: 5,
      valuePerChaos: 3.1,
      currentMissingStats: ["movement_speed"],
      candidateMissingStats: [],
    },
  ],
} satisfies UpgradeAdvisorResponse;

export default async function Home() {
  const [dataset, snapshotList] = await Promise.all([
    getDashboardDataset(),
    getDashboardSnapshots("example"),
  ]);
  const snapshotDiff = await getDashboardSnapshotDiff(
    snapshotList.account,
    snapshotList.snapshots,
  );
  const endpointLabel = new URL(defaultApiBaseUrl).hostname;
  const datasetSource =
    dataset.source === "api" ? "Published R2 artifact" : "Demo fallback";
  const snapshotSource =
    snapshotList.source === "api" ? "Snapshot store" : "Awaiting first sync";
  const totalDatasetRecords = Object.values(dataset.manifest.counts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const uniqueImageCoverage =
    dataset.manifest.qualityGates?.uniqueImageCoverage;
  const shortChecksum = dataset.manifest.sha256.slice(0, 12);
  const latestSnapshot =
    snapshotList.snapshots[snapshotList.snapshots.length - 1];
  const latestDiff = snapshotDiff.diff;

  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden border-base-300/60 bg-base-200/85 lg:overflow-visible lg:border-r">
          <div className="flex items-center gap-3 border-b border-base-300/60 px-5 py-5">
            <div className="grid size-10 place-items-center rounded-md border border-primary/35 bg-primary/10 text-primary">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-none text-base-content">
                Calandra
              </p>
              <p className="mt-1 text-xs text-base-content/60">
                PoE2 companion
              </p>
            </div>
          </div>

          <nav
            className="flex w-full max-w-full gap-2 overflow-x-auto border-b border-base-300/60 px-3 py-3 lg:block lg:space-y-1 lg:overflow-visible lg:border-b-0 lg:py-4"
            aria-label="Primary"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href="#"
                  className={`flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition lg:gap-3 ${
                    item.current
                      ? "bg-primary text-primary-content"
                      : "text-base-content/70 hover:bg-base-300/70 hover:text-base-content"
                  }`}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="flex flex-col gap-4 border-b border-base-300/60 bg-base-100/75 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between lg:px-6">
            <div>
              <h1 className="text-xl font-semibold tracking-normal text-base-content md:text-2xl">
                Overview
              </h1>
              <p className="mt-1 text-sm text-base-content/65">
                {dashboardDatasetVersion.league} - Patch{" "}
                {dashboardDatasetVersion.patch}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex min-h-9 max-w-full min-w-0 items-center gap-2 rounded-md border border-success/35 bg-success/10 px-3 text-sm text-success">
                <Activity className="size-4" aria-hidden="true" />
                <span className="break-all">{endpointLabel}</span>
              </div>
              <div className="inline-flex min-h-9 max-w-full min-w-0 items-center gap-2 rounded-md border border-warning/35 bg-warning/10 px-3 text-sm text-warning">
                <Database className="size-4" aria-hidden="true" />
                <span className="break-all">calandra.pages.dev</span>
              </div>
              <ThemeSelector selectedTheme={defaultTheme} />
            </div>
          </header>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_20rem] lg:px-6">
            <div className="min-w-0 space-y-4">
              <section
                className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-3"
                aria-label="Readiness summary"
              >
                <Panel
                  title="Character readiness"
                  icon={<ShieldCheck className="size-4" aria-hidden="true" />}
                >
                  <p className="text-3xl font-semibold text-base-content">
                    72%
                  </p>
                  <p className="mt-2 text-sm text-base-content/65">
                    Clipboard parser ready. OAuth character sync is next.
                  </p>
                  <div className="mt-4 h-2 rounded-full bg-base-300">
                    <div className="h-2 w-[72%] rounded-full bg-primary" />
                  </div>
                </Panel>

                <Panel
                  title="Budget control"
                  icon={<WalletCards className="size-4" aria-hidden="true" />}
                >
                  <label
                    className="text-xs font-medium uppercase text-base-content/55"
                    htmlFor="budget"
                  >
                    Divine budget
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      id="budget"
                      className="input input-sm w-full"
                      defaultValue="20"
                      inputMode="decimal"
                    />
                    <span className="rounded-md border border-base-300 px-3 py-1.5 text-sm text-base-content/70">
                      div
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-base-content/65">
                    Session cap: $1.00 advisory budget.
                  </p>
                </Panel>

                <Panel
                  title="Weakest slot"
                  icon={<Bot className="size-4" aria-hidden="true" />}
                >
                  <p className="text-lg font-semibold text-primary">Gloves</p>
                  <p className="mt-2 text-sm text-base-content/65">
                    Low resist density and attack-speed gap. Engine scoring is
                    wired.
                  </p>
                  <button className="btn btn-primary btn-sm mt-4 w-full">
                    Queue advisor
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </Panel>
              </section>

              <section className="grid grid-cols-[minmax(0,1fr)] gap-4 2xl:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="min-w-0 rounded-lg border border-base-300/70 bg-base-200/72">
                  <DatasetSearchPanel
                    initialItems={dataset.items}
                    datasetSource={datasetSource}
                    patch={dashboardDatasetVersion.patch}
                    apiBaseUrl={defaultApiBaseUrl}
                  />
                </div>

                <Panel
                  title="Economy pulse"
                  icon={<Activity className="size-4" aria-hidden="true" />}
                >
                  <div className="space-y-3">
                    {dataset.prices.map((price) => (
                      <div
                        key={price.id}
                        className="flex items-center justify-between border-b border-base-300/60 pb-3 last:border-0 last:pb-0"
                      >
                        <span className="text-sm text-base-content/70">
                          {price.name}
                        </span>
                        <span className="font-semibold text-base-content">
                          {price.chaosEquivalent}
                        </span>
                      </div>
                    ))}
                  </div>
                </Panel>
              </section>
            </div>

            <aside className="min-w-0 space-y-4">
              <Panel
                title="Deterministic upgrade rankings"
                icon={<Bot className="size-4" aria-hidden="true" />}
              >
                <div className="mb-3 rounded-md border border-success/30 bg-success/10 p-3 text-xs font-medium text-success">
                  No LLM values - {advisorPreview.source}
                </div>
                <div className="space-y-3">
                  {advisorPreview.upgrades.map((upgrade, index) => (
                    <article
                      key={`${upgrade.slot}-${upgrade.candidateName}`}
                      className="rounded-md border border-base-300/70 bg-base-100/45 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase text-base-content/55">
                            {upgrade.slot}
                          </p>
                          <h3 className="truncate text-sm font-semibold text-base-content">
                            {upgrade.candidateName}
                          </h3>
                          <p className="mt-1 truncate text-xs text-base-content/55">
                            over {upgrade.currentName}
                          </p>
                        </div>
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md bg-base-200/80 p-2">
                          <p className="text-xs text-base-content/55">Delta</p>
                          <p className="font-semibold text-success">
                            +{upgrade.scoreDelta.toFixed(1)}
                          </p>
                        </div>
                        <div className="rounded-md bg-base-200/80 p-2">
                          <p className="text-xs text-base-content/55">Value</p>
                          <p className="font-semibold text-base-content">
                            {upgrade.valuePerChaos?.toFixed(2)} / chaos
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Snapshot restore"
                icon={<History className="size-4" aria-hidden="true" />}
              >
                <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-base-300/70 bg-base-100/45 p-3">
                  <span className="text-sm text-base-content/65">
                    {snapshotSource}
                  </span>
                  <span className="rounded-md bg-base-300/70 px-2 py-1 text-xs font-semibold text-base-content">
                    {snapshotList.snapshots.length}
                  </span>
                </div>
                {latestSnapshot ? (
                  <article className="rounded-md border border-base-300/70 bg-base-100/45 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase text-base-content/55">
                          {snapshotList.account}
                        </p>
                        <h3 className="mt-1 break-all text-sm font-semibold text-base-content">
                          {latestSnapshot.snapshotId}
                        </h3>
                      </div>
                      <RotateCcw
                        className="size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md bg-base-200/80 p-2">
                        <p className="text-xs text-base-content/55">Uploaded</p>
                        <p className="truncate font-medium text-base-content">
                          {formatSnapshotTimestamp(latestSnapshot.uploadedAt)}
                        </p>
                      </div>
                      <div className="rounded-md bg-base-200/80 p-2">
                        <p className="text-xs text-base-content/55">Size</p>
                        <p className="font-medium text-base-content">
                          {formatBytes(latestSnapshot.size)}
                        </p>
                      </div>
                    </div>
                  </article>
                ) : (
                  <p className="rounded-md border border-base-300/70 bg-base-100/45 p-3 text-sm text-base-content/70">
                    No account snapshots stored yet.
                  </p>
                )}
              </Panel>

              <Panel
                title="Snapshot diff"
                icon={<RotateCcw className="size-4" aria-hidden="true" />}
              >
                {latestDiff ? (
                  <div className="space-y-3">
                    <div className="rounded-md border border-base-300/70 bg-base-100/45 p-3">
                      <p className="text-xs uppercase text-base-content/55">
                        Latest round trip
                      </p>
                      <p className="mt-1 break-all text-xs font-medium text-base-content">
                        {latestDiff.beforeSnapshotId} {" -> "}{" "}
                        {latestDiff.afterSnapshotId}
                      </p>
                    </div>

                    {latestDiff.characterChanges.map((change) => (
                      <article
                        key={change.id}
                        className="rounded-md border border-base-300/70 bg-base-100/45 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs uppercase text-base-content/55">
                              Character
                            </p>
                            <h3 className="truncate text-sm font-semibold text-base-content">
                              {change.name}
                            </h3>
                          </div>
                          <span className="shrink-0 rounded-md bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                            {formatLevelDelta(change.levelDelta)}
                          </span>
                        </div>
                        {change.equipmentChanges.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {change.equipmentChanges.map((equipment) => (
                              <div
                                key={`${change.id}-${equipment.slot}`}
                                className="rounded-md bg-base-200/80 p-2 text-sm"
                              >
                                <p className="text-xs text-base-content/55">
                                  {equipment.slot}
                                </p>
                                <p className="mt-1 break-words font-medium text-base-content">
                                  {equipment.beforeName ?? "None"} {" -> "}{" "}
                                  {equipment.afterName ?? "None"}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}

                    {latestDiff.stashChanges.map((change) => (
                      <article
                        key={change.id}
                        className="rounded-md border border-base-300/70 bg-base-100/45 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs uppercase text-base-content/55">
                              Stash
                            </p>
                            <h3 className="truncate text-sm font-semibold text-base-content">
                              {change.name}
                            </h3>
                          </div>
                          <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                            {formatItemDelta(change.itemCountDelta)}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-base-300/70 bg-base-100/45 p-3 text-sm text-base-content/70">
                    {formatSnapshotDiffEmptyState(snapshotDiff.reason)}
                  </p>
                )}
              </Panel>

              <Panel
                title="Dataset manifest"
                icon={<Database className="size-4" aria-hidden="true" />}
              >
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-base-300/60 pb-3">
                    <span className="text-base-content/60">Records</span>
                    <span className="font-semibold text-base-content">
                      {totalDatasetRecords}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-b border-base-300/60 pb-3">
                    <span className="text-base-content/60">Artifact</span>
                    <span className="max-w-40 truncate text-right font-medium text-base-content">
                      {dataset.manifest.artifactKey}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base-content/60">SHA-256</span>
                    <span className="font-mono text-xs text-base-content">
                      {shortChecksum}
                    </span>
                  </div>
                  {uniqueImageCoverage ? (
                    <div className="space-y-2 border-t border-base-300/60 pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-base-content/60">
                          Unique images
                        </span>
                        <span className="font-semibold text-base-content">
                          {formatCoveragePercent(uniqueImageCoverage.ratio)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-base-content/55">
                          Resolved / expected
                        </span>
                        <span className="font-medium text-base-content/75">
                          {uniqueImageCoverage.resolved} /{" "}
                          {uniqueImageCoverage.expected}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-2 border-t border-base-300/60 pt-3">
                    <p className="text-xs font-medium uppercase text-base-content/55">
                      Source attribution
                    </p>
                    {dataset.manifest.sources.map((source) => (
                      <div
                        key={`${source.kind}-${source.name}`}
                        className="space-y-1"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-base-content">
                            {source.name}
                          </span>
                          <span className="rounded-md bg-base-300/70 px-2 py-1 text-xs text-base-content/70">
                            {source.kind}
                          </span>
                        </div>
                        <p className="break-words text-xs leading-5 text-base-content/60">
                          {source.attribution}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <Panel
                title="OAuth coverage"
                icon={<KeyRound className="size-4" aria-hidden="true" />}
              >
                <p className="text-sm text-base-content/70">
                  PoE2 characters can use official OAuth coverage first.
                </p>
                <p className="mt-3 rounded-md border border-warning/35 bg-warning/10 p-3 text-sm text-warning">
                  Stash OAuth: pending GGG support
                </p>
              </Panel>

              <DesktopPathsPanel />
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function formatSnapshotTimestamp(value: string | undefined) {
  if (!value) {
    return "Pending";
  }

  return value.replace("T", " ").replace(".000Z", "Z");
}

function formatBytes(value: number | undefined) {
  if (value === undefined) {
    return "Unknown";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  return `${(value / 1024).toFixed(1)} KB`;
}

function formatCoveragePercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatLevelDelta(delta: number) {
  if (delta === 0) {
    return "No levels";
  }

  const prefix = delta > 0 ? "+" : "";
  const unit = Math.abs(delta) === 1 ? "level" : "levels";

  return `${prefix}${delta} ${unit}`;
}

function formatItemDelta(delta: number) {
  if (delta === 0) {
    return "No items";
  }

  const prefix = delta > 0 ? "+" : "";
  const unit = Math.abs(delta) === 1 ? "item" : "items";

  return `${prefix}${delta} ${unit}`;
}

function formatSnapshotDiffEmptyState(
  reason: "ready" | "insufficient-snapshots" | "unavailable",
) {
  if (reason === "insufficient-snapshots") {
    return "Need two stored snapshots before Calandra can render a diff.";
  }

  return "Snapshot diff is unavailable from the temporary API.";
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-base-300/70 bg-base-200/72 p-4 shadow-sm shadow-black/10">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-base-content">
        <span className="grid size-7 place-items-center rounded-md border border-base-300 bg-base-300/50 text-primary">
          {icon}
        </span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
