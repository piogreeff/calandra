import {
  Activity,
  Bot,
  ChevronRight,
  Database,
  ExternalLink,
  Gauge,
  Hammer,
  History,
  ImageIcon,
  KeyRound,
  Network,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  WalletCards,
} from "lucide-react";
import type { AccountSnapshot } from "@calandra/contract";
import { defaultTheme } from "../lib/theme";
import { DatasetSearchPanel } from "../components/DatasetSearchPanel";
import { DesktopPathsPanel } from "../components/DesktopPathsPanel";
import { GggOAuthLinkPanel } from "../components/GggOAuthLinkPanel";
import { ThemeSelector } from "../components/ThemeSelector";
import {
  dashboardDatasetVersion,
  defaultApiBaseUrl,
  getDashboardCraftingEstimate,
  getDashboardDataset,
  getDashboardGggOAuthStatus,
  getDashboardLadderBuild,
  getDashboardLadderBuilds,
  getDashboardLatestSnapshot,
  getDashboardSnapshotAdvisor,
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

const gggDisclaimer =
  "Unofficial fan tool. Calandra is not affiliated with, endorsed by, or associated with Grinding Gear Games. Path of Exile 2 and related content are the property of Grinding Gear Games.";

const passiveTreeReferenceUrl =
  "https://poe.ninja/poe2/builds/runesofaldur/character/heygyus-0416/ResurrectGodAura/passive-tree";

type VisualLoadoutPreview = {
  character: {
    name: string;
    className: string;
    level: number;
    league: string;
  };
  stats: Array<{ label: string; value: string }>;
  equipment: Array<{
    slot: string;
    name: string;
    rarity: string;
    iconUrl: string;
    stats: string[];
  }>;
  passiveTree: {
    allocated: number;
    focus: string;
    nodeIds: string[];
    source: string;
    referenceUrl: string;
  };
};

const equipmentSlots = [
  "Weapon",
  "Offhand",
  "Helmet",
  "Body armour",
  "Gloves",
  "Boots",
  "Belt",
  "Amulet",
  "Ring 1",
  "Ring 2",
  "Charm",
] as const;

const fallbackVisualLoadoutPreview: VisualLoadoutPreview = {
  character: {
    name: "ResurrectGodAura",
    className: "Martial Artist",
    level: 95,
    league: dashboardDatasetVersion.league,
  },
  stats: [
    { label: "Life", value: "1,497" },
    { label: "Energy shield", value: "2,379" },
    { label: "Evasion rating", value: "14,776" },
    { label: "Resistances", value: "77 / 76 / 75 / 72" },
  ],
  equipment: [
    {
      slot: "Weapon",
      name: "Calandra Demo Wand",
      rarity: "magic",
      iconUrl: demoItemIcon("Wand", "#67e8f9", "#0e7490"),
      stats: ["Spell damage base", "Patch 0.2.0"],
    },
    {
      slot: "Body armour",
      name: "Calandra Demo Robe",
      rarity: "rare",
      iconUrl: demoItemIcon("Robe", "#bef264", "#3f6212"),
      stats: ["Energy shield shell", "Defensive anchor"],
    },
    {
      slot: "Amulet",
      name: "Calandra Demo Amulet",
      rarity: "unique",
      iconUrl: demoItemIcon("Amulet", "#fbbf24", "#92400e"),
      stats: ["Gold rarity anchor", "Amulet slot target"],
    },
    {
      slot: "Gloves",
      name: "Duskthread Grips",
      rarity: "rare",
      iconUrl: demoItemIcon("Gloves", "#f87171", "#991b1b"),
      stats: ["+43.4 score delta", "Attack speed gap closed"],
    },
    {
      slot: "Boots",
      name: "Wanderstep Boots",
      rarity: "rare",
      iconUrl: demoItemIcon("Boots", "#a78bfa", "#5b21b6"),
      stats: ["Movement-speed target", "+15.5 score delta"],
    },
    {
      slot: "Charm",
      name: "Stormbind Charm",
      rarity: "rare",
      iconUrl: demoItemIcon("Charm", "#22d3ee", "#155e75"),
      stats: ["Lightning damage target", "+21.2 score delta"],
    },
  ],
  passiveTree: {
    allocated: 95,
    focus: "Aura pathing, spirit reservation, defensive wheel coverage",
    nodeIds: [
      "aura-wheel",
      "spirit-path",
      "reservation",
      "evasion-ring",
      "deflection",
      "crit-route",
    ],
    source: "Link-out reference only; not scraped or bundled.",
    referenceUrl: passiveTreeReferenceUrl,
  },
};

type HomeSearchParams = {
  account?: string | string[];
};

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<HomeSearchParams>;
}) {
  const selectedAccount = resolveSelectedAccount(await searchParams);
  const snapshotReadToken = process.env["SNAPSHOT_READ_TOKEN"]?.trim();
  const snapshotReadOptions = snapshotReadToken ? { snapshotReadToken } : {};
  const [
    dataset,
    gggOAuthStatus,
    snapshotList,
    ladderBuilds,
    craftingEstimate,
  ] = await Promise.all([
    getDashboardDataset(),
    getDashboardGggOAuthStatus(),
    getDashboardSnapshots(
      selectedAccount,
      defaultApiBaseUrl,
      fetch,
      snapshotReadOptions,
    ),
    getDashboardLadderBuilds(),
    getDashboardCraftingEstimate(),
  ]);
  const latestSnapshot =
    snapshotList.snapshots[snapshotList.snapshots.length - 1];
  const [
    snapshotDiff,
    latestSnapshotDetail,
    ladderBuildDetail,
    snapshotAdvisor,
  ] = await Promise.all([
    getDashboardSnapshotDiff(
      snapshotList.account,
      snapshotList.snapshots,
      defaultApiBaseUrl,
      fetch,
      snapshotReadOptions,
    ),
    getDashboardLatestSnapshot(
      snapshotList.account,
      snapshotList.snapshots,
      defaultApiBaseUrl,
      fetch,
      snapshotReadOptions,
    ),
    getDashboardLadderBuild(ladderBuilds.builds[0]?.id),
    getDashboardSnapshotAdvisor(
      snapshotList.account,
      latestSnapshot?.snapshotId,
      defaultApiBaseUrl,
      fetch,
      snapshotReadOptions,
    ),
  ]);
  const endpointLabel = new URL(defaultApiBaseUrl).hostname;
  const datasetSource =
    dataset.source === "api" ? "Published R2 artifact" : "Demo fallback";
  const snapshotSource =
    snapshotList.source === "api" ? "Snapshot store" : "Demo snapshot";
  const totalDatasetRecords = Object.values(dataset.manifest.counts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const uniqueImageCoverage =
    dataset.manifest.qualityGates?.uniqueImageCoverage;
  const shortChecksum = dataset.manifest.sha256.slice(0, 12);
  const latestDiff = snapshotDiff.diff;
  const visualLoadoutPreview = createVisualLoadoutPreview(
    latestSnapshotDetail.snapshot,
  );

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
            <div className="min-w-0 xl:col-span-2">
              <CharacterBuildPreviewPanel loadout={visualLoadoutPreview} />
            </div>

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
                  No LLM values - Snapshot advisor -{" "}
                  {snapshotAdvisor.response.source}
                  {snapshotAdvisor.source === "fallback" ? " fallback" : ""}
                </div>
                <div className="space-y-3">
                  {snapshotAdvisor.response.upgrades.map((upgrade, index) => (
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
                title="Crafting calculator"
                icon={<Hammer className="size-4" aria-hidden="true" />}
              >
                <div className="mb-3 rounded-md border border-info/30 bg-info/10 p-3 text-xs font-medium text-info">
                  Dataset mod pool - {craftingEstimate.response.source}
                  {craftingEstimate.source === "fallback" ? " fallback" : ""}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-base-100/45 p-3">
                    <p className="text-xs text-base-content/55">Hit chance</p>
                    <p className="mt-1 text-lg font-semibold text-base-content">
                      {formatPercent(
                        craftingEstimate.response.estimate.hitProbability,
                      )}
                    </p>
                  </div>
                  <div className="rounded-md bg-base-100/45 p-3">
                    <p className="text-xs text-base-content/55">
                      Expected cost
                    </p>
                    <p className="mt-1 text-lg font-semibold text-base-content">
                      {formatChaos(
                        craftingEstimate.response.estimate.expectedCostChaos,
                      )}
                    </p>
                  </div>
                  <div className="rounded-md bg-base-100/45 p-3">
                    <p className="text-xs text-base-content/55">Eligible</p>
                    <p className="mt-1 text-lg font-semibold text-base-content">
                      {craftingEstimate.response.estimate.eligibleModCount}
                    </p>
                  </div>
                  <div className="rounded-md bg-base-100/45 p-3">
                    <p className="text-xs text-base-content/55">Decision</p>
                    <p className="mt-1 text-lg font-semibold capitalize text-primary">
                      {craftingEstimate.response.comparison?.recommendation ??
                        "Estimate"}
                    </p>
                  </div>
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
                        <p className="mt-1 break-all text-xs text-base-content/55">
                          {latestSnapshot.objectKey}
                        </p>
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
                title="Ladder builds"
                icon={<Trophy className="size-4" aria-hidden="true" />}
              >
                <div className="mb-3 rounded-md border border-base-300/70 bg-base-100/45 p-3 text-xs font-medium text-base-content/65">
                  {ladderBuilds.source === "api"
                    ? "Published ladder artifact"
                    : "Demo ladder fallback"}
                </div>
                {ladderBuilds.builds.length > 0 ? (
                  <div className="space-y-3">
                    {ladderBuilds.builds.slice(0, 4).map((build) => {
                      const buildDetail =
                        ladderBuildDetail.build?.id === build.id
                          ? ladderBuildDetail.build
                          : build;
                      const passiveHighlights = [
                        ...(buildDetail.passiveTree?.keystones ?? []).map(
                          (name) => ({ kind: "Keystone", name }),
                        ),
                        ...(buildDetail.passiveTree?.notables ?? []).map(
                          (name) => ({ kind: "Notable", name }),
                        ),
                      ].slice(0, 4);

                      return (
                        <article
                          key={build.id}
                          className="rounded-md border border-base-300/70 bg-base-100/45 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs uppercase text-base-content/55">
                                {build.account}
                              </p>
                              <h3 className="truncate text-sm font-semibold text-base-content">
                                {build.character}
                              </h3>
                            </div>
                            <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                              {build.rank
                                ? `#${build.rank}`
                                : `Level ${build.level}`}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-base-content/65">
                            Level {build.level} {build.className}
                          </p>
                          {build.mainSkill ? (
                            <p className="mt-1 text-sm font-medium text-base-content">
                              {build.mainSkill}
                            </p>
                          ) : null}
                          {buildDetail.passiveSkillIds?.length ? (
                            <p className="mt-1 text-xs text-base-content/55">
                              {buildDetail.passiveSkillIds.length} passive nodes
                              tracked
                            </p>
                          ) : null}
                          {buildDetail.passiveTree ? (
                            <div className="mt-3 border-t border-base-300/60 pt-3">
                              <p className="text-xs font-medium uppercase text-base-content/55">
                                Passive highlights
                              </p>
                              {passiveHighlights.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {passiveHighlights.map((passive) => (
                                    <span
                                      key={`${passive.kind}-${passive.name}`}
                                      className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                                    >
                                      {passive.name}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              {buildDetail.passiveTree.summary ? (
                                <p className="mt-2 text-xs leading-5 text-base-content/65">
                                  {buildDetail.passiveTree.summary}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {buildDetail.equipment?.length ? (
                            <p className="mt-1 text-xs text-base-content/55">
                              {buildDetail.equipment.length} gear{" "}
                              {buildDetail.equipment.length === 1
                                ? "item"
                                : "items"}{" "}
                              tracked
                            </p>
                          ) : null}
                          {build.passiveTreeUrl ? (
                            <a
                              href={build.passiveTreeUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-outline btn-xs mt-3 w-full"
                            >
                              Open passive tree
                              <ExternalLink
                                className="size-3"
                                aria-hidden="true"
                              />
                            </a>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-md border border-base-300/70 bg-base-100/45 p-3 text-sm text-base-content/70">
                    No ladder builds in this published dataset yet.
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
                title="GGG account link"
                icon={<KeyRound className="size-4" aria-hidden="true" />}
              >
                <GggOAuthLinkPanel
                  status={gggOAuthStatus}
                  apiBaseUrl={defaultApiBaseUrl}
                  defaultAccount={snapshotList.account}
                />
              </Panel>

              <DesktopPathsPanel />

              <Panel
                title="About Calandra"
                icon={<Sparkles className="size-4" aria-hidden="true" />}
              >
                <p className="text-sm leading-6 text-base-content/70">
                  {gggDisclaimer}
                </p>
              </Panel>
            </aside>
          </div>

          <footer className="border-t border-base-300/60 px-4 py-5 text-xs leading-5 text-base-content/55 lg:px-6">
            {gggDisclaimer}
          </footer>
        </section>
      </div>
    </main>
  );
}

function CharacterBuildPreviewPanel({
  loadout,
}: {
  loadout: VisualLoadoutPreview;
}) {
  return (
    <Panel
      title="Character build preview"
      icon={<Swords className="size-4" aria-hidden="true" />}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-base-content/55">
                Level {loadout.character.level} {loadout.character.className}
              </p>
              <h3 className="truncate text-lg font-semibold text-base-content">
                {loadout.character.name}
              </h3>
              <p className="mt-1 text-sm text-base-content/60">
                {loadout.character.league}
              </p>
            </div>
            <p className="rounded-md border border-info/35 bg-info/10 px-3 py-2 text-xs font-medium text-info">
              Preview loadout
            </p>
          </div>

          <section aria-label="Visual equipment" className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-base-content">
              <ImageIcon className="size-4 text-primary" aria-hidden="true" />
              <h3>Visual equipment</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-3">
              {equipmentSlots.map((slot) => {
                const item = findEquipmentSlot(loadout.equipment, slot);

                return item ? (
                  <article
                    key={slot}
                    className="min-w-0 rounded-md border border-base-300/70 bg-base-100/45 p-3"
                  >
                    <div className="aspect-square rounded-md border border-base-300/70 bg-base-300/35 p-2">
                      <img
                        src={item.iconUrl}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <p className="mt-3 text-xs uppercase text-base-content/55">
                      {slot}
                    </p>
                    <p className="mt-1 text-xs font-medium text-success">
                      {slot} equipped
                    </p>
                    <h4 className="truncate text-sm font-semibold text-base-content">
                      {item.name}
                    </h4>
                    <p className="mt-1 text-xs capitalize text-primary">
                      {item.rarity}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-base-content/60">
                      {item.stats.map((stat) => (
                        <li key={stat} className="truncate">
                          {stat}
                        </li>
                      ))}
                    </ul>
                  </article>
                ) : (
                  <article
                    key={slot}
                    className="min-h-36 rounded-md border border-dashed border-base-300/80 bg-base-100/30 p-3"
                  >
                    <div className="grid aspect-square place-items-center rounded-md border border-base-300/60 bg-base-300/20">
                      <ImageIcon
                        className="size-6 text-base-content/35"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-3 text-xs uppercase text-base-content/55">
                      {slot}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-base-content/65">
                      {slot} slot empty
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="rounded-md border border-base-300/70 bg-base-100/45 p-3">
            <h3 className="text-sm font-semibold text-base-content">Stats</h3>
            <div className="mt-3 space-y-2 text-sm">
              {loadout.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between gap-3 border-b border-base-300/60 pb-2 last:border-0 last:pb-0"
                >
                  <span className="text-base-content/60">{stat.label}</span>
                  <span className="font-semibold text-base-content">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-base-300/70 bg-base-100/45 p-3">
            <div className="flex items-center gap-2">
              <Network className="size-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-base-content">
                Passive tree
              </h3>
            </div>
            <p className="mt-3 text-2xl font-semibold text-base-content">
              {loadout.passiveTree.allocated} passive nodes tracked
            </p>
            <p className="mt-2 text-sm leading-6 text-base-content/65">
              {loadout.passiveTree.focus}
            </p>
            <div className="mt-3 rounded-md border border-base-300/70 bg-base-200/65 p-3">
              <p className="text-xs font-medium uppercase text-base-content/55">
                Passive allocation preview
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2" role="list">
                {loadout.passiveTree.nodeIds.slice(0, 6).map((nodeId) => (
                  <div
                    key={nodeId}
                    className="relative grid min-h-14 place-items-center rounded-md border border-primary/35 bg-primary/10 px-2 text-center text-[0.7rem] font-semibold leading-4 text-primary before:absolute before:left-[-0.6rem] before:top-1/2 before:hidden before:h-px before:w-2 before:bg-primary/45 sm:before:block"
                    role="listitem"
                  >
                    <span className="break-all">{nodeId}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 rounded-md border border-warning/35 bg-warning/10 p-2 text-xs leading-5 text-warning">
              {loadout.passiveTree.source}
            </p>
            <a
              href={loadout.passiveTree.referenceUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary btn-sm mt-3 w-full"
            >
              Open passive tree reference
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function createVisualLoadoutPreview(
  snapshot: AccountSnapshot | null,
): VisualLoadoutPreview {
  const character = snapshot?.characters[0];

  if (!character) {
    return fallbackVisualLoadoutPreview;
  }

  return {
    character: {
      name: character.name,
      className: character.className,
      level: character.level,
      league: character.league,
    },
    stats: buildSnapshotStatRows(snapshot),
    equipment:
      character.equipment.length > 0
        ? character.equipment.map((item) => ({
            slot: item.slot,
            name: item.name,
            rarity: item.rarity ?? "normal",
            iconUrl:
              item.iconUrl ?? demoItemIcon(item.slot, "#67e8f9", "#0e7490"),
            stats: item.stats
              ? Object.entries(item.stats)
                  .slice(0, 2)
                  .map(([key, value]) => `${formatStatLabel(key)} ${value}`)
              : ["Snapshot gear item"],
          }))
        : fallbackVisualLoadoutPreview.equipment,
    passiveTree: {
      allocated: character.passiveSkillIds?.length ?? 0,
      focus:
        character.passiveSkillIds && character.passiveSkillIds.length > 0
          ? "Latest account snapshot passive allocation"
          : "No passive allocation data captured yet",
      nodeIds: character.passiveSkillIds ?? [],
      source: fallbackVisualLoadoutPreview.passiveTree.source,
      referenceUrl: fallbackVisualLoadoutPreview.passiveTree.referenceUrl,
    },
  };
}

function findEquipmentSlot(
  equipment: VisualLoadoutPreview["equipment"],
  slot: (typeof equipmentSlots)[number],
) {
  const normalizedSlot = normalizeEquipmentSlot(slot);

  return equipment.find(
    (item) => normalizeEquipmentSlot(item.slot) === normalizedSlot,
  );
}

function normalizeEquipmentSlot(slot: string) {
  return slot.trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveSelectedAccount(searchParams: HomeSearchParams | undefined) {
  const account = Array.isArray(searchParams?.account)
    ? searchParams.account[0]
    : searchParams?.account;

  return account?.trim() || "example";
}

function buildSnapshotStatRows(snapshot: AccountSnapshot) {
  const character = snapshot.characters[0];
  const totals = new Map<string, number>();

  for (const item of character?.equipment ?? []) {
    for (const [key, value] of Object.entries(item.stats ?? {})) {
      totals.set(key, (totals.get(key) ?? 0) + value);
    }
  }

  const statRows = Array.from(totals.entries())
    .slice(0, 4)
    .map(([key, value]) => ({
      label: formatStatLabel(key),
      value: String(value),
    }));

  if (statRows.length > 0) {
    return statRows;
  }

  return [
    {
      label: "Equipment items",
      value: String(character?.equipment.length ?? 0),
    },
    {
      label: "Passive nodes",
      value: String(character?.passiveSkillIds?.length ?? 0),
    },
    { label: "Snapshot source", value: snapshot.source },
    { label: "Captured", value: formatSnapshotTimestamp(snapshot.capturedAt) },
  ];
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

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatChaos(value: number | undefined) {
  return value === undefined ? "Unknown" : `${value} chaos`;
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

function formatStatLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function demoItemIcon(label: string, accent: string, shadow: string) {
  const initials = label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="18" fill="#101820"/><rect x="14" y="14" width="132" height="132" rx="14" fill="#172330" stroke="${accent}" stroke-width="3"/><path d="M80 28 118 78 80 132 42 78Z" fill="${shadow}" opacity=".72"/><path d="M80 38 106 79 80 120 54 79Z" fill="${accent}" opacity=".88"/><circle cx="80" cy="79" r="18" fill="#f8fafc" opacity=".18"/><text x="80" y="91" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="#f8fafc">${initials}</text></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
