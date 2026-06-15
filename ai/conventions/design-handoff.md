# Design handoff workflow

How design work flows between Claude Design (the design-time agent
producing HTML/CSS/SVG/SEO templates) and Claude Code / human
contributors on the implementation side.

Born from the observation that ad-hoc per-prompt loops produced
high friction: each microdecision triggered a full round-trip
through a human router (you). This document fixes the contract.

## Roles

| Role                          | Owns                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| **Design** (Claude Design)    | Production of visual deliverables (HTML mockups, SVG assets, SEO templates, copy structure) |
| **Server** (Claude Code + me) | Code implementation, ADRs, integration, tests                                               |
| **User** (you)                | Decisions on open questions, routing PRs, the final call on trade-offs                      |
| **Reviewer agent**            | Closure check before each phase transition                                                  |

Decisions about **the design system itself** (tokens, anti-patterns,
typography) live in `DESIGN.md`. Decisions about **architecture or
the product** live in `docs/decisions/`. Design reads both; Design
does not author either — only proposes deltas that user / Server
ratify.

## The single source of truth

The Design-facing source is **`docs/design/brief.md`**. It carries:

- Read-only context (decisions, tokens, route map, anti-patterns)
- Phase asks (current deliverables Design is producing)
- Delivery schema (how Design ships)
- Open questions table (with owner + status)
- Closure criteria

The brief is **versioned** with the rest of the repo. Each Design
batch starts from the brief's current state at a known commit. When
the brief changes materially mid-batch, Design is notified via the
PR description (or in the `## Open questions` table).

Design does NOT need to read individual ADRs, the PRODUCT.md, or
the handoff bundle directly. The brief digests everything Design
needs. The other docs are referenced for the deeper "why" but not
required reading.

## The flow

```
   STAGE 0 — Setup (one time per phase)
   ────────────────────────────────────
   Server writes/updates brief.md
              │
              ▼
   User shares GitHub URL with Design
              │
              ▼
   ┌─────────────────────────────┬──────────────────────────────┐
   │                             │                              │
   ▼                             ▼                              ▼
STAGE 1A — Design batch    STAGE 1B — Server foundation   STAGE 1C — open Qs

Design produces deliverables    Server builds Phase items      Either side
(8 asks queued at start)        independently of Design's      raises blockers
                                output                          via brief.md
                                                                or design-block issue
                  │
                  ▼
STAGE 2 — Integration
─────────────────────
Server opens ONE PR per Design batch (`feat(design): integrate phase-N batch <date>`)
Server opens companion ADR PR if new decisions emerged
              │
              ▼
STAGE 3 — Open questions sync
─────────────────────────────
brief.md `## Open questions` table updated
Design picks up answers on next batch
              │
              ▼
STAGE 4 — Phase closure check
─────────────────────────────
reviewer agent walks the phase checklist
   green → next phase starts
   red   → loop back to STAGE 1 with delta
```

## Delivery schema

Design ships into `docs/design/deliveries/<date>/<topic>/`. Each
topic folder is a self-contained batch with a fixed structure:

```
docs/design/deliveries/2026-05-18/error-pages/
├── README.md          ← decisions, trade-offs, open questions
├── 404.html
├── 500.html
├── 503.html
├── private.html
└── assets/            ← optional, scoped to this delivery
    └── ...
```

The README is required. It carries:

```markdown
# <Topic name> — <date>

## What's in this batch

- One-line per deliverable

## Decisions made during production

- Bulleted list of choices that needed flagging (e.g. "Switched the
  error illustration from line-art to a single mark glyph for
  visual consistency with the favicon set")

## Anti-patterns avoided

- Specific to this batch (e.g. "Did NOT center the error code +
  add three feature cards below — that's an AI-slop pattern flagged
  in DESIGN.md")

## Open questions raised

- Numbered, with owner suggestion. These propagate to brief.md
  `## Open questions` table on integration.

## Acceptance against the brief

- For each ask in brief.md addressed by this batch, a one-line
  confirmation OR a deviation note with reason.
```

Files in the topic folder follow the brief's per-ask format
(HTML for mockups, SVG for assets, JSON for SEO templates, etc.).

## Open questions protocol

Open questions live ONLY in `docs/design/brief.md` `## Open
questions` table. The shape is fixed:

| Q   | Asked by | Date       | Owner  | Status   | Resolution              |
| --- | -------- | ---------- | ------ | -------- | ----------------------- |
| 001 | Design   | 2026-05-18 | User   | Open     | —                       |
| 002 | Server   | 2026-05-18 | Design | Resolved | "Yes, OKLCH everywhere" |

When Design raises a question in a delivery README, Server moves it
into the brief on integration. When Server raises a question, it
goes into the brief directly and the brief is the source of truth.

User answers in-table (Resolution column) or in a comment on the
brief's PR. Either way, the answer is permanent once recorded.

Mid-batch, neither side waits for an open question to be resolved
unless it blocks the batch. If it blocks, escalate (see below).

## Escape: `design-block` issue

A `design-block` GitHub issue is opened when **a decision blocks
delivery and the answer is not obvious from existing docs**. Use
sparingly:

- Security / legal trade-offs (the typical case)
- Decisions that imply a new ADR
- Cross-cutting choices that contradict an existing ADR

Format:

- Title: `design-block: <one-line question>`
- Label: `design-block` + relevant `scope:*` label
- Body: context, options, recommendation, deadline
- Assignee: User

NOT a `design-block`:

- Aesthetic preferences (Design's call within DESIGN.md constraints)
- Internal Design questions about HTML structure
- Server-side implementation choices

## Cadence

- **Brief update**: as often as needed, but every update PR
  references the affected sections so Design can read incrementally.
- **Design batch**: roughly 1 per session. Could be 1 deliverable
  or 5; the trigger is "this is a coherent set that should ship
  together."
- **Server integration**: 1 PR per delivery batch. Should land
  within ~2 days of delivery.
- **Phase closure**: explicit gate. Reviewer agent runs through the
  checklist; nothing crosses into the next phase before it passes.

## What this workflow does NOT manage

- **Day-to-day code**. Features build per `docs/playbooks/feature.md`
  (the 4-phase gated spec-driven flow). Design assets show up only
  where needed; most features don't trigger Design work.
- **Long-running design decisions** (e.g. "should the brand evolve?").
  Those go through ADRs the normal way.
- **Brand emergencies** (a designed pattern reveals a security or
  accessibility bug). Handle as a regular bug fix per the bugfix
  playbook; loop Design in via brief update.

## Cross-references

- `docs/design/brief.md` — live brief Design reads
- `DESIGN.md` — design system (tokens, typography, anti-patterns)
- `docs/decisions/` — ADRs
- `ai/agents/design-implementer.md` — the agent that consumes Design
  output and produces React components
- `ai/skills/impeccable/README.md` — runtime design quality audit
