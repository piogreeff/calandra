# Calandra

An AI-powered, open-source companion for **Path of Exile 2** — it mirrors your character back to you: live upgrade recommendations, crafting cost/strategy, account snapshots, and a patch-versioned gear database (uniques included). Desktop-first (Tauri), Cloudflare-native backend, API-first so a mobile client and an MCP server plug into the same core.

![status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange)
![license: MIT](https://img.shields.io/badge/license-MIT-blue)

> **Unofficial fan tool.** Calandra is not affiliated with, endorsed by, or associated with Grinding Gear Games. _Path of Exile 2_ and all related content are the property of Grinding Gear Games. Calandra ships no game assets; it links to and caches publicly available data under GGG's fan content policy.

---

## What it does

- **Upgrade advisor** — parses your current character (clipboard or the official API), reasons over the live economy, and ranks your next-best gear upgrades with buy-vs-craft guidance.
- **Crafting calculator** — deterministic cost/outcome modelling over real mod pools and item-level rules, priced against the current market.
- **Account snapshots** — a versioned "time machine" of your characters and stash, plus local backup of loot filters, build files, and configs. (PoE2 is server-authoritative — there is no save file; this snapshots account state via the official API.)
- **Price-check overlay** — copy an item in-game, get a live price.
- **Gear database** — a searchable, patch-versioned database of bases, mods, uniques, and gems, with item images.
- **MCP server** — query Calandra's data and advisor from your own agent.

## How it's built

Hybrid by necessity: anything that reads the live game (overlay, hotkey, clipboard, log watching, build-file writes) runs in a local **Tauri 2** desktop agent; everything else (data, AI, sync, snapshots, MCP) is a **Cloudflare Workers** backend. One typed API contract serves all clients. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

The Worker serves the current contract at `/openapi.json`; during temporary-domain development that is `https://calandra-api.piogreeff.workers.dev/openapi.json`. Published dataset metadata is available at `/datasets/manifest?league=<league>&patch=<patch>` after the Worker validates the artifact checksum and counts.

The MCP server can be launched over stdio for local agent hosts:

```bash
pnpm --filter @calandra/mcp stdio
```

Set `CALANDRA_API_BASE_URL` to point the MCP server at a self-hosted API; if unset it uses the temporary hosted Worker at `https://calandra-api.piogreeff.workers.dev`.

Official GGG API calls should go through `packages/ggg-api`, which enforces Calandra's descriptive `User-Agent`, OAuth scope checks, `429`/rate-limit backoff, and AES-GCM token-at-rest encryption for future character snapshot work.

The dataset package validates maintainer-published game-data artifacts for self-host imports:

```bash
pnpm dataset:import -- --artifact ./data/dawn-0.2.0.json --manifest ./data/dawn-0.2.0.manifest.json
pnpm dataset:import -- --artifact ./data/dawn-0.2.0.json --publish-dir ./dist/datasets --expected-unique-count 200 --minimum-unique-image-coverage 0.95
pnpm dataset:publish -- --artifact ./data/dawn-0.2.0.json --r2-bucket calandra-data --expected-unique-count 200 --minimum-unique-image-coverage 0.95
```

That path consumes a published artifact only; self-host installs do not run scrapers. With `--manifest`, imports verify counts and SHA-256 before use. With `--publish-dir`, it writes the same `datasets/{league}/{patch}.json` layout that the Worker reads from R2 plus a sibling `datasets/{league}/{patch}.manifest.json` containing counts and a SHA-256 checksum. Maintainer publishing can pass `--r2-bucket` to upload both remote R2 objects with Wrangler after validation. `--expected-unique-count` and `--minimum-unique-image-coverage` enforce the Phase 1 unique-image gate before an artifact is published. The Worker validates that manifest before serving R2-backed dataset responses.

## Using it

- **Players:** install the desktop app and point it at the hosted instance — no infrastructure required. _(Coming in a tagged release.)_
- **Self-hosters:** see [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md). You consume a published game-data dataset and bring your own OpenAI key + a GGG OAuth app; you do **not** run scrapers.

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) first — especially the hard rules around what the desktop agent may and may not do (no game-process interaction, no automation beyond a single keypress). Security disclosures go through [`SECURITY.md`](SECURITY.md).

## Acknowledgements

- **Grinding Gear Games** — _Path of Exile 2_ and its data, under their fan content policy.
- **[Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2)** (MIT) — prior art for item-text parsing and overlay behaviour.
- **poe2db** and **poe.ninja** — community data sources (consumed politely, via the published dataset; not re-scraped by every install).
- **[FlyonUI](https://flyonui.com)** — UI layer.

## License

[MIT](LICENSE) © 2026 Pio Greeff
