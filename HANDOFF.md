# Handoff — Draft 26

## What it is

A single-player simulator of the 2026 FIFA World Cup. Roll nations, build an
XI, play the group stage, run the bracket. An alternative to 7a0.com.br /
38a0.com — narrowly scoped to Copa 2026, with a clean UI and properly
sourced data.

Repo: `github.com:p-devlabs/draft-26`
Live: `https://draft-26.pages.dev`

For the full feature catalogue, see [FEATURES.md](./FEATURES.md).

## Current state (2026-06-15)

Shipped end-to-end. Cloudflare Pages serves the static build at
draft-26.pages.dev; Sentry hardening (release tag + sourcemap upload) is in
place; Supabase persistence + analytics are live; CSP runs in Report-Only
while we watch violations.

The flow:

- `/` (landing, dark Draft 26 theme)
- `/teams` (the 48 nations, grouped A–L) → `/teams/:code` (squad detail)
- `/draft` (formation/style/difficulty → roll-by-slot with cooldown 5,
  skips by difficulty, dev-mode autofill via `?dev=1`)
- `/groups` (three rounds of group play, parallel CPU groups, FIFA 2026
  Article 13 tiebreakers, the full 32-team qualification rule including
  the 8 best 3rd-place finishers)
- `/match` (live playback: slow/normal/fast speed, minute-by-minute
  narration, ET + penalties on knockout)
- `/bracket` (32-team NCAA-snake knockout; only the user's half plus the
  final is rendered; elimination and champion drawers)

## Stack

- **Build**: Vite 6 + React 19 + TS + Tailwind v4 (`@theme` tokens:
  paper / ink / clay / sand / moss / rule)
- **Routing**: React Router 7
- **Package manager**: pnpm 11 (requires `allowBuilds: { esbuild: true }` in
  `pnpm-workspace.yaml`)
- **Typography**: Source Serif (display) + system stack
- **Persistence**: `localStorage` (keys `d26:draft`, `d26:worldcup`,
  `d26:bracket`, `d26:speed`) + optional Supabase mirror
- **Monitoring**: Sentry (lazy-loaded, error-only)
- **Web analytics**: Cloudflare Web Analytics (optional, beacon-gated)

## Data pipeline

1. `pnpm scrape:squads` → Wikipedia "2026 FIFA World Cup squads" via cheerio
   → `data/squads.json`
2. `pnpm enrich:squads` → ISO codes, flags, heuristic formation, club-tier
   overall → `data/squads-enriched.json`
3. `pnpm download:fifa` → EA FC 26 CSV (~10 MB, gitignored)
4. `pnpm enrich:fifa` → joins with squads, disambiguates by
   **(positional bucket, club, age)** (Alisson Becker bug fix), splits
   `primaryPosition` + `altPositions[]`
5. `pnpm download:transfermarkt` → ZIP from dcaribou/transfermarkt-datasets,
   extracts players.csv (~4 MB, gitignored)
6. `pnpm enrich:transfermarkt` → cross-references market value
   (`value_eur_tm`) without overwriting EA FC's rating or position
7. `pnpm enrich:alt-positions` → curated alt-positions overlay
   (`data/position-overrides.json`) + heuristic bridges
8. `pnpm recalibrate:heuristic` → tunes the club-tier fallback formula
9. `pnpm download:fbref` (manual Kaggle download) → `data/fbref-players.csv`
10. `pnpm enrich:fbref` → attaches per-90 stats to matched players
11. `pnpm calibrate:fbref` → per-bucket OLS regression to fit overall for
    FBref-only players (`ratingSource = 'fbref-fit'`)
12. `pnpm download:matches` → international match results (~2018+)
13. `pnpm calibrate:sim` → fits the Poisson + Dixon-Coles model
14. `pnpm data:rebuild` → chains everything above

Final artifact: `data/squads-enriched.json` (~570 KB, **committed**, fetched
on app boot — no longer inlined in the bundle).

## Architecture

