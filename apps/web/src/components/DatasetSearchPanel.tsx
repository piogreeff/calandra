"use client";

import { Search } from "lucide-react";
import { useState, useTransition } from "react";
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
    : initialItems.map((item) => ({
        id: `initial-${item.id}`,
        name: item.name,
        kind: item.rarity === "unique" ? "Unique" : "Base",
        detail: formatCategory(item.category),
      }));
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
                <td className="font-medium text-base-content">{row.name}</td>
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

export function toDatasetSearchRows(
  results: DashboardSearchResults,
): DatasetSearchRow[] {
  return [
    ...results.items.map((item) => ({
      id: `item-${item.id}`,
      name: item.name,
      kind: "Base",
      detail: formatCategory(item.category),
    })),
    ...results.uniques.map((item) => ({
      id: `unique-${item.id}`,
      name: item.name,
      kind: "Unique",
      detail: formatCategory(item.category),
    })),
    ...results.mods.map((mod) => ({
      id: `mod-${mod.id}`,
      name: mod.name,
      kind: "Modifier",
      detail: mod.domain,
    })),
    ...results.gems.map((gem) => ({
      id: `gem-${gem.id}`,
      name: gem.name,
      kind: "Gem",
      detail: gem.kind,
    })),
  ];
}

function formatCategory(category: string) {
  return category
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
