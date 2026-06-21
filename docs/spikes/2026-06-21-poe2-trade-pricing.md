# PoE2 Trade And Pricing API Spike

Checked on 2026-06-21 against the official Path of Exile developer docs and the public PoE2 trade site.

## Finding

PoE2 has an official developer API for Currency Exchange history, but there is no supported developer API for general item trade-search queries.

For Calandra, live price-checking must use one of these supported paths:

- Maintainer-published economy data, currently modeled as the patch-versioned dataset consumed by `/economy/:league` and `/price/check`.
- Official `GET /currency-exchange/poe2` history for currency market aggregates, when Calandra has an approved confidential OAuth client with `service:cxapi`.
- A documented future GGG API, if GGG later publishes one for PoE2 item trade search.

Calandra must not use the website trade-search API, POESESSID/session-cookie flows, browser automation, or reverse-engineered internal endpoints as a substitute for official support.

## Evidence

- Official API reference says the server endpoint is `https://api.pathofexile.com` and notes that PoE2 game-information APIs are currently limited.
- Official API reference lists Public Stashes as PoE1 only, while Currency Exchange supports `realm` values including `poe2`.
- Currency Exchange requires `service:cxapi` and returns hourly historical aggregate market data. The docs state it does not return data from the current hour.
- Official overview says GGG can only support resources defined in the API reference or listed in Data Exports, and requests for internal website APIs or in-game resources will be denied.
- Official rate-limit docs require clients to honor dynamic rate-limit headers and `Retry-After`.
- The public PoE2 trade page exists at `https://www.pathofexile.com/trade2`, but it is not listed as a supported developer API resource.

Sources:

- https://www.pathofexile.com/developer/docs/reference
- https://www.pathofexile.com/developer/docs
- https://www.pathofexile.com/developer/docs/authorization
- https://www.pathofexile.com/trade2

## Decision

Keep Calandra's price-check API source-agnostic:

- Use the deterministic `/price/check` endpoint over the published dataset first.
- Treat official currency exchange history as an optional maintainer-side enrich source for currency/economy data.
- Keep direct item trade-search integration disabled until GGG documents a supported API.
- Do not ask users for `POESESSID`.
- Do not call undocumented website endpoints from the desktop app, web app, self-host path, or MCP server.

## Implementation Notes

The `@calandra/ggg-api` package records this decision:

- `poe2CurrencyExchangeSupport.supported === true`
- `poe2ItemTradeSearchSupport.supported === false`
- `createGggApiClient(...).getPoe2CurrencyExchangeMarkets()` calls only the official `api.pathofexile.com/currency-exchange/poe2` endpoint and requires `service:cxapi`.

Any future change enabling item trade-search must update this spike with official GGG documentation evidence.
