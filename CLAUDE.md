# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository.

## Project

Draft 26 — single-player simulator of the 2026 FIFA World Cup. The user
drafts an XI position-by-position (each slot rolls a random country, then
picks a compatible player from that country's roster), then plays the
group stage + knockout bracket against the other 47 nations. Inspired by
7a0.com.br / 38a0.com, narrowly scoped to Copa 2026.

The repo's `README.md`, `HANDOFF.md`, and `FEATURES.md` are the canonical
product references — read them before scoping any non-trivial change.

**Documentation language.** All Markdown docs are written in English
(en-US). **Code comments and user-facing strings are pt-BR** — the
codebase is consistently Portuguese for in-product copy and inline notes.
Default to pt-BR when adding new comments or strings; default to en-US
when adding new docs.

## Commands

```bash
pnpm dev               # vite dev server (localhost:5173)
pnpm build             # tsc -b && vite build → dist/
pnpm preview           # serve dist/
pnpm lint              # tsc -b --noEmit
pnpm test              # vitest run (~200ms, 96+ tests)
pnpm test:watch        # vitest in watch mode
pnpm test:coverage     # vitest run --coverage (HTML report at coverage/)
pnpm test:e2e          # playwright (e2e/)
pnpm sim:distortions   # run 50 end-to-end campaigns and emit reports/distortions-*.{json,md}
pnpm data:rebuild      # full data pipeline (network-bound, ~minutes)
```

Individual pipeline steps (run in order if rebuilding manually):
`pnpm scrape:squads` → `pnpm enrich:squads` → `pnpm download:fifa` →
`pnpm enrich:fifa` → `pnpm download:transfermarkt` →
`pnpm enrich:transfermarkt` → `pnpm enrich:alt-positions` →
`pnpm recalibrate:heuristic` → `pnpm download:fbref` →
`pnpm enrich:fbref` → `pnpm calibrate:fbref` →
`pnpm download:matches` → `pnpm calibrate:sim`.

`pnpm download:fbref` is just a check — the CSV comes from Kaggle (free
account required) and the first run of the step prints the instructions.
`pnpm calibrate:fbref` runs a per-bucket linear regression (GK/DEF/MID/FWD)
with OLS, trained on the FIFA-matched players that also appear in the Top
5 leagues, and applies the model to players without FIFA to upgrade their
overall (`ratingSource` becomes `'fbref-fit'`).

CI runs `lint + test + build` on PRs and pushes to `main`
(`.github/workflows/ci.yml`). When asked to verify, run
`pnpm lint && pnpm test` and exercise the UI in the dev server.

Tests live next to the code they test (`src/lib/*.test.ts`). The engine has
both deterministic suites (correctness) and seeded statistical suites
(`simulate.stats.test.ts` — N ≈ 3000 sims with ±10% tolerance). The stats
tests prefer **relative** comparisons (e.g., rubber-band on hard <
no-difficulty) over absolute asserts so the suite is resilient to
re-calibration.

E2E (Playwright, `e2e/`) is kept separate — it does not run in
`pnpm test` or default CI. Use `pnpm sim:distortions` to run 50 (or
`DRAFT26_RUNS=200`) full campaigns through `window.__draft26__` (exposed
in dev mode in `src/main.tsx`) and generate `reports/distortions-{timestamp}.{json,md}`.
The harness lives in `src/lib/sim-harness.ts` (`simulateFullCup(seed)`
returns a structured `RunResult`). Playwright config is in
`playwright.config.ts` — it starts the Vite dev server automatically.

Playwright 1.38+ doesn't download Chromium on `pnpm install` — the
`test:e2e`, `test:e2e:ui`, and `sim:distortions` scripts run
`playwright install chromium` first (no-op when cached, ~150 MB on the
first run). To install separately: `pnpm setup:e2e`.

`pnpm install` requires `allowBuilds: { esbuild: true }` in
`pnpm-workspace.yaml` (already set) — CI will break without it.

## Architecture

### Frontend (SPA)

Vite 6 + React 19 + TS + Tailwind v4. Routing via React Router 7
(`BrowserRouter`, defined in `src/main.tsx`):

| Route          | Component                       | Purpose                                              |
|----------------|---------------------------------|------------------------------------------------------|
| `/`            | `routes/Home`                   | Landing (dark-themed, scoped via `.d26-scope`)       |
| `/teams`       | `routes/Selecoes`               | 48-nation grid (wrapped in `AppLayout`)              |
| `/teams/:code` | `routes/SelecaoDetalhe`         | Single squad detail                                  |
| `/draft`       | `routes/Draft`                  | Formation/style/difficulty setup → roll-by-slot      |
| `/groups`      | `routes/Copa`                   | 3-round group stage                                  |
| `/match`       | `routes/Match`                  | Live match (group or knockout via `?kind=`)          |
| `/bracket`     | `routes/MataMata`               | 32-team knockout, renders the user's half + final    |

### Core domain (everything important lives in `src/lib/`)

- **`draft.ts`** — `DraftState` plus the country-cooldown sorter.
  `rollUntilCompatible` automatically re-rolls when the random country has
  no player compatible with the current slot. `COUNTRY_COOLDOWN = 5` (a
  rolled country can't reappear in the next 5 rolls). Pending rolls are
  persisted on the slot itself so closing/reopening the drawer doesn't
  re-randomize.
- **`formations.ts`** — 4 formations (4-3-3, 4-2-3-1, 4-4-2, 3-4-3) with
  `{x, y}` coordinates per slot; `DIFFICULTY_SKIPS = { easy: 5, medium: 3, hard: 1 }`.
- **`positions.ts`** — slot↔player compatibility checks
  `primaryPosition` **or** any `altPositions[]` entry against the slot's
  `COMPAT` table. Bridges built into `COMPAT` (no need for an alt on the
  player): `LB↔LWB`, `RB↔RWB`, `LM↔LW`, `RM↔RW`, `CF↔ST`.
  Cross-bridges between CDM/CM/CAM and LB→LM etc must come from data
  (`altPositions`). Alt positions are populated in three layers — FIFA
  `player_positions` (during `enrich:fifa`), TM `sub_position` +
  heuristic bridges (during `enrich:alt-positions`), and a curated overlay
  at `data/position-overrides.json`.
- **`simulate.ts`** — Dixon-Coles correction over a weighted Poisson;
  per-team rate derived from overall, with `HOME_ADVANTAGE` added to the
  home overall. `seededRng` is Mulberry32 for reproducibility. Rubber-band
  is applied only when difficulty is provided **and** one side is the
  user.
- **`groups.ts`** — Models ALL 12 Copa groups via
  `WorldCupGroups = { userLetter, groups[12] }`. `createWorldCup` builds
  the user's group (replacing the weakest team with the XI) + 11 CPU
  groups. `playCpuRound` simulates round N across the 11 CPU groups in
  lockstep with the user (calling `playRound` on the user's group
  separately to preserve narration + difficulty). `standings` tiebreakers
  implement FIFA 2026 Article 13: H2H pts → H2H GD → H2H GF → overall GD →
  overall GF → (fair play skipped) → `averageOverall` as a FIFA proxy.
  `computeQualifiers` applies the Copa 2026 rule: 12 1sts + 12 2nds + 8
  best 3rds = 32. `userFate` returns the user's precise destination
  (`qualified-1st` / `qualified-2nd` / `qualified-3rd-rank` /
  `eliminated-3rd-rank` / `eliminated-4th`).
- **`bracket.ts`** — `createBracket(worldCup)` consumes the 32 qualifiers
  and seeds them by (groupPosition asc → pts → GD → GF → overall) using an
  NCAA snake pairing (`SEED_ORDER_32`). Setup calls
  `setupBracket(worldCup)` which builds the bracket and immediately runs
  `ensureRoundsSimulated`. That helper walks the rounds in order: for
  each round it simulates every non-user match (`simulateNonUserRound`)
  and stops as soon as it finds the user's next pending match. If the
  user has been eliminated, it keeps going through to the final.
  `ensureRoundsSimulated` is called again after every user match to
  catch the next round up. Knockout matches go the full route: ET (~0.7
  expected goals) → penalties (5 + sudden death, per-shot probability
  clamped to 0.3-0.9 by overall).
- **`narrate.ts`** — per-minute event stream (goals / cards) weighted by
  player position; consumed by `routes/Match` for the live playback.
- **`persistence.ts`** — `localStorage` keys: `d26:draft`, `d26:worldcup`,
  `d26:bracket`, `d26:speed`. This is the source of truth for in-progress
  runs. The `Formation` object is **not** serialized — only
  `formationName`, and `loadDraft` re-derives it.
- **`features.ts`** — `?dev=1` (or `localStorage` key `feature:dev`)
  enables dev affordances like autofill (`autofill.ts`).
- **`supabase.ts` / `runs.ts`** — wired into the gameplay loop as a
  fire-and-forget remote mirror. Schema is in
  `supabase/migrations/0001_runs.sql` (table `runs` with RLS: owner sees
  all, public reads only when `completed_at is not null`). When the env
  vars are missing, every Supabase call is a no-op and `localStorage`
  alone keeps the app functional.

### Data layer

The squad data is served as a static asset at
`/data/squads-enriched.json` (~570 KB), fetched on boot via
`src/data/squads.ts` and gated by `components/SquadsGate.tsx`. The JSON
is committed and is the runtime source of squad/player data. Player
records carry a granular `primaryPosition` (CB, LW, ST…) plus a coarse
`position` bucket (GK/DEF/MID/FWD) — slot compatibility uses
`primaryPosition`; narration uses the bucket.

Multi-source rating system: `ratingSource` reflects priority order:

- `'fifa'` (~73%) — EA FC 26 exact / initials match. Most reliable.
- `'fifa-fuzzy'` (<1%) — EA FC 26 via Levenshtein. Tail.
- `'fbref-fit'` (~2%) — no FIFA, but with 2025-26 FBref stats from the
  Top 5 leagues; overall comes from the regression trained in
  `calibrate-from-fbref.ts`. For players like Rayan (BRA, Bournemouth) or
  Jeremy Arévalo (ECU, Stuttgart) — real names in top leagues that EA
  missed or got wrong.
- `'tm'` (~8%) — no FIFA, no FBref; heuristic rating calibrated by TM
  value in buckets.
- `'club-tier'` (~17%) — final fallback, only club + caps + age. Mostly
  domestic players in Iran / Jordan / Uzbekistan / Saudi Arabia.

Match disambiguation across every source scores candidates by
`(positional bucket, club, age)` — the fix for the bug where GK Alisson
Becker turned into the namesake RW from Shakhtar. Don't simplify down to
name-only.

Raw FBref stats live on `player.fbref` (per-90 normalized) for every
matched player — including FIFA-matched ones — to allow debugging and
re-validation.

Raw CSVs (`eafc26-players.csv`, `transfermarkt-players.csv`,
`fbref-players.csv`) are gitignored — `pnpm data:rebuild`
re-downloads / re-checks them. FBref comes from Kaggle (free account
required), the only manual source. The others are automated scrapes.

### Styling

Two coexisting design systems in `src/index.css`:

- **Light "paper / ink" theme** (default) — Tailwind v4 `@theme` tokens
  like `paper`, `ink`, `ink-soft`, `clay`, `sand`, `moss`, `rule`. Used
  by `/teams`, `/draft`, `/groups`, `/bracket`, `/match`.
- **Dark "Draft 26" theme** — tokens prefixed `--color-d-*` plus
  `.d26-*` utility classes; scoped via the `.d26-scope` wrapper on
  `routes/Home`.

Inline-style-driven responsive overrides for the Draft screen live as
`.az-*` classes with `!important` — they exist to defeat inline styles
set by the component. Don't refactor away unless you're also removing the
inline styles.

### Deployment

Cloudflare Pages, static only. Build `pnpm build`, output `dist/`, SPA
fallback in `public/_redirects`, cache + security headers in
`public/_headers`. Build-time env vars: `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` (the anon key is public by design — RLS protects
the data, not the key), plus optional `VITE_SENTRY_DSN`,
`VITE_CF_BEACON_TOKEN`, and `SENTRY_AUTH_TOKEN` for sourcemap upload
from CI (the Sentry org and project are hard-coded in `vite.config.ts`).

## Conventions specific to this repo

- **Docs are en-US, code is pt-BR.** Markdown documentation is written in
  English; new code comments and user-facing strings should be pt-BR to
  stay consistent with the rest of the codebase.
- Treat `localStorage` as authoritative for in-flight runs. Supabase is a
  fire-and-forget mirror — don't gate the gameplay loop on Supabase being
  reachable.
- Keep the country-cooldown / 1:1 position-match invariants intact —
  they're the load-bearing constraints of the draft loop.
- `averageOverall` is the canonical strength signal across simulation,
  seeding, and tiebreakers. If you change how it's computed, expect ripple
  effects in `groups.ts`, `bracket.ts`, and `simulate.ts`.
- The initial bundle is ~144 KB gzip (post-async-squads). New dependencies
  should justify their weight or be dynamic-imported.
