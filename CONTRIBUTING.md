# Contributing to Calandra

Thanks for your interest. A few things make this project unusual — read the hard rules before you write code.

## Hard rules (non-negotiable)

These protect users from account bans and the project from takedowns. PRs that cross these lines will be closed.

1. **The desktop agent never touches the game process.** No memory reading, no injection, no overlays that read the screen, no input automation beyond a single user-initiated keypress. The model is: read-only overlay + one server action per user action.
2. **No scrapers in clients or self-host paths.** Game data is produced by the maintainer's pipeline and published as a dataset. Self-hosters and clients *consume* it. Do not add code that scrapes poe2db, poe.ninja, or any other site from the app.
3. **Never scrape Maxroll or Mobalytics.** Their guide content is copyrighted. Link out instead.
4. **Ship no game assets.** Item art and data are GGG IP under their fan content policy — referenced and cached with attribution, never committed or relicensed.
5. **Official API hygiene.** Descriptive `User-Agent` with contact, OAuth scopes, honor rate limits with backoff, encrypt tokens at rest.

## Setup

```bash
git clone https://github.com/piogreeff/calandra
cd calandra
cp .env.example .env   # fill in your keys
pnpm install
pnpm run setup         # idempotent bootstrap
```

Requires Node 20+, pnpm 9+, and (for the desktop app) the Rust toolchain + Tauri prerequisites.

## Monorepo layout

```
apps/api        Cloudflare Workers backend (source of truth)
apps/web        Next.js 15 + FlyonUI (also runs in the Tauri webview)
apps/desktop    Tauri 2 shell (Rust core)
apps/mcp        MCP server (Phase 6)
apps/mobile     Expo client (stretch, Phase 7)
packages/contract   Zod + OpenAPI — the API contract (CODEOWNERS-gated)
packages/parser     item-text + Client.txt parsers
packages/engine     deterministic upgrade + crafting engine (pure, no LLM)
packages/dataset    dataset build + publish tooling
packages/ui         shared FlyonUI theme tokens + components
```

## Conventions

- **TypeScript strict** everywhere. `engine` and `parser` are pure and fully unit-tested.
- **Conventional Commits** (`feat:`, `fix:`, `docs:`…). One epic per branch, squash-merge.
- Clients hold no business logic — it lives behind the API contract.

## Merge gates (CI)

Every PR must pass: typecheck, lint, unit tests, contract tests, secret scan, dependency license check, and **docs-current** (update `README`, `.env.example`, and `docs/SELF_HOSTING.md` when setup or env keys change).

## Reporting security issues

Do not open a public issue. See [`SECURITY.md`](SECURITY.md).
