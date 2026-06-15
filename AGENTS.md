# AGENTS

This file gives human and AI contributors the project rules that matter most.
Read it before doing any work.

## Product direction

Draft 26 is a single-player simulator of the 2026 FIFA World Cup. Inspired by
7a0.com.br / 38a0.com, narrowly scoped to Copa 2026. See `README.md`, `HANDOFF.md`,
and `FEATURES.md` for the canonical product references.

## Non-negotiables

- **Docs are en-US, code is pt-BR.** Markdown documentation is written in
  English; new code comments and user-facing strings should be pt-BR to stay
  consistent with the rest of the codebase.
- Treat `localStorage` as authoritative for in-flight runs. Supabase is a
  fire-and-forget mirror — don't gate the gameplay loop on Supabase being
  reachable.
- Keep the country-cooldown / 1:1 position-match invariants intact — they're
  the load-bearing constraints of the draft loop (see `src/lib/draft.ts`).
- `averageOverall` is the canonical strength signal across simulation, seeding,
  and tiebreakers. Changes ripple to `groups.ts`, `bracket.ts`, and `simulate.ts`.
- The initial bundle target is ~144 KB gzip. New dependencies should justify
  their weight or be dynamic-imported.
- Keep PRs small and reviewable. Stack PRs instead of growing a single one.
- Add tests for behaviour that matters: the engine has 100+ existing tests
  in `src/lib/*.test.ts` — extend them when you touch domain logic.

## Where to look first

- `README.md` — what the product is + how to run it
- `HANDOFF.md` — current state + roadmap + key decisions
- `FEATURES.md` — feature inventory with file:line references
- `CLAUDE.md` — full project instructions for Claude Code (also useful for humans)
- `docs/launch-plan.md` — Week 1 launch and growth plan
- `ai/conventions/` — commits, PRs, branches
- `ai/agents/` — role-scoped agent definitions
- `ai/skills/` — adopted skills (catalog + deferred list)

## Change types

- **Feature work** — touches the gameplay loop, draft, or simulation engine.
  Validate against `simulate.stats.test.ts` for distributional sanity.
- **Bug fixes** — write a failing test first when feasible; don't bypass with
  defensive code.
- **Refactors** — must be behaviour-preserving. Verify via `pnpm test` and a
  manual sanity check in `pnpm dev`.
- **Data pipeline** — follow the order in `package.json` scripts. The full
  rebuild lives behind `pnpm data:rebuild`.

## Testing expectations

- Unit tests prove domain logic. Runner: Jest (see `jest.config.mjs`).
- Statistical tests use seeded RNG with relative-comparison asserts, so they
  survive recalibration (`src/lib/simulate.stats.test.ts`).
- E2E in `e2e/` runs Playwright; the distortions harness in
  `pnpm sim:distortions` runs 50 full campaigns and emits reports.
- A11y checks are tracked in the audit notes; raise the bar on new surfaces
  rather than retrofitting old ones in the same PR.

## Review expectations

Every PR should explain:

- what changed;
- why it changed;
- how it was validated;
- whether it touches the bundle size budget, public-key surface (Supabase anon
  key, Sentry DSN), telemetry events (`src/lib/track.ts`), or accessibility.
