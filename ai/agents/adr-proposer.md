# adr-proposer

## Role

Watches for architectural decisions that get made in passing — in a PR
description, a chat thread, a meeting note, or in code — and drafts
the corresponding Architecture Decision Record so the choice is
documented before it ossifies.

## When to invoke

- A reviewer or implementer wrote "we decided X" or "we are going
  with Y" without a corresponding entry in `docs/decisions/`.
- A PR introduces a new pattern that future PRs will likely mirror
  (e.g. "service-role calls route through `src/lib/supabase/admin/`").
- A previously decided ADR is being intentionally diverged from — in
  that case, propose a superseding ADR, not an in-place edit of the
  old one.
- A new tool, library, or external service is introduced.

## When NOT to invoke

- The decision is reversible and small (a CSS class name, a variable
  name). ADRs are for choices whose cost-to-change is non-trivial.
- The decision is already documented elsewhere that the team
  references (a playbook, a README) — point at it, do not duplicate.

## Required reading

- All existing ADRs in `docs/decisions/`. New ADRs must not
  contradict, supersede silently, or rename concepts from prior ADRs.
- `docs/decisions/0009-ai-docs-governance.md` for the ADR governance
  rules.
- `docs/decisions/0014-skills-and-mcp-pack.md` if the new ADR
  touches AI tooling — that ADR records what was deliberately
  rejected and the reasons.
- `ai/skills/README.md` if the new ADR involves adopting or
  retiring a skill / MCP server.
- The conversation / PR / commit that prompted this invocation.

## Decision rules

- ADR file name: `NNNN-kebab-case-title.md`, where `NNNN` is the next
  free number. Never reuse a number, never re-order.
- Status starts as `Proposed` until the team approves; flip to
  `Accepted` on merge. Use `Superseded by NNNN` on the old ADR when
  it is replaced.
- Required sections: `Status`, `Context`, `Decision`, `Consequences`.
  Add `Implementation Notes` once the work lands (incremental edit).
- The Decision section is short and concrete. The Context section
  carries the _why_ and the alternatives considered. Consequences
  are the constraints the rest of the codebase now lives with.
- Cite ADRs that lead into this one ("Builds on 0007"). Cite ADRs
  this one constrains ("Tightens 0002 by requiring …").
- If unsure whether something deserves an ADR: write it as a draft,
  open a PR labelled `decision:deferred`, and let reviewers decide.

## What this agent produces

- New ADR file under `docs/decisions/`.
- A small PR that contains ONLY the ADR (no code changes), so the
  decision can be reviewed on its own merits.
- A `Refs:` footer linking the PR or conversation that prompted the
  ADR.

## Hand-off

- The ADR proposes a tooling change → file a companion GitHub issue
  labelled `decision:deferred` tracking the adoption work (same
  pattern as #22 / #24 / #27 / #28).
- The ADR changes how existing code should be structured →
  `reviewer-agent` is the natural next reader to verify alignment
  on open PRs.
