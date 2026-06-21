# Architecture

A public overview of how Calandra is put together. For contributor rules see [`CONTRIBUTING.md`](../CONTRIBUTING.md); for running your own instance see [`SELF_HOSTING.md`](SELF_HOSTING.md).

## The shape of it

Calandra is a **hybrid**: a local desktop agent plus a cloud backend, joined by one typed API contract.

Anything that must read the live game has to run locally, so it lives in the desktop agent. Everything else is stateless cloud infrastructure.

```
┌────────────────────────────┐        ┌──────────────────────────────────┐
│  Desktop agent (Tauri 2)   │        │  Backend (Cloudflare Workers)      │
│                            │        │                                    │
│  • overlay + global hotkey │        │  • read API (gear, mods, economy) │
│  • clipboard item parse    │  HTTPS │  • AI upgrade advisor              │
│  • Client.txt watcher      │ ─────► │  • account snapshots               │
│  • .build file writer      │        │  • crafting calculator             │
│  • theme persistence       │        │  • MCP server                      │
│  • renders apps/web        │        │                                    │
└────────────────────────────┘        │  KV (economy) · R2 (data/images)  │
                                       │  Vectorize (RAG) · DO (sessions)  │
┌────────────────────────────┐        │  Neon (snapshots) · AI Gateway    │
│  Future clients            │ ─────► │                                    │
│  • MCP server consumers    │        └──────────────────────────────────┘
│  • mobile (Expo, stretch)  │
└────────────────────────────┘
```

## Why hybrid

Overlay-on-game, global hotkeys, clipboard reads, log watching, and writing build files to the PoE2 directory all require local OS access — they cannot run in a web app. So that layer is a native Tauri agent. Data, AI, sync, snapshots, and the MCP server have no such requirement and run on Cloudflare, where they are cheap, stateless, and shared.

Crucially, the agent stays within Grinding Gear Games' third-party policy: it is read-only and performs one server action per user action. It never interacts with the game process.

## Data layer

The maintainer runs the ingest pipeline (game data from poe2db, economy from poe.ninja) on a schedule and publishes a **versioned dataset per `{league, patch}`**. Item images are cached and served with attribution. Self-hosters and clients consume the published dataset rather than scraping — this keeps upstream sites unburdened and self-hosting simple. Economy prices are cached hot in KV (~4h, matching the in-game refresh) with history in Postgres.

## AI layer

Recommendations are computed by a **deterministic engine** — slot scoring, mod tiers, crafting odds and costs all come from real game data and rules. A language model sits on top purely to explain and strategise over a compact, pre-computed context. The model never invents game values. Retrieval (Vectorize) keeps prompts small; an AI Gateway caches repeat queries; sessions run under a hard cost budget.

## Snapshots

Account snapshots are source-agnostic in the contract. Official PoE2 character snapshots can set `source: "official-poe2-character"` with `capabilities.stashes: false`; clipboard/manual imports can carry only what they actually observed. Snapshot comparisons use deterministic engine diffs over characters, equipment, and stash counts rather than model-generated summaries.

## Clients

`apps/web` (Next.js 15 + FlyonUI) is the UI, rendered both standalone and inside the Tauri webview. The MCP server exposes the same read API and advisor as agent tools. A mobile browse/brainstorm client is a planned stretch. All of them speak the single contract in `packages/contract`; none of them hold business logic.

Official Path of Exile API access goes through `packages/ggg-api`. That package centralizes Calandra's required `User-Agent` format, OAuth scope checks, `429`/rate-limit backoff, and AES-GCM token-at-rest encryption so character snapshot code does not grow one-off HTTP or storage behavior.

`apps/mcp` owns the agent tool surface. Its first tools proxy the existing API contract: `search_items`, `price_item`, `recommend_upgrade`, and `get_economy`. The handlers validate Calandra API responses with the shared Zod schemas and return MCP-style text content; transport wiring can wrap the same registry later without changing tool behavior.