```
src/
├── lib/
│   ├── draft.ts          DraftState, rollUntilCompatible, useSkip, pickPlayer
│   ├── formations.ts     4-3-3, 4-2-3-1, 4-4-2, 3-4-3 + DIFFICULTY_SKIPS
│   ├── positions.ts      COMPAT bridges (LB↔LWB, RB↔RWB, LM↔LW, RM↔RW, CF↔ST)
│   ├── autofill.ts       greedy slot scorer (gated on features.dev)
│   ├── features.ts       ?dev=1 + localStorage flag
│   ├── simulate.ts       Dixon-Coles Poisson + rubber-band + ET + penalties
│   ├── narrate.ts        minute-by-minute events (goals, cards) by position
│   ├── groups.ts         12-group WorldCup model, FIFA 2026 tiebreakers,
│   │                     userFate, computeQualifiers (12 1sts + 12 2nds + 8 best 3rds)
│   ├── bracket.ts        SEED_ORDER_32 NCAA snake, setupBracket,
│   │                     ensureRoundsSimulated, ET + penalties
│   ├── persistence.ts    load/save/clear per localStorage key
│   ├── rosters.ts        rosterForKnockout (shared between groups/bracket)
│   ├── runs.ts           Supabase anon auth + run snapshot upserts
│   ├── supabase.ts       client + isSupabaseConfigured gate
│   ├── session.ts        UTM, device class, session context
│   ├── track.ts          event analytics, PageViewTracker
│   ├── analytics.ts      Sentry init (lazy) + CF Web Analytics beacon
│   └── sim-harness.ts    window.__draft26__ for Playwright/dev
├── components/
│   ├── AppErrorBoundary  Sentry-wired error boundary
│   ├── SquadsGate        blocks render until loadSquads() resolves
│   ├── Field.tsx         SVG pitch with 11 slots
│   ├── PickDrawer.tsx    per-slot roll/pick drawer
│   ├── SetupDrawer.tsx   formation/style/difficulty setup
│   └── BracketView.tsx   user-half + final render
└── routes/
    ├── Home.tsx          landing (dark .d26-scope theme)
    ├── Selecoes.tsx      48-team grid by group letter
    ├── SelecaoDetalhe.tsx single squad detail
    ├── Draft.tsx         setup → build → ready
    ├── Copa.tsx          3-round group stage + standings
    ├── Match.tsx         live playback (group | knockout via ?kind=)
    └── MataMata.tsx      32-team knockout bracket
```

## Important decisions

- **Primary position + alternatives.** Alisson originally appeared as a
  centre-back in the first enrichment pass. The fix is score-based
  disambiguation: +50 for matching positional bucket, +30 for the same club,
  +10 for age ±1, −30 for a bucket mismatch.
- **FIFA 2026 tiebreakers** apply head-to-head **first** (this changed for
  the 2026 cycle), then overall stats.
- **Bracket rendering.** When the user enters the knockout, the entire
  opposite half is simulated up to the final so we can render only the
  user's half plus the final — keeping the bracket UI scannable.
- **Penalties** run 5 rounds plus sudden death; per-shot probability
  is weighted by overall (clamped to `[0.3, 0.9]`); the full sequence is
  animated.
- **Country cooldown** = 5 picks (a rolled nation can't reappear in the next
  5 rolls).
- **Difficulty skips**: easy = 5, medium = 3, hard = 1.
- **Async squads.** The 570 KB squad JSON is fetched on boot instead of
  inlined. The initial bundle is ~144 KB gzip (down from ~263 KB pre-async).
- **Anon Supabase key is public by design.** It ships in the bundle via
  `VITE_*` envs. RLS protects the data, not the key.

## `.env.local` (gitignored)

```
VITE_SUPABASE_URL=https://pcclczydsjfspffuylmc.supabase.co
VITE_SUPABASE_ANON_KEY=<jwt>
VITE_SENTRY_DSN=<optional>
VITE_CF_BEACON_TOKEN=<optional>
```

Build-time only (used to upload sourcemaps to Sentry from CI; **not**
bundled into the client):

```
SENTRY_AUTH_TOKEN=<token>
SENTRY_ORG=<org slug>
SENTRY_PROJECT=<project slug>
```

## Roadmap

### Short term (this week)

- **Dynamic OG image** at run completion. This is the share-loop blocker
  flagged by [docs/launch-plan.md](./docs/launch-plan.md). ROI is high,
  cost is ~6h. Pick edge generation (Worker + Satori / `@vercel/og`).
- **`share_clicked` analytics event** so we can measure the share rate
  alongside `run_finished`.
- **Promote CSP from Report-Only to enforced** once Sentry reports a clean
  run of the prod traffic against the current policy.

### Medium term

- **Leaderboard.** Public read of finished runs is already allowed by RLS
  (`runs_public_read_completed`); the missing piece is a UI on top of it
  and a periodic aggregation (champion frequency, hardest draws, top
  average-overall XIs).
- **Better calibration loop.** The `calibrate:sim` step is one-shot; we
  want a continuous loop that incorporates the matches actually played in
  the simulator (telemetry-driven recalibration).
- **OAuth login** so users can claim their anonymous runs across devices.

### Known gotchas

- Bundle target is ~144 KB gzip initial; new dependencies should justify
  their weight or be dynamic-imported.
- `FooterMini` reads `window.location.pathname` directly (not SSR-safe;
  we don't ship SSR).
- The raw CSVs (`eafc26-players.csv`, `transfermarkt-players.csv`,
  `fbref-players.csv`) are gitignored — `pnpm data:rebuild` re-downloads
  them.
- `pnpm install` in CI requires `allowBuilds: esbuild` in
  `pnpm-workspace.yaml` or the install step breaks.

## Daily commands

```bash
pnpm dev               # localhost:5173
pnpm build             # production build
pnpm lint && pnpm test # the standard pre-PR check
pnpm sim:distortions   # 50 full campaigns → reports/distortions-*.{json,md}
pnpm data:rebuild      # full pipeline (network-bound, minutes)
```
