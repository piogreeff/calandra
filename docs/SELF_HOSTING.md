# Self-Hosting Calandra

Calandra is open source and you can run your own backend. Note the split:

- **Just want to play?** Use the desktop app pointed at the hosted instance — no setup. _(Available from a tagged release.)_
- **Want to run your own backend?** This guide. It's developer-grade work, but it is **not** a scraping operation — you consume a published dataset.

## What you do and don't run

You **do** run: the API (Workers), the web UI, and optionally a Neon database for your own account snapshots.

You **do not** run: scrapers. Game data is published by the maintainer as a versioned dataset per `{league, patch}`; your instance downloads and imports it. Please do not point your own scrapers at poe2db or poe.ninja — that's both unnecessary and against the project's rules.

## Prerequisites

- Node 20+ and pnpm 9+
- A Cloudflare account (Workers, KV, R2, Vectorize) and `wrangler`
- An OpenAI API key (used via Cloudflare AI Gateway)
- A registered **GGG OAuth application** (for account snapshots) with a descriptive User-Agent + contact
- Optional: a Neon Postgres database (personal snapshots/history)
- Optional, for the desktop app: the Rust toolchain + Tauri prerequisites

## Steps

```bash
git clone https://github.com/piogreeff/calandra
cd calandra
cp .env.example .env        # fill in every key (see comments in the file)
pnpm install
pnpm run setup              # idempotent bootstrap

# Provision Cloudflare resources (KV, R2, Vectorize) — see wrangler config
pnpm dataset:import -- --artifact ./data/dawn-0.2.0.json --manifest ./data/dawn-0.2.0.manifest.json
pnpm dev                    # run the backend + web locally
```

Until a permanent domain is purchased, the default hosted URLs use Cloudflare temporary domains: `https://calandra.pages.dev` for the app and `https://calandra-api.workers.dev` for the API. Replace those in `.env` once the real domain is available.

## Configuration

Every environment variable is documented in [`.env.example`](../.env.example) — app, AI/AI Gateway, GGG OAuth, Cloudflare bindings, Neon, and Better Auth. Nothing is secret in that file; copy it to `.env` and fill it in.

| Key                       | Purpose                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                | Runtime mode for local scripts and apps.                                                                                         |
| `APP_URL`                 | Public web app URL; defaults to the temporary Cloudflare Pages URL until a permanent domain exists.                              |
| `API_URL`                 | Public API URL; defaults to the temporary Workers URL until a permanent domain exists.                                           |
| `DATASET_VERSION`         | Published `{league, patch}` dataset version to import; `latest` follows the newest published artifact.                           |
| `DATASET_R2_PREFIX`       | R2 object prefix for published artifacts; the API reads `${DATASET_R2_PREFIX}/{league}/{patch}.json`.                            |
| `DATASET_ARTIFACT_JSON`   | Optional dev/self-host Worker binding for a published artifact JSON payload; production should load published artifacts from R2. |
| `OPENAI_API_KEY`          | OpenAI key used through Cloudflare AI Gateway for advisor explanations.                                                          |
| `AI_GATEWAY_URL`          | Cloudflare AI Gateway endpoint for caching and cost control.                                                                     |
| `AI_SESSION_BUDGET_USD`   | Hard per-session advisory budget in USD.                                                                                         |
| `GGG_OAUTH_CLIENT_ID`     | Grinding Gear Games OAuth application client id.                                                                                 |
| `GGG_OAUTH_CLIENT_SECRET` | Grinding Gear Games OAuth application client secret.                                                                             |
| `GGG_OAUTH_REDIRECT_URI`  | OAuth callback URL registered with Grinding Gear Games.                                                                          |
| `GGG_USER_AGENT`          | Required descriptive User-Agent with project URL and contact.                                                                    |
| `CLOUDFLARE_ACCOUNT_ID`   | Cloudflare account id for Workers, KV, R2, Vectorize, and AI Gateway resources.                                                  |
| `CLOUDFLARE_API_TOKEN`    | Cloudflare API token with least-privilege deployment/resource permissions.                                                       |
| `KV_ECONOMY`              | Workers KV binding name for economy cache data.                                                                                  |
| `R2_BUCKET`               | R2 bucket name for published datasets and cached images.                                                                         |
| `VECTORIZE_INDEX`         | Vectorize index name for mods, crafting rules, and uniques retrieval.                                                            |
| `DATABASE_URL`            | Optional Neon Postgres connection string for personal snapshots and history.                                                     |
| `BETTER_AUTH_SECRET`      | Better Auth signing/encryption secret.                                                                                           |
| `BETTER_AUTH_URL`         | Public Better Auth base URL, normally matching `APP_URL`.                                                                        |

## Keeping data current

The dataset is versioned. Set `DATASET_VERSION` (default `latest`) to the intended `{league, patch}` release, download the maintainer-published artifact plus its manifest, and re-run `pnpm dataset:import -- --artifact <artifact.json> --manifest <artifact.manifest.json>` when a new league/patch dataset is published. The manifest records counts and a SHA-256 checksum. Maintainer publishing uses `pnpm dataset:import -- --artifact <artifact.json> --publish-dir <publish-dir> --expected-unique-count <count> --minimum-unique-image-coverage 0.95`, which writes the R2 object layout: `${DATASET_R2_PREFIX}/{league}/{patch}.json` and `${DATASET_R2_PREFIX}/{league}/{patch}.manifest.json` after enforcing the unique-image coverage gate. The API reads both R2 objects and refuses to serve an artifact if the manifest does not match. Your economy cache refreshes on its own schedule.

## A note on cost

The AI advisor runs under a per-session budget (default $1) enforced via the AI Gateway. The deterministic engine does the heavy lifting; the model only explains. Your costs scale with your own usage.
