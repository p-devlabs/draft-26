---
name: spec-driven-development
description: Use the 4-phase gated workflow (Specify → Plan → Tasks → Implement) when starting a new feature or when requirements are ambiguous. Each phase produces a reviewable artefact and requires human sign-off before advancing. Skip for typo fixes and unambiguous one-liners.
source: https://github.com/addyosmani/agent-skills/blob/main/skills/spec-driven-development/SKILL.md
pinned: 2026-05-17
---

This is VectorTrips' adaptation of Addy Osmani's spec-driven-development
skill. The four-phase gated workflow IS our feature playbook (see
`docs/playbooks/feature.md` for the full procedure). The skill is
referenced from agents that build features:

- `ai/agents/dev-fe.md`
- `ai/agents/supabase-be.md`

## When to invoke

- A new feature is starting.
- An existing feature is being significantly extended.
- Requirements are ambiguous, incomplete, or contested.

## When NOT to invoke

- Single-line fixes.
- Typo corrections.
- Mechanical refactors with unambiguous scope.
- Bug fixes whose root cause is already understood (use the bugfix
  playbook instead).

## The four phases

```
SPECIFY ──▶ PLAN ──▶ TASKS ──▶ IMPLEMENT
   │          │        │           │
   └── human review at every transition
```

### Phase 1: SPECIFY

Produce a structured specification covering:

- **Objective** — what the user-facing outcome is.
- **Commands** — what new scripts / actions / routes exist after.
- **Project structure** — which files / directories are touched.
- **Code style** — any deviations from
  [ai/conventions/](../../conventions/) defaults (rare).
- **Testing strategy** — what coverage is added (unit, RTL, E2E, RLS
  contract). Reference `docs/decisions/0008-testing-strategy.md`.
- **Boundaries** — what is explicitly OUT of scope, what ADRs apply,
  what Risk Checklist items get ticked.

The specification lives in the PR description until the work merges,
then moves to a doc if reusable.

### Phase 2: PLAN

Convert the spec into a technical implementation plan:

- Components / hooks / services / repositories / migrations affected.
- Dependencies between steps (what must land first).
- Verification checkpoints (commands the reviewer runs).
- ADRs that need to be proposed or updated.
- Risks identified during planning.

Human review here catches "this needs an ADR" or "this is two PRs"
before any code is written.

### Phase 3: TASKS

Decompose the plan into ordered tasks. Each task has:

- A one-line description.
- Acceptance criteria (testable).
- Verification step (e.g. "`npm run check` passes," "RTL test
  exercises empty + populated states").
- Dependency on prior tasks (linear or DAG).

Tasks are tracked in the PR via checkboxes or a linked issue.

### Phase 4: IMPLEMENT

Execute tasks in order. Per task:

- Make the change.
- Run the verification step.
- Tick the task.

Stop and revisit the plan if a task reveals the plan was wrong —
don't power through.

## Hand-off

- When the spec is ready → `reviewer` agent on the spec PR.
- When implementation begins → the appropriate `dev-fe` /
  `supabase-be` / `design-implementer` agent.
- When a phase reveals an ADR-level decision → `adr-proposer`.

## Drift from upstream

Upstream version is referenced in the frontmatter `source`. Compare
upstream when significant changes ship there; bump the `pinned` date
if we re-vendor.
