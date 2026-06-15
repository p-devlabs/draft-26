# Draft 26

In-browser simulator for the 2026 FIFA World Cup. Roll one of the 48 nations,
build your starting XI from the official 26-player roster, and simulate the
whole tournament — group stage through the final at MetLife Stadium.

Inspired by [7a0](https://7a0.com.br/) and [38a0](https://38a0.com/), but
focused **exclusively** on Copa 2026 with a heavy bias toward UI/UX polish.

For a complete feature inventory, see [FEATURES.md](./FEATURES.md).

## Stack

- **Vite + React 19 + TypeScript** — SPA with fast builds and end-to-end types
- **Tailwind v4** — design tokens inline in the CSS
- **Supabase** — Postgres + auth (and, eventually, Realtime for multiplayer)
- **Cloudflare Pages** — static deploy at the edge
- **Sentry** — error monitoring with release tagging + sourcemap upload
- **Vitest + Playwright** — unit tests and end-to-end statistical sims

## Run locally

```bash
pnpm install
cp .env.example .env       # add your Supabase URL + anon key
pnpm dev
```

Production build:

```bash
pnpm build
pnpm preview
```

## Supabase

Schema lives in `supabase/migrations/0001_runs.sql`. To bootstrap a local
database (requires the [Supabase CLI](https://supabase.com/docs/guides/cli)):

```bash
supabase start
supabase db reset            # applies migrations + seed
```

Or run the SQL directly in a remote project's dashboard editor.

The anon key is **public by design** — it ships in the bundle through the
`VITE_*` env vars. RLS protects the data, not the key.

## Deploy (Cloudflare Pages)

1. Connect the repo in the Cloudflare Pages dashboard
2. Build command: `pnpm build`
3. Output directory: `dist`
4. Env vars (build-time):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `VITE_SENTRY_DSN` (optional, enables Sentry on the client)
   - `VITE_CF_BEACON_TOKEN` (optional, enables Cloudflare Web Analytics)
   - `SENTRY_AUTH_TOKEN` (optional, enables sourcemap upload to Sentry
     from CI; the Sentry org and project are hard-coded in
     `vite.config.ts`)

`public/_redirects` already handles the SPA fallback. `public/_headers` sets
cache headers and security headers (HSTS, CSP, XFO, etc).

## Architecture decisions

- **Single-player first.** No shared state, no realtime. Prove the core loop
  before complicating things with multiplayer lobbies.
- **Overall comes from multiple sources.** EA FC 26 covers ~73% of called-up
  players. Transfermarkt, FBref (per-90 OLS fit), and a club-tier heuristic
  cover the rest. See [FEATURES.md §7](./FEATURES.md#7-data-layer--rating-sources).
- **Cloudflare = static hosting only.** Supabase is the source of truth.
  No custom Workers — keeps the surface area small.
- **Client-side routing** via `react-router-dom` v7. No SSR — the content is
  interactive and personalized per user, so pre-rendering would buy nothing.

## Data pipeline

The `data/` directory mixes hand-curation and generated files:

| File                        | Origin                                                  | In git?           |
| --------------------------- | ------------------------------------------------------- | ----------------- |
| `country-codes.json`        | curated manually                                        | ✅                |
| `tactics.json`              | curated manually                                        | ✅                |
| `position-overrides.json`   | curated overlay for alt-positions                       | ✅                |
| `sim-params.json`           | output of `calibrate:sim` (Poisson + Dixon-Coles)       | ✅                |
| `squads.json`               | `pnpm scrape:squads` (Wikipedia)                        | ✅ (reference)    |
| `squads-enriched.json`      | full enrichment pipeline (see below)                    | ✅ (runtime data) |
| `eafc26-players.csv`        | `pnpm download:fifa` (~10 MB)                           | ❌ (gitignored)   |
| `transfermarkt-players.csv` | `pnpm download:transfermarkt` (~4 MB from a 222 MB ZIP) | ❌ (gitignored)   |
| `fbref-players.csv`         | Kaggle manual download (free account required)          | ❌ (gitignored)   |

To rebuild everything from scratch:

```bash
pnpm data:rebuild
```

That runs, in order: `scrape:squads → enrich:squads → download:fifa →
enrich:fifa → download:transfermarkt → enrich:transfermarkt →
enrich:alt-positions → recalibrate:heuristic → download:fbref →
enrich:fbref → calibrate:fbref → download:matches → calibrate:sim`.

EA FC 26 covers ~73% of the called-up players. Transfermarkt fills another
~8% (cross-referenced by market value, never overwriting EA FC's rating or
position). FBref covers the long tail of well-tracked players that EA FC
missed (~2%, fit by per-bucket OLS regression). The club-tier heuristic
catches the remaining ~17%, mostly domestic leagues in Iran, Jordan,
Uzbekistan, and Saudi Arabia.

Match disambiguation across every source scores candidates by
`(positional bucket, club, age)`. Without it, Alisson Becker (Liverpool GK)
used to collide with another Alisson — a right winger at Shakhtar.

## Tests

```bash
pnpm test              # vitest, ~200ms, 96+ tests
pnpm test:coverage     # HTML report at coverage/
pnpm test:e2e          # playwright (e2e/)
pnpm sim:distortions   # 50 (or DRAFT26_RUNS=N) full campaigns → reports/distortions-*.{json,md}
```

The statistical suite (`src/lib/simulate.stats.test.ts`) runs ~3,000
seeded simulations per scenario and asserts **relative** outcomes (e.g.,
"hard difficulty produces a tighter rubber-band than no difficulty"),
which keeps the tests resilient to re-calibration.

## Roadmap

See [HANDOFF.md](./HANDOFF.md) for the current state and the next
priorities, and [docs/launch-plan.md](./docs/launch-plan.md) for the
week-1 launch and growth plan.
