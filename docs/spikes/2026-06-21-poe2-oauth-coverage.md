# PoE2 OAuth Coverage Spike

Checked on 2026-06-21 against the official Path of Exile developer docs.

## Finding

PoE2 account character coverage is available through the official OAuth API, but account stash coverage is not currently available for PoE2.

## Evidence

- API reference: `GET /character[/<realm>]` and `GET /character[/<realm>]/<name>` support `realm` values including `poe2` and require the `account:characters` scope.
- API reference: Account Stashes are explicitly labeled PoE1 only, and the listed stash `realm` values are `xbox` and `sony`; `poe2` is not listed there.
- API reference: Currency Exchange supports `poe2`, which is useful for later pricing work but does not replace private account stash snapshots.
- OAuth docs: developer APIs use OAuth 2.1 and require registered applications, user authorization, and policy-compliant access.

Sources:
- https://www.pathofexile.com/developer/docs/reference
- https://www.pathofexile.com/developer/docs/authorization
- https://www.pathofexile.com/developer/docs

## Phase 0 Decision

Build account snapshot storage source-agnostically:

- Character snapshots can target official PoE2 character endpoints first.
- Stash snapshots must remain behind a capability flag until GGG exposes PoE2 support.
- The desktop clipboard parser and manual/imported snapshots remain valid fallback inputs.
- Do not use session-cookie trade or stash endpoints as a substitute for official OAuth coverage.

## Implementation Notes

Use these intended endpoints when OAuth client credentials are available:

```text
GET /character/poe2
GET /character/poe2/<name>
```

Required application behavior:

- Send a descriptive `User-Agent` with a contact address.
- Request only needed scopes, beginning with `account:characters`.
- Honor `429` and rate-limit headers with backoff.
- Encrypt OAuth tokens at rest.
