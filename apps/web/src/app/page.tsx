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
import type {
  AccountSnapshot,
  AccountSnapshotGearItem,
  LadderBuild,
} from "@calandra/contract";
import { defaultTheme } from "../lib/theme";
import { DatasetSearchPanel } from "../components/DatasetSearchPanel";
import {
  DesktopPathsPanel,
  type AdvisorBuildExport,
} from "../components/DesktopPathsPanel";
import { GggOAuthLinkPanel } from "../components/GggOAuthLinkPanel";
import { ThemeSelector } from "../components/ThemeSelector";
import {
  dashboardDatasetVersion,
  defaultApiBaseUrl,
  getDashboardCraftingEstimate,
  getDashboardDataset,
  getDashboardDatasetVisualSummary,
  getDashboardGggOAuthStatus,
  getDashboardLadderBuild,
  getDashboardLadderBuilds,
  getDashboardLatestSnapshot,
  getDashboardSnapshot,
  getDashboardPriceCheck,
  getDashboardSnapshotAdvisor,
  getDashboardSnapshotDiff,
  getDashboardSnapshots,
  type DashboardLadderBuildFilters,
  type DashboardDatasetVisualSummary,
} from "../lib/read-api";

const navItems = [
  { label: "Overview", icon: Gauge, href: "#overview", current: true },
  { label: "Character", icon: Swords, href: "#character" },
  { label: "Gear", icon: ShieldCheck, href: "#gear" },
  { label: "Crafting", icon: Hammer, href: "#crafting" },
  { label: "Economy", icon: Activity, href: "#economy" },
  { label: "Snapshots", icon: History, href: "#snapshots" },
  { label: "Settings", icon: Settings, href: "#settings" },
];

const gggDisclaimer =
  "Unofficial fan tool. Calandra is not affiliated with, endorsed by, or associated with Grinding Gear Games. Path of Exile 2 and related content are the property of Grinding Gear Games.";

const passiveTreeReferenceUrl =
  "https://poe.ninja/poe2/builds/runesofaldur/character/heygyus-0416/ResurrectGodAura/passive-tree";

