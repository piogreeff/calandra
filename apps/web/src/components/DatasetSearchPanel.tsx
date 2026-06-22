"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import type {
  DashboardDataset,
  DashboardSearchResults,
} from "../lib/read-api";
import { getDashboardSearch } from "../lib/read-api";

export type DatasetSearchRow = {
  id: string;
  name: string;
  kind: string;
  detail: string;
  iconUrl: string | undefined;
  iconAttribution: string | undefined;
};

export function DatasetSearchPanel({
  initialItems,
  datasetSource,
  patch,
  apiBaseUrl,
}: {
  initialItems: DashboardDataset["items"];
  datasetSource: string;
  patch: string;
  apiBaseUrl: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DashboardSearchResults | null>(null);
  const [isPending, startTransition] = useTransition();
  const rows = results
    ? toDatasetSearchRows(results)
    : toDatasetInitialRows(initialItems);
  const source = results?.source === "api" ? "Search API" : datasetSource;

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-base-300/70 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold">
            Patch-versioned item database
          </h2>
          <p className="mt-1 text-sm text-base-content/60">
            {datasetSource} via /openapi.json
          </p>
        </div>
        <form
          className="flex min-w-0 gap-2 md:w-[24rem]"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setResults(await getDashboardSearch(query, apiBaseUrl));
            });
          }}
        >
          <label className="input input-sm flex min-h-9 min-w-0 flex-1 items-center gap-2">
            <Search
              className="size-4 shrink-0 text-base-content/45"
              aria-hidden="true"
            />
            <span className="sr-only">Dataset search</span>
            <input
              type="search"
              className="min-w-0 grow"
              placeholder="Search bases, uniques, mods"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <button className="btn btn-primary btn-sm shrink-0" type="submit">
            <Search className="size-4" aria-hidden="true" />
            <span>Search</span>
          </button>
        </form>
      </div>
      <div className="border-b border-base-300/70 px-4 py-2 text-xs text-base-content/55">
        {results
          ? `${rows.length} matches for "${results.query}"`
          : `${rows.length} indexed records shown`}
        {isPending ? " - Searching" : ""}
      </div>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Detail</th>
              <th>Patch</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="flex min-w-48 items-center gap-3">
                    {row.iconUrl ? (
                      <DatasetIcon row={row} />
                    ) : (
                      <span
                        className="grid size-10 shrink-0 place-items-center rounded-md border border-base-300/70 bg-base-300/35 text-xs font-semibold text-base-content/60"
                        aria-hidden="true"
                      >
                        {row.kind.charAt(0)}
                      </span>
                    )}
                    <span className="font-medium text-base-content">
                      {row.name}
                    </span>
                  </div>
                </td>
                <td>{row.kind}</td>
                <td>{row.detail}</td>
                <td>{patch}</td>
                <td>{source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DatasetIcon({ row }: { row: DatasetSearchRow }) {
  const fallback = datasetIconFallback(row.kind);
  const imageRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState(row.iconUrl ?? fallback);

  useEffect(() => {
    setSrc(row.iconUrl ?? fallback);
  }, [fallback, row.iconUrl]);

  useEffect(() => {
    const image = imageRef.current;

    if (image?.complete && image.naturalWidth === 0) {
      setSrc(fallback);
    }
  }, [fallback, src]);

  return (
    <img
      ref={imageRef}
      src={src}
      alt={`${row.name} icon`}
      title={row.iconAttribution}
      onError={() => setSrc(fallback)}
      className="size-10 shrink-0 rounded-md border border-base-300/70 bg-base-300/35 object-contain p-1"
    />
  );
}

export function toDatasetInitialRows(
  items: DashboardDataset["items"],
): DatasetSearchRow[] {
  return items.map((item) => ({
    id: `initial-${item.id}`,
    name: item.name,
    kind: item.rarity === "unique" ? "Unique" : "Base",
    detail: formatCategory(item.category),
    iconUrl: item.iconUrl,
    iconAttribution: item.iconAttribution,
  }));
}

export function toDatasetSearchRows(
  results: DashboardSearchResults,
): DatasetSearchRow[] {
  return [
    ...results.items.map((item) => ({
      id: `item-${item.id}`,
      name: item.name,
      kind: "Base",
      detail: formatCategory(item.category),
      iconUrl: item.iconUrl,
      iconAttribution: item.iconAttribution,
    })),
    ...results.uniques.map((item) => ({
      id: `unique-${item.id}`,
      name: item.name,
      kind: "Unique",
      detail: formatCategory(item.category),
      iconUrl: item.iconUrl,
      iconAttribution: item.iconAttribution,
    })),
    ...results.mods.map((mod) => ({
      id: `mod-${mod.id}`,
      name: mod.name,
      kind: "Modifier",
      detail: mod.domain,
      iconUrl: undefined,
      iconAttribution: undefined,
    })),
    ...results.gems.map((gem) => ({
      id: `gem-${gem.id}`,
      name: gem.name,
      kind: "Gem",
      detail: gem.kind,
      iconUrl: undefined,
      iconAttribution: undefined,
    })),
  ];
}

function formatCategory(category: string) {
  return category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function datasetIconFallback(kind: string) {
  const label = encodeURIComponent(kind.charAt(0).toUpperCase() || "?");

  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='8' fill='%23192330'/%3E%3Crect x='4' y='4' width='40' height='40' rx='6' fill='%23263344' stroke='%235a6b82'/%3E%3Ctext x='24' y='31' text-anchor='middle' font-family='Arial,sans-serif' font-size='18' font-weight='700' fill='%23d9e6f2'%3E${label}%3C/text%3E%3C/svg%3E`;
}
