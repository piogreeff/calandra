# AGENTS.md

Operating manual for coding agents (Codex, Claude Code, Cursor, etc.) working in this repo. Read this fully before making changes.

## What Calandra is

An AI-powered, open-source **Path of Exile 2** companion. A local **Tauri 2** desktop agent reads the player's live character (clipboard parse + official GGG OAuth API); a **Cloudflare Workers** backend serves a patch-versioned gear database, an AI upgrade advisor, account snapshots, a crafting calculator, and an MCP server. API-first: one typed contract, many clients.

Unofficial fan tool — not affiliated with Grinding Gear Games. Ships no game assets.

## Hard constraints (do not violate)

1. Desktop agent must **never** inject into the PoE2 process, read game memory, or automate input beyond a single user-initiated keypress. Read-only overlay + one server action per user action.
2. **No scrapers in clients or self-host paths.** The maintainer runs scrapers and publishes a dataset; everything else consumes it.
3. Never scrape Maxroll or Mobalytics (copyrighted). Link out.
4. Ship no game art/data in the repo; reference and cache with attribution.
5. Official API: descriptive `User-Agent` + contact, OAuth scopes, honor rate limits, encrypt tokens at rest.
6. **Patch-versioned data only** — every game-data write is keyed by `{league, patch}`.

If a task seems to require crossing any of these, stop and flag it rather than implementing it.

## Layout

```
apps/api      Workers (Hono) — source of truth
apps/web      Next.js 15 + FlyonUI (also runs in Tauri webview)
apps/desktop  Tauri 2 (Rust core): overlay, hotkey, clipboard, fs watch, .build writer
apps/mcp      MCP server (Phase 6)
apps/mobile   Expo (stretch, Phase 7)
packages/contract  Zod + OpenAPI (CODEOWNERS-gated)
packages/parser    item-text + Client.txt parsers
packages/engine    deterministic upgrade + crafting engine (pure, no LLM)
packages/dataset   dataset build + publish
packages/ggg-api   official GGG API client hygiene: UA, scopes, backoff, token encryption
packages/ui        FlyonUI theme tokens + components
docs/              ARCHITECTURE.md, SELF_HOSTING.md
```

## Setup

```bash
cp .env.example .env
pnpm install
pnpm run setup
```

Node 20+, pnpm 9+, Rust toolchain for the desktop app.

## Conventions & gates

- TypeScript strict. `engine`/`parser` are pure and fully unit-tested. Clients carry no business logic.
- Conventional Commits; one epic per branch; squash-merge.
- CI gates: typecheck, lint, unit tests, **contract tests** (clients fail if they drift from `packages/contract`), secret scan, dependency license check, docs-current.
- The AI advisor uses the **deterministic engine for all numbers** (mod tiers, crafting odds, costs). The LLM only explains and strategises over a compact, pre-computed context. Never let the LLM invent game values.
- AI cost budget: p95 advisory session < $1.

## Where to start

The current build plan, phases, and merge gates live in the maintainer's build brief. Public architecture is in `docs/ARCHITECTURE.md`. Phase 0 is: confirm PoE2 coverage of the GGG OAuth character/stash API, scaffold the monorepo + contract, and stand up the doc/CI skeleton.