type VisualLoadoutPreview = {
  sourceLabel: string;
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
    iconUrl: string | undefined;
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
  sourceLabel: "Reference build",
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
  buildId?: string | string[];
  className?: string | string[];
  snapshotId?: string | string[];
  skill?: string | string[];
};

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<HomeSearchParams>;
}) {
  const resolvedSearchParams = isStaticExportBuild()
    ? undefined
    : await searchParams;
  const selectedAccount = resolveSelectedAccount(resolvedSearchParams);
  const ladderBuildFilters = resolveLadderBuildFilters(resolvedSearchParams);
  const snapshotReadToken = process.env["SNAPSHOT_READ_TOKEN"]?.trim();
  const snapshotReadOptions = snapshotReadToken ? { snapshotReadToken } : {};
  const [
    dataset,
    datasetVisualSummary,
    gggOAuthStatus,
    snapshotList,
    ladderBuilds,
    craftingEstimate,
    priceCheck,
  ] = await Promise.all([
    getDashboardDataset(),
    getDashboardDatasetVisualSummary(),
    getDashboardGggOAuthStatus(),
    getDashboardSnapshots(
      selectedAccount,
      defaultApiBaseUrl,
      fetch,
      snapshotReadOptions,
    ),
    getDashboardLadderBuilds(defaultApiBaseUrl, fetch, ladderBuildFilters),
    getDashboardCraftingEstimate(),
    getDashboardPriceCheck(),
  ]);
  const latestSnapshot =
    snapshotList.snapshots[snapshotList.snapshots.length - 1];
  const explicitSnapshotId = firstSearchParam(
    resolvedSearchParams?.snapshotId,
  )?.trim();
  const selectedSnapshot =
    resolveSelectedSnapshot(snapshotList.snapshots, explicitSnapshotId) ??
    latestSnapshot;
  const selectedSnapshotId = selectedSnapshot?.snapshotId;
  const explicitBuildId = firstSearchParam(
    resolvedSearchParams?.buildId,
  )?.trim();
  const selectedLadderBuildId = resolveSelectedLadderBuildId(
    resolvedSearchParams,
    ladderBuilds.builds[0]?.id,
  );
  const [
    snapshotDiff,
    selectedSnapshotDetail,
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
    selectedSnapshotId
      ? getDashboardSnapshot(
          snapshotList.account,
          selectedSnapshotId,
          defaultApiBaseUrl,
          fetch,
          snapshotReadOptions,
        )
      : getDashboardLatestSnapshot(
          snapshotList.account,
          snapshotList.snapshots,
          defaultApiBaseUrl,
          fetch,
          snapshotReadOptions,
        ),
    getDashboardLadderBuild(selectedLadderBuildId),
    getDashboardSnapshotAdvisor(
      snapshotList.account,
      selectedSnapshotId,
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
  const hasExplicitSnapshotSelection = Boolean(explicitSnapshotId);
  const visualLoadoutPreview = createVisualLoadoutPreview(
    selectedSnapshotDetail.snapshot,
    hasExplicitSnapshotSelection
      ? null
      : ladderBuildDetail.source === "api"
        ? ladderBuildDetail.build
        : null,
    hasExplicitSnapshotSelection
      ? "Selected account snapshot"
      : "Latest account snapshot",
  );
  const advisorBuildExport = createAdvisorBuildExport(
    visualLoadoutPreview,
    snapshotAdvisor.response.upgrades,
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
                  href={item.href}
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
          <header
            id="overview"
            className="flex flex-col gap-4 border-b border-base-300/60 bg-base-100/75 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between lg:px-6"
          >
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
              <CharacterBuildPreviewPanel
                loadout={visualLoadoutPreview}
                visualSummary={datasetVisualSummary}
              />
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
                <div
                  id="gear"
                  className="min-w-0 rounded-lg border border-base-300/70 bg-base-200/72"
                >
                  <DatasetSearchPanel
                    initialItems={dataset.items}
                    datasetSource={datasetSource}
                    patch={dashboardDatasetVersion.patch}
                    apiBaseUrl={defaultApiBaseUrl}
                  />
                </div>

                <Panel
                  id="economy"
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
                id="crafting"
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
                title="Clipboard price check"
                icon={<WalletCards className="size-4" aria-hidden="true" />}
              >
                <div className="mb-3 rounded-md border border-info/30 bg-info/10 p-3 text-xs font-medium text-info">
                  Parsed clipboard item - {priceCheck.response.source}
                  {priceCheck.source === "fallback" ? " fallback" : ""}
                </div>
                <div className="rounded-md border border-base-300/70 bg-base-100/45 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase text-base-content/55">
                        {priceCheck.response.parsedItem.itemClass}
                      </p>
                      <h3 className="truncate text-sm font-semibold text-base-content">
                        {priceCheck.response.parsedItem.name}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      {priceCheck.response.price
                        ? `${priceCheck.response.price.chaosEquivalent} chaos`
                        : "No price"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md bg-base-200/80 p-2">
                      <p className="text-xs text-base-content/55">Matched</p>
                      <p className="font-semibold text-base-content">
                        {priceCheck.response.matchedBy
                          ? `Matched by ${priceCheck.response.matchedBy}`
                          : "No match"}
                      </p>
                    </div>
                    <div className="rounded-md bg-base-200/80 p-2">
                      <p className="text-xs text-base-content/55">Category</p>
                      <p className="font-semibold capitalize text-base-content">
                        {priceCheck.response.item.category}
                      </p>
                    </div>
                  </div>
                  {priceCheck.response.parsedItem.properties.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-xs leading-5 text-base-content/65">
                      {priceCheck.response.parsedItem.properties
                        .slice(0, 3)
                        .map((property) => (
                          <li key={`${property.name}-${property.value}`}>
                            {property.name}: {property.value}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </div>
              </Panel>

              <Panel
                id="snapshots"
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
                {selectedSnapshot ? (
                  <div className="space-y-3">
                    {[...snapshotList.snapshots].reverse().map((snapshot) => {
                      const isSelected =
                        snapshot.snapshotId === selectedSnapshotId;

                      return (
                        <article
                          key={snapshot.snapshotId}
                          className={`rounded-md border bg-base-100/45 p-3 ${
                            isSelected
                              ? "border-primary/60"
                              : "border-base-300/70"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs uppercase text-base-content/55">
                                {isSelected
                                  ? "Selected snapshot"
                                  : snapshotList.account}
                              </p>
                              <h3 className="mt-1 break-all text-sm font-semibold text-base-content">
                                {snapshot.snapshotId}
                              </h3>
                              <p className="mt-1 break-all text-xs text-base-content/55">
                                {snapshot.objectKey}
                              </p>
                            </div>
                            <RotateCcw
                              className="size-4 shrink-0 text-primary"
                              aria-hidden="true"
                            />
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-md bg-base-200/80 p-2">
                              <p className="text-xs text-base-content/55">
                                Uploaded
                              </p>
                              <p className="truncate font-medium text-base-content">
                                {formatSnapshotTimestamp(snapshot.uploadedAt)}
                              </p>
                            </div>
                            <div className="rounded-md bg-base-200/80 p-2">
                              <p className="text-xs text-base-content/55">
                                Size
                              </p>
                              <p className="font-medium text-base-content">
                                {formatBytes(snapshot.size)}
                              </p>
                            </div>
                          </div>
                          <a
                            className={`btn btn-xs mt-3 w-full ${
                              isSelected ? "btn-outline" : "btn-primary"
                            }`}
                            href={buildSnapshotHref(
                              snapshotList.account,
                              ladderBuildFilters,
                              snapshot.snapshotId,
                              explicitBuildId,
                            )}
                          >
                            {isSelected ? "Viewing snapshot" : "Restore view"}
                            <ChevronRight
                              className="size-3"
                              aria-hidden="true"
                            />
                          </a>
                        </article>
                      );
                    })}
                  </div>
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
                <form
                  action="/"
                  className="mb-3 grid grid-cols-[minmax(0,1fr)] gap-2 rounded-md border border-base-300/70 bg-base-100/45 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <input type="hidden" name="account" value={selectedAccount} />
                  <label className="min-w-0">
                    <span className="mb-1 block text-xs font-medium uppercase text-base-content/55">
                      Ladder filters
                    </span>
                    <input
                      className="input input-sm w-full"
                      name="className"
                      placeholder="Class"
                      defaultValue={ladderBuildFilters.className ?? ""}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-xs font-medium uppercase text-base-content/55">
                      Skill
                    </span>
                    <input
                      className="input input-sm w-full"
                      name="skill"
                      placeholder="Main skill"
                      defaultValue={ladderBuildFilters.skill ?? ""}
                    />
                  </label>
                  <button className="btn btn-primary btn-sm self-end">
                    Filter
                  </button>
                </form>
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
                          className={`rounded-md border bg-base-100/45 p-3 ${
                            buildDetail.id === ladderBuildDetail.build?.id
                              ? "border-primary/60"
                              : "border-base-300/70"
                          }`}
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
                          <a
                            href={buildLadderBuildHref(
                              selectedAccount,
                              ladderBuildFilters,
                              build.id,
                            )}
                            className="btn btn-primary btn-xs mt-2 w-full"
                          >
                            Inspect build
                            <ChevronRight
                              className="size-3"
                              aria-hidden="true"
                            />
                          </a>
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

              <DatasetVisualCatalogPanel visualSummary={datasetVisualSummary} />

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
                id="settings"
                title="GGG account link"
                icon={<KeyRound className="size-4" aria-hidden="true" />}
              >
                <GggOAuthLinkPanel
                  status={gggOAuthStatus}
                  apiBaseUrl={defaultApiBaseUrl}
                  defaultAccount={snapshotList.account}
                />
              </Panel>

              <DesktopPathsPanel advisorBuildExport={advisorBuildExport} />

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

function isStaticExportBuild() {
  return process.env["NEXT_OUTPUT"] === "export";
}

function CharacterBuildPreviewPanel({
  loadout,
  visualSummary,
}: {
  loadout: VisualLoadoutPreview;
  visualSummary: DashboardDatasetVisualSummary;
}) {
  const equippedItems = equipmentSlots
    .map((slot) => findEquipmentSlot(loadout.equipment, slot))
    .filter((item): item is VisualLoadoutPreview["equipment"][number] =>
      Boolean(item),
    );
  const openSlots = equipmentSlots.filter(
    (slot) => !findEquipmentSlot(loadout.equipment, slot),
  );
  const imageBackedCount = equippedItems.filter((item) => item.iconUrl).length;
  const passiveNodePreview = loadout.passiveTree.nodeIds.slice(0, 6);
  const visualSamples = getVisualSummarySamples(visualSummary);

  return (
    <Panel
      id="character"
      title="Loadout workbench"
      icon={<Swords className="size-4" aria-hidden="true" />}
      className="overflow-hidden"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_18rem]">
        <div className="min-w-0 rounded-md border border-base-300/70 bg-base-100/45 p-4">
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-base-content/55">
                Level {loadout.character.level} {loadout.character.className}
              </p>
              <h3 className="mt-1 truncate text-2xl font-semibold text-base-content">
                {loadout.character.name}
              </h3>
              <p className="mt-2 text-sm text-base-content/60">
                {loadout.character.league}
              </p>
            </div>
            <p className="w-fit rounded-md border border-info/35 bg-info/10 px-3 py-2 text-xs font-medium text-info">
              {loadout.sourceLabel}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <MetricTile label="Equipped" value={`${equippedItems.length}`} />
            <MetricTile label="Images" value={`${imageBackedCount}`} />
            <MetricTile label="Open" value={`${openSlots.length}`} />
          </div>

          <p className="mt-3 text-sm text-base-content/65">
            {equippedItems.length} equipped slots - {imageBackedCount} with
            images - {openSlots.length} open slots
          </p>

          <div className="mt-4 space-y-2 text-sm">
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

        <div className="min-w-0 space-y-4">
          <section aria-label="Equipped gear" className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-base-content">
                <ImageIcon className="size-4 text-primary" aria-hidden="true" />
                <h3>Equipped gear</h3>
              </div>
              <span className="rounded-md border border-base-300/70 bg-base-100/50 px-2 py-1 text-xs text-base-content/65">
                Gear with images: {imageBackedCount}
              </span>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2">
              {equippedItems.map((item) => (
                <article
                  key={`${item.slot}-${item.name}`}
                  className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-md border border-base-300/70 bg-base-100/45 p-3"
                >
                  <EquipmentThumb item={item} />
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase text-base-content/55">
                          {item.slot}
                        </p>
                        <h4 className="mt-1 truncate text-sm font-semibold text-base-content">
                          {item.name}
                        </h4>
                      </div>
                      <span className="shrink-0 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs capitalize text-primary">
                        {item.rarity}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-base-content/60">
                      {item.stats.map((stat) => (
                        <li key={stat} className="truncate">
                          {stat}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}

              {equippedItems.length === 0 ? (
                <p className="rounded-md border border-dashed border-base-300/70 bg-base-100/30 p-4 text-sm text-base-content/65">
                  No equipped gear captured yet.
                </p>
              ) : null}
            </div>
          </section>
          <section
            aria-label="Image-backed catalog samples"
            className="min-w-0 rounded-md border border-base-300/70 bg-base-100/45 p-3"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-base-content">
                Image-backed catalog samples
              </h3>
              <span className="rounded-md border border-base-300/70 bg-base-200/70 px-2 py-1 text-xs text-base-content/65">
                {visualSummary.response.totalVisualItems} image-backed records
              </span>
            </div>
            {visualSamples.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {visualSamples.map((sample) => (
                  <div key={sample.id} className="min-w-0">
                    <div className="aspect-square rounded-md border border-base-300/70 bg-base-300/35 p-2">
                      <img
                        src={sample.iconUrl}
                        alt={`${sample.name} icon`}
                        title={sample.iconAttribution}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <p className="mt-1 truncate text-xs font-medium text-base-content">
                      {sample.name}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed border-base-300/70 bg-base-200/55 p-3 text-sm text-base-content/65">
                No usable image-backed samples in the current artifact.
              </p>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-3">
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
            {passiveNodePreview.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2" role="list">
                {passiveNodePreview.map((nodeId) => (
                  <span
                    key={nodeId}
                    className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                    role="listitem"
                  >
                    {nodeId}
                  </span>
                ))}
              </div>
            ) : null}
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

          <div className="rounded-md border border-base-300/70 bg-base-100/45 p-3">
            <h3 className="text-sm font-semibold text-base-content">
              Open slots
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {openSlots.map((slot) => (
                <span
                  key={slot}
                  className="rounded-md border border-base-300/70 bg-base-200/70 px-2 py-1 text-xs text-base-content/65"
                >
                  {slot}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-base-300/70 bg-base-100/45 p-3">
            <h3 className="text-sm font-semibold text-base-content">
              Workbench actions
            </h3>
            <div className="mt-3 grid gap-2">
              <a
                className="btn btn-primary btn-sm justify-between"
                href="#gear"
              >
                Search item data
                <ChevronRight className="size-4" aria-hidden="true" />
              </a>
              <a
                className="btn btn-outline btn-sm justify-between"
                href="#snapshots"
              >
                Restore snapshot
                <ChevronRight className="size-4" aria-hidden="true" />
              </a>
              <a
                className="btn btn-outline btn-sm justify-between"
                href="#economy"
              >
                Check economy
                <ChevronRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function DatasetVisualCatalogPanel({
  visualSummary,
}: {
  visualSummary: DashboardDatasetVisualSummary;
}) {
  const categories = visualSummary.response.categories.slice(0, 4);

  return (
    <Panel
      title="Visual item catalog"
      icon={<ImageIcon className="size-4" aria-hidden="true" />}
    >
      <div className="mb-3 rounded-md border border-info/30 bg-info/10 p-3 text-xs font-medium text-info">
        {visualSummary.source === "api"
          ? "Published R2 artifact"
          : "Demo fallback"}{" "}
        - {visualSummary.response.totalVisualItems} image-backed records
      </div>
      <div className="space-y-3">
        {categories.map((category) => (
          <section
            key={category.category}
            className="rounded-md border border-base-300/70 bg-base-100/45 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-base-content">
                  {formatStatLabel(category.category)}
                </h3>
                <p className="mt-1 text-xs text-base-content/55">
                  {category.totalItems} bases - {category.totalUniques} uniques
                </p>
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                {category.iconCount} icons
              </span>
            </div>
            {category.featured.some((item) =>
              isUsableVisualIcon(item.iconUrl),
            ) ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {category.featured
                  .filter((item) => isUsableVisualIcon(item.iconUrl))
                  .slice(0, 4)
                  .map((item) => (
                    <div key={item.id} className="min-w-0">
                      <div className="aspect-square rounded-md border border-base-300/70 bg-base-300/35 p-2">
                        <img
                          src={item.iconUrl}
                          alt={`${item.name} icon`}
                          title={item.iconAttribution}
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <p className="mt-1 truncate text-xs font-medium text-base-content">
                        {item.name}
                      </p>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="mt-3 rounded-md border border-dashed border-base-300/70 p-3 text-xs text-base-content/60">
                No image-backed records in this category yet.
              </p>
            )}
          </section>
        ))}
      </div>
    </Panel>
  );
}

function getVisualSummarySamples(visualSummary: DashboardDatasetVisualSummary) {
  return visualSummary.response.categories
    .flatMap((category) => category.featured)
    .filter((item) => isUsableVisualIcon(item.iconUrl))
    .slice(0, 4);
}

function isUsableVisualIcon(iconUrl: string) {
  const lowerIconUrl = iconUrl.toLowerCase();

  return !lowerIconUrl.includes("calandra.pages.dev/demo-");
}

function createVisualLoadoutPreview(
  snapshot: AccountSnapshot | null,
  ladderBuild: LadderBuild | null,
  snapshotSourceLabel = "Latest account snapshot",
): VisualLoadoutPreview {
  if (ladderBuild && hasVisualBuildGear(ladderBuild)) {
    return createLadderBuildLoadoutPreview(ladderBuild);
  }

  const character = snapshot?.characters[0];

  if (!character) {
    return fallbackVisualLoadoutPreview;
  }

  return {
    sourceLabel: snapshotSourceLabel,
    character: {
      name: character.name,
      className: character.className,
      level: character.level,
      league: character.league,
    },
    stats: buildSnapshotStatRows(snapshot),
    equipment:
      character.equipment.length > 0
        ? toVisualEquipment(character.equipment, "Snapshot gear item")
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

function createLadderBuildLoadoutPreview(
  ladderBuild: LadderBuild,
): VisualLoadoutPreview {
  const equipment = ladderBuild.equipment ?? [];
  const passiveTree = ladderBuild.passiveTree;
  const passiveNodeIds =
    ladderBuild.passiveSkillIds ??
    [...(passiveTree?.keystones ?? []), ...(passiveTree?.notables ?? [])].map(
      (name) => name.toLowerCase().replace(/\s+/g, "-"),
    );

  return {
    sourceLabel: "Published ladder build",
    character: {
      name: ladderBuild.character,
      className: ladderBuild.className,
      level: ladderBuild.level,
      league: dashboardDatasetVersion.league,
    },
    stats: buildGearStatRows(equipment),
    equipment: toVisualEquipment(equipment, "Ladder gear item"),
    passiveTree: {
      allocated: passiveTree?.allocatedCount ?? passiveNodeIds.length,
      focus:
        passiveTree?.summary ??
        ([...(passiveTree?.keystones ?? []), ...(passiveTree?.notables ?? [])]
          .slice(0, 4)
          .join(", ") ||
          "Published build passive allocation"),
      nodeIds: passiveNodeIds,
      source: "Published poe.ninja ladder passive summary",
      referenceUrl:
        passiveTree?.url ??
        ladderBuild.passiveTreeUrl ??
        fallbackVisualLoadoutPreview.passiveTree.referenceUrl,
    },
  };
}

function createAdvisorBuildExport(
  loadout: VisualLoadoutPreview,
  upgrades: AdvisorBuildExport["upgrades"],
): AdvisorBuildExport {
  return {
    name: loadout.character.name,
    className: loadout.character.className,
    level: loadout.character.level,
    league: loadout.character.league,
    patch: dashboardDatasetVersion.patch,
    passiveSkillIds: loadout.passiveTree.nodeIds,
    equipment: loadout.equipment.map((item) => ({
      slot: item.slot,
      name: item.name,
    })),
    upgrades,
  };
}

function hasVisualBuildGear(ladderBuild: LadderBuild) {
  return Boolean(ladderBuild.equipment?.some((item) => item.iconUrl));
}

function toVisualEquipment(
  equipment: AccountSnapshotGearItem[],
  fallbackStat: string,
): VisualLoadoutPreview["equipment"] {
  return equipment.map((item) => ({
    slot: item.slot,
    name: item.name,
    rarity: item.rarity ?? "normal",
    iconUrl: normalizeGearIconUrl(item.iconUrl),
    stats: item.stats
      ? Object.entries(item.stats)
          .slice(0, 2)
          .map(([key, value]) => `${formatStatLabel(key)} ${value}`)
      : [fallbackStat],
  }));
}

function normalizeGearIconUrl(iconUrl: string | undefined) {
  if (!iconUrl) {
    return undefined;
  }

  const lowerIconUrl = iconUrl.toLowerCase();

  if (
    lowerIconUrl.startsWith("data:image/svg+xml") ||
    lowerIconUrl.includes("calandra.pages.dev/demo-")
  ) {
    return undefined;
  }

  return iconUrl;
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-base-300/70 bg-base-200/70 p-2">
      <p className="text-xs text-base-content/55">{label}</p>
      <p className="mt-1 text-lg font-semibold text-base-content">{value}</p>
    </div>
  );
}

function EquipmentThumb({
  item,
}: {
  item: VisualLoadoutPreview["equipment"][number];
}) {
  if (!item.iconUrl) {
    return (
      <div className="grid aspect-square place-items-center rounded-md border border-dashed border-base-300/80 bg-base-300/25 p-2 text-center text-[0.7rem] font-medium leading-4 text-base-content/45">
        <div>
          <ImageIcon className="mx-auto size-4" aria-hidden="true" />
          <span className="mt-1 block">No image</span>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-square rounded-md border border-base-300/70 bg-base-300/35 p-2">
      <img
        src={item.iconUrl}
        alt={item.name}
        loading="lazy"
        className="h-full w-full object-contain"
      />
    </div>
  );
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
  const account = firstSearchParam(searchParams?.account);

  return account?.trim() || "example";
}

function resolveLadderBuildFilters(
  searchParams: HomeSearchParams | undefined,
): DashboardLadderBuildFilters {
  const filters: DashboardLadderBuildFilters = { limit: 8 };
  const className = firstSearchParam(searchParams?.className)?.trim();
  const skill = firstSearchParam(searchParams?.skill)?.trim();

  if (className) filters.className = className;
  if (skill) filters.skill = skill;

  return filters;
}

function resolveSelectedLadderBuildId(
  searchParams: HomeSearchParams | undefined,
  fallbackBuildId: string | undefined,
) {
  return firstSearchParam(searchParams?.buildId)?.trim() || fallbackBuildId;
}

function resolveSelectedSnapshot(
  snapshots: { snapshotId: string }[],
  requestedSnapshotId: string | undefined,
) {
  if (!requestedSnapshotId) {
    return undefined;
  }

  return snapshots.find(
    (snapshot) => snapshot.snapshotId === requestedSnapshotId,
  );
}

function buildLadderBuildHref(
  account: string,
  filters: DashboardLadderBuildFilters,
  buildId: string,
) {
  const query = new URLSearchParams({ account });

  if (filters.className) query.set("className", filters.className);
  if (filters.skill) query.set("skill", filters.skill);
  query.set("buildId", buildId);

  return `?${query.toString()}`;
}

function buildSnapshotHref(
  account: string,
  filters: DashboardLadderBuildFilters,
  snapshotId: string,
  buildId: string | undefined,
) {
  const query = new URLSearchParams({ account, snapshotId });

  if (filters.className) query.set("className", filters.className);
  if (filters.skill) query.set("skill", filters.skill);
  if (buildId) query.set("buildId", buildId);

  return `?${query.toString()}`;
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildSnapshotStatRows(snapshot: AccountSnapshot) {
  const character = snapshot.characters[0];
  const statRows = buildGearStatRows(character?.equipment ?? []);

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

function buildGearStatRows(equipment: AccountSnapshotGearItem[]) {
  const totals = new Map<string, number>();

  for (const item of equipment) {
    for (const [key, value] of Object.entries(item.stats ?? {})) {
      totals.set(key, (totals.get(key) ?? 0) + value);
    }
  }

  return Array.from(totals.entries())
    .slice(0, 4)
    .map(([key, value]) => ({
      label: formatStatLabel(key),
      value: String(value),
    }));
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
  id,
  title,
  icon,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`min-w-0 rounded-lg border border-base-300/70 bg-base-200/72 p-4 shadow-sm shadow-black/10 ${className}`}
    >
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
