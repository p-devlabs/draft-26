# impeccable.style

Agent skill + CLI + browser extension that enforces design system
fidelity and detects "AI slop" patterns (generic purple gradients,
nested cards, low-contrast text, etc.).

Source: https://impeccable.style/
Author: Paul Bakaus (Renaissance Geek), Apache 2.0.

## What it provides

- `/impeccable` command suite for Claude Code (23 sub-commands
  including `/polish`, `/audit`, `/critique`, `/typeset`,
  `/colorize`, `/animate`).
- **Project artefacts** — `PRODUCT.md` and `DESIGN.md` at repo root.
  These travel with the project and constitute the spec impeccable
  audits against:
  - `PRODUCT.md` — audience, brand voice, anti-references
  - `DESIGN.md` — tokens, components, visual rules (Google Stitch
    format)
- **Detection engine** — 29 deterministic anti-pattern rules.
- **CLI** — `npx impeccable detect` for CI integration.
- **Browser extension** (optional) — one-click anti-pattern detection
  on rendered pages.

## Install

Per the user's instructions in this repo:

```bash
# Claude Code skill via marketplace (preferred):
claude plugin marketplace add impeccable-style
# OR via the official site instructions:
#   https://impeccable.style/
```

CLI for CI:

```bash
npx impeccable detect
```

## Project artefacts in this repo

- **`PRODUCT.md`** (root) — derived from `docs/product-vision.md`
  and the ADRs. Captures audience, voice, anti-references.
- **`DESIGN.md`** (root) — derived from `docs/design/README.md` (the
  design handoff token map) and ADR 0011. Captures tokens, typography,
  and visual rules.

Both files are partial when first written and get filled in as the
first features land. They're authoritative — impeccable validates
against them, not against generic defaults.

## When agents reach for it

- `design-implementer` — primary consumer. Runs `/audit` or
  `/critique` against a component before opening a PR.
- `reviewer` — runs `/audit` as part of design review.
- CI — `npx impeccable detect` can be wired into the build gate
  later (separate ADR / issue).

## Workflow

1. Run `/audit <path>` (Claude Code) or `npx impeccable detect`
   against new UI code.
2. Findings come back as either anti-pattern violations (deterministic)
   or design-spec violations (against PRODUCT.md / DESIGN.md).
3. Fix or justify; the design-implementer agent owns the call.

## Why this and not the others

Decision history is in `docs/decisions/0014-skills-and-mcp-pack.md`.
Summary: we picked impeccable + vercel-web-design-guidelines for the
design quality slot because impeccable's PRODUCT.md / DESIGN.md
artefact pattern fits our handoff-driven workflow, and the anti-slop
detection complements our generative-AI risk profile.
