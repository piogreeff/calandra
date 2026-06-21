# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue or PR.

- Preferred: GitHub's [private vulnerability reporting](https://github.com/piogreeff/calandra/security/advisories/new) (Security → Report a vulnerability).
- Alternatively, contact the maintainer directly via the address listed on [github.com/piogreeff](https://github.com/piogreeff).

Please include: affected component, reproduction steps, impact, and any suggested remediation. We aim to acknowledge within **72 hours** and to agree a disclosure timeline with you. Coordinated disclosure is appreciated; we will credit reporters who want it.

## Scope

In scope: the Calandra codebase — backend (Workers), desktop agent, web UI, MCP server, dataset tooling, and auth/token handling.

Out of scope, and please do **not** test or report:

- Anything requiring exploitation of Grinding Gear Games' systems, the official API, poe2db, or poe.ninja. Calandra is an unofficial tool; do not attack upstream services in the course of testing it.
- Behaviour that would itself violate GGG's Terms of Service (e.g. game-client injection or automation). Calandra deliberately does not do these things; proposals to add them are rejected on sight, not treated as findings.

## Handling of secrets and tokens

GGG OAuth tokens and user credentials are encrypted at rest. If you find a path where a secret is logged, exposed, or stored in plaintext, that is in scope and we want to hear about it.
