# Features

A complete, file-referenced inventory of what Draft 26 does today. Treat this
as the canonical answer to "does the app have X?" — if a feature is here,
it's shipped; if it's missing, it isn't built.

Last reviewed: 2026-06-15.

---

## Table of contents

1. [Routes & screens](#1-routes--screens)
2. [Draft loop](#2-draft-loop)
3. [Match engine & simulation](#3-match-engine--simulation)
4. [Group stage](#4-group-stage)
5. [Knockout bracket](#5-knockout-bracket)
6. [Live match playback & narration](#6-live-match-playback--narration)
7. [Data layer & rating sources](#7-data-layer--rating-sources)
8. [Persistence & remote sync](#8-persistence--remote-sync)
9. [Telemetry & analytics](#9-telemetry--analytics)
10. [Dev tooling & feature flags](#10-dev-tooling--feature-flags)
11. [Error handling & monitoring](#11-error-handling--monitoring)
12. [Performance optimizations](#12-performance-optimizations)
13. [Security & headers](#13-security--headers)
14. [Build, deploy & CI](#14-build-deploy--ci)
15. [Tests](#15-tests)
16. [Data pipeline scripts](#16-data-pipeline-scripts)

---

## 1. Routes & screens

SPA routing lives in `src/main.tsx`. Every route except `Home` is lazy-loaded
through `React.lazy` so the initial bundle only carries the landing page.

| Path           | Component (file)            | Purpose                                                     |
| -------------- | --------------------------- | ----------------------------------------------------------- |
| `/`            | `routes/Home.tsx`           | Landing page (dark Draft 26 theme, scoped via `.d26-scope`) |
| `/teams`       | `routes/Selecoes.tsx`       | 48-nation grid grouped by Copa 2026 group letter            |
| `/teams/:code` | `routes/SelecaoDetalhe.tsx` | Single squad detail (full roster, market values)            |
| `/draft`       | `routes/Draft.tsx`          | Formation/style/difficulty setup → roll-by-slot drafting    |
| `/groups`      | `routes/Copa.tsx`           | 3-round group stage + standings                             |
| `/match`       | `routes/Match.tsx`          | Live match playback (group or knockout via `?kind=`)        |
| `/bracket`     | `routes/MataMata.tsx`       | 32-team knockout, renders the user's half + the final       |

### Landing page (`/`) — sections

Implemented in `routes/Home.tsx`:

- Sticky top bar with `Wordmark` and primary CTA
- Hero with diagonal gradient, dice mark, and "JOGAR" call-to-action
- `ComoFuncionaSection` — how the app works (3-step explainer)
- `RegrasSection` — rules of the simulator
- `CaminhoSection` — visual journey from draft → bracket
- `SelecoesSection` — preview of the 48 teams
- `CtaFinalSection` — closing CTA
- Footer with privacy drawer (modal)

The route is **eager** (not lazy) so the first paint isn't gated by an extra
chunk fetch.

### Teams browser (`/teams`)

`routes/Selecoes.tsx` renders the 48 squads grouped by Copa 2026 group letter
(A–L). Each card shows the 3-letter code, flag, average overall, coach, and
the primary formation. Cards are clickable and link to `/teams/:code`. Total
player count is computed at render time.

### Team detail (`/teams/:code`)

`routes/SelecaoDetalhe.tsx`:

- Returns a 404-style fallback when `code` doesn't match a squad
- Hero strip with nation gradient, coach, primary + alternative formation
- Player roster split by bucket (GK → DEF → MID → FWD), sorted by shirt number
- Per-player: shirt #, name, primary position, club + club-country flag, age,
  caps/goals, overall, market value
- Market value formatting: `€X.XM` (≥ 1M), `€XXK` (≥ 1K), `€XX`, or `—` when
  unavailable; a ✦ marker distinguishes Transfermarkt fallback values from
  EA FC 26 values
- Fires the `team_detail_viewed` analytics event on mount

### Draft setup (`/draft`)

See [§2 Draft loop](#2-draft-loop) for the gameplay; the route itself
contains:

- **Three phases:** setup → build → ready
- Setup is a drawer (`components/SetupDrawer.tsx`) with formation, style, and
  difficulty pickers
- Build phase renders the pitch (`components/Field.tsx`) with the 11 slots and
  the per-slot drawer (`components/PickDrawer.tsx`)
- `AppBar` with conditional Reset and a "JOGAR" link
- `ProgressStrip` shows formation name, style, skips remaining, fill count
- Dev/debug **Auto-fill** button (only when the dev flag is on)
- **Simulate** button (only when `isComplete`) persists the draft, clears
  any in-progress World Cup, and routes to `/groups`

### Group stage (`/groups`)

See [§4 Group stage](#4-group-stage). The route:

- Loads the persisted `WorldCupGroups` or constructs one from the draft
- Supports `?demo=1` (and `features.dev`) which autofills a medium-difficulty
  XI without going through `/draft`
- Renders standings, the user's three matches, and per-round CPU results
- Each round auto-simulates lockstep with the user's match
- Persists the World Cup back to `localStorage` (and mirrors to Supabase if
  configured)
- Emits `group_round_completed` and `group_completed` events

### Knockout bracket (`/bracket`)

See [§5 Knockout bracket](#5-knockout-bracket). The route renders the user's
half of the bracket plus the final (`components/BracketView.tsx`), and shows
drawers for elimination and the champion screen.

### Live match (`/match`)

See [§6 Live match playback & narration](#6-live-match-playback--narration).
The same route handles both group and knockout matches; the kind is selected
by the `?kind=` query param.

---

## 2. Draft loop

Source: `src/lib/draft.ts`.

### Constants

- `COUNTRY_COOLDOWN = 5` — a country that was just rolled cannot reappear in
  the next 5 rolls
- `DIFFICULTY_SKIPS = { easy: 5, medium: 3, hard: 1 }` — how many "skip this
  country" tickets the player gets per campaign

### Roll algorithm

- `rollForSlot` picks a country at random from the pool of countries that
  (a) are not on cooldown and (b) the player hasn't picked yet
- `rollUntilCompatible` re-rolls automatically when the random country has
  **no compatible player** for the current slot (so the user is never stuck
  with an unfillable slot)
- The pending roll is stored on the slot itself (`pendingSquadCode`), so
  closing and reopening the drawer doesn't re-randomize the country
- `setPendingRoll` / `clearPendingRoll` manage that pending state
- `applyRoll` appends the squad code to the chronological log
  (`rolledCountries`)

### Formation, style, difficulty

`src/lib/formations.ts` defines four formations with `{x, y}` slot
coordinates used by the pitch SVG:

- **4-3-3** — high press, wing-based attacks
- **4-2-3-1** — balanced, classic playmaker
- **4-4-2** — two lines of 4, dual strikers
- **3-4-3** — three centre-backs, advanced wing-backs

Three styles (`Ofensivo`, `Equilibrado`, `Defensivo`) and three difficulties
(`easy`, `medium`, `hard`) are part of `DraftState`. Difficulty drives skips
(above) and the rubber-band intensity in simulation
(see [§3](#3-match-engine--simulation)).

### Position compatibility

`src/lib/positions.ts` decides whether a player fits a slot. It checks the
player's `primaryPosition` **and** any `altPositions[]` entry against the
slot's `COMPAT` set. The bridges built into `COMPAT` (so the data doesn't
need an alt entry) are:

- `LB ↔ LWB`, `RB ↔ RWB`
- `LM ↔ LW`, `RM ↔ RW`
- `CF ↔ ST`

Cross-bridges that **do** require alt positions in the data (CDM ↔ CM ↔
CAM, LB → LM, etc.) are populated through three sources: EA FC 26
`player_positions` (during `enrich:fifa`), Transfermarkt `sub_position` +
heuristic bridges (during `enrich:alt-positions`), and a curated overlay at
`data/position-overrides.json`.

### Slot-by-slot drawer

`components/PickDrawer.tsx`:

- Click a slot → drawer slides up with a "Roll country" CTA
- Roll → country + flag + the list of compatible players (sorted by overall)
- Player tap commits the pick and closes the drawer
- A pending roll is preserved if the drawer is closed without picking
- Skipping a country (when skips remain) clears the pending roll and rolls a
  new one
- All actions are tracked: `country_rolled`, `player_picked`,
  `autofill_clicked`, etc.

### Derived values

- `isComplete(state)` — true once all 11 slots have a player
- `averageOverall(state)` — sum / 11, rounded to 0.1 (the canonical strength
  signal used by simulation, seeding, and tiebreakers)
- `totalValueEur(state)` — sum of player values (EA FC overrides
  Transfermarkt)

### Autofill (dev only)

`src/lib/autofill.ts` greedily fills every empty slot with the best
compatible player from any country, scoring
`top.overall + squad.averageOverall * 0.1`. Cooldown is respected; no
country can be picked twice. Exposed in the UI only when `features.dev` is
on.

---

## 3. Match engine & simulation

Source: `src/lib/simulate.ts`, parameters in `data/sim-params.json`.

### Model

Dixon-Coles (1997) correction over a weighted Poisson:

- Each team's expected goal rate λ is derived from the overall difference
- `HOME_ADVANTAGE` (from `sim-params.json`) is added to the home side's
  effective overall
- The Dixon-Coles τ(x, y, λ, μ, ρ) correction is applied to the low-score
  cells (0-0, 0-1, 1-0, 1-1) using the calibrated `rho` constant
- Final score is sampled by inverse-CDF over a 9×9 grid

### Tunable parameters (`data/sim-params.json`)

Calibrated by `scripts/calibrate-sim.ts` against ~5,800 international
matches. Includes:

- `avgGoalsPerMatch`
- `homeAdvantage`
- `rho` — Dixon-Coles low-score correlation
- `rubberBand.base` and `rubberBand.byDifficulty[difficulty]`

### Rubber-band (difficulty asymmetry)

When a match involves the user **and** a difficulty is provided:

- `effective = userOverall - intensity * (oppOverall - userOverall)`
- Stronger opponents are pulled further away; weaker opponents are pulled
  closer — by the calibrated factor for the chosen difficulty
- CPU-vs-CPU matches are unaffected
- ET does not re-apply the rubber-band (asymmetry already baked into the FT
  result)

### Seeded RNG

`seededRng(seed)` returns a Mulberry32 generator for reproducible runs (used
by the sim harness and statistical tests). Default RNG is `Math.random`.

### Extra time and penalties (knockout only)

- `simulateExtraTime` — ~0.7 expected goals total, same proportions
- `shootout` — 5 rounds + sudden death; per-shot conversion probability is
  `0.55 + (overall - 75) * 0.01`, clamped to `[0.3, 0.9]`
- Returns the full sequence of penalty results, used by the UI to animate
  the shootout

---

## 4. Group stage

Source: `src/lib/groups.ts`.

### Twelve-group Copa 2026 model

`WorldCupGroups = { userLetter, groups[12] }` models **all** 12 groups, not
just the user's. The user's XI (special code `'YOU'`, flag `'⚡'`) replaces
the weakest team in a randomly chosen group, weighted 40/30/20/10 from the
4th-strongest down. The remaining 11 groups are CPU-only.

### Match schedule

- 4 teams per group, 6 matches each → 72 matches per round-robin
- 3 rounds (each team plays 3 matches)
- `playRound` simulates the user's match with full narration; CPU matches
  in the user's group are simulated without narration
- `playCpuRound` advances the other 11 groups in lockstep with the user

### Standings & tiebreakers — FIFA 2026 Article 13

Implemented in `standings(group)`:

1. Points (W=3, D=1, L=0)
2. Head-to-head points
3. Head-to-head goal difference
4. Head-to-head goals scored
5. Overall goal difference
6. Overall goals scored
7. _(Fair play skipped — no card weight in the simulator)_
8. `averageOverall` proxy (substituting for the FIFA drawing of lots)

### Qualification

`computeQualifiers(worldCup)` applies the Copa 2026 rule:

- 12 first-place teams qualify
- 12 second-place teams qualify
- The **8 best** third-place teams qualify (cross-group ranked by the same
  tiebreakers)
- All 12 fourth-place teams are eliminated

### User fate

`userFate(worldCup)` returns the exact state the user ended up in:

- `qualified-1st`
- `qualified-2nd`
- `qualified-3rd-rank` (3rd-place that made the cut)
- `eliminated-3rd-rank` (3rd-place that didn't make the cut)
- `eliminated-4th` (last in group)

The UI uses this to pick the right messaging — no more "you're out" when the
user actually advanced as a 3rd-place.

---

## 5. Knockout bracket

Source: `src/lib/bracket.ts`.

### Seeding & pairing

- The 32 qualifiers are ranked by `(groupPosition asc, points desc,
goalDiff desc, goalsFor desc, averageOverall desc)` → seeds 1 through 32
- Pairs follow the **NCAA snake** order
  `SEED_ORDER_32 = [1, 32, 16, 17, 8, 25, 9, 24, …]` (full list in code),
  guaranteeing the top two seeds can only meet in the final
- The bracket is symmetric: top half = R32 matches 1–8, bottom half = R32
  matches 9–16

### Round structure

R32 (16) → R16 (8) → QF (4) → SF (2) → F (1)

### Match life cycle

Each `BracketMatch` carries:

- `id` (e.g., `"R32-1"`), `round`, `position`
- `homeCode`, `awayCode` (filled as the previous round resolves)
- `result`, `extraTime?`, `penalties?`, `winnerCode?`

`fullySimulate` plays the full match: 90 minutes → ET if drawn → penalties
if still drawn. ET goals and penalty sequence are stored on the match for
the UI.

### Render strategy

`setupBracket(worldCup, rng)` creates the bracket and immediately calls
`ensureRoundsSimulated(bracket, rng)`. That helper walks the rounds in
order; for each round it calls `simulateNonUserRound` (which plays every
match that isn't the user's) and then stops as soon as it finds the
user's next pending match. If the user has already been eliminated, it
continues straight through to the final so the bracket UI can show the
champion. Each user match plays normally; `ensureRoundsSimulated` is
called again afterwards so the next round of non-user matches catches
up.

### User helpers

- `nextUserMatch(bracket)` — the user's next unplayed match
- `userHalfOf(bracket)` — `'top'` or `'bottom'`
- `userPath(bracket)` — chronological list of all user matches
- `userEliminator(bracket)` — the match (and opponent) that knocked the user
  out, if any
- `advance(bracket, matchId, rng)` — commits a match's result and fills the
  winner into the next round

### Tracking

The route fires `match_completed` for every knockout match and `cup_ended`
with `{ finishedRound, champion, userWon }` once the bracket resolves
(either champion or user eliminated).

---

## 6. Live match playback & narration

Source: `src/routes/Match.tsx`, `src/lib/narrate.ts`.

### Playback controls

- **Play / pause** toggle
- **Speed**: `slow` (60s wall-clock for 90 minutes), `normal` (30s), `fast`
  (12s). The chosen speed is saved to `localStorage` (`d26:speed`)
- **Skip to end** jumps to the final whistle (still records the same final
  result; events past the current minute are flushed)
- Tick rate is 60ms; virtual minute advances proportionally

### Two match kinds

Selected by the `?kind=` query param:

- **Group match** (default) — round 1/2/3, identified by round + opponent
  code
- **Knockout match** (`kind=knockout`) — identified by the bracket match
  `id`; carries ET + penalty visualization

### Narration

`narrateMatch({ home, away, result })` generates a stream of events:

- **Goals** — 4 templates (the player and team are substituted in)
- **Yellow cards** — 3 templates
- **Red cards** — 2 templates

Player picking is position-weighted:

- Scorer: 60% attackers / 30% midfielders / 9% defenders / 1% GK, weighted
  inside each bucket by overall
- Fouler: 50% defenders / 35% midfielders / 15% attackers

Minutes are spread uniquely across `[1, 90]` and sorted.

### Performance pattern

Both `GroupMatchRunner` and `KnockoutMatchRunner` use a ref-mirror for
`virtualMinute`:

```ts
const virtualMinuteRef = useRef(0)
virtualMinuteRef.current = virtualMinute
```

so the "skip to end" `useCallback` doesn't recreate every 60ms tick — which
would invalidate the memoized panel.

### Analytics

- `match_started` with kind, round, side, opponent code, initial speed
- `match_speed_changed` (every toggle)
- `match_completed` with score, result, and margin

---

## 7. Data layer & rating sources

### Bundle vs runtime fetch

The squad data was historically inlined into the bundle. Today it's a
**~570 KB JSON file** served as a static asset at
`/data/squads-enriched.json` (committed to the repo and copied to `dist/`
by Vite). `src/data/squads.ts` exposes a `loadSquads()` promise that
fetches and hydrates the in-memory bindings (`squads`, `squadsByCode`,
`groupedSquads`).

`components/SquadsGate.tsx` blocks the rest of the app from rendering
until `loadSquads()` resolves (loading state is an invisible
`<div aria-busy="true">`, error state shows a reload button).

### Player record

```
shirt:            number | null
position:         'GK' | 'DEF' | 'MID' | 'FWD'   // coarse bucket
primaryPosition?: 'CB' | 'LW' | 'ST' | …         // granular slot fit
altPositions?:    string[]
name, isCaptain, dateOfBirth, age, caps, goals
club, clubCountry
overall, value_eur?, value_eur_tm?, value_eur_tm_peak?
ratingSource?: 'fifa' | 'fifa-fuzzy' | 'fbref-fit' | 'tm' | 'club-tier' | 'heuristic'
fbref?:        { per-90 stats }                  // when matched
```

### Multi-source rating system

Priority order, with approximate coverage:

- `'fifa'` (~73%) — EA FC 26 exact or initials match. Most reliable
- `'fifa-fuzzy'` (<1%) — EA FC 26 via Levenshtein, edge cases
- `'fbref-fit'` (~2%) — no FIFA but has 2025-26 FBref stats from the Top 5
  leagues; overall comes from the per-bucket OLS regression in
  `calibrate-from-fbref.ts`. Catches real names that EA missed (e.g., Rayan
  at Bournemouth, Jeremy Arévalo at Stuttgart)
- `'tm'` (~8%) — no FIFA and no FBref; rating derived heuristically from
  Transfermarkt market value buckets
- `'club-tier'` (~17%) — final fallback using only club + caps + age
  (mostly domestic leagues in Iran, Jordan, Uzbekistan, Saudi Arabia)

### Match disambiguation

Every data source scores candidates by `(positional bucket, club, age)`.
This is the fix that prevented Alisson Becker (GK at Liverpool) from being
matched to the right-winger of the same name at Shakhtar.

### FBref overlay

For every player matched against FBref, the per-90 stats (xG, xA,
progressive carries, tackles, etc.) are stored under `player.fbref` —
including FIFA-matched players, so the calibration can be re-trained or
validated later.

### Raw data

`data/eafc26-players.csv`, `data/transfermarkt-players.csv`, and
`data/fbref-players.csv` are gitignored. They're re-downloaded by
`pnpm data:rebuild`. FBref comes from a Kaggle download (free account
required); the other two are scraped automatically.

---

## 8. Persistence & remote sync

### localStorage (source of truth)

`src/lib/persistence.ts` manages four keys:

- `d26:draft` — `DraftState` (the `Formation` object is omitted; `loadDraft`
  re-derives it from `formationName`)
- `d26:worldcup` — `WorldCupGroups`
- `d26:bracket` — `KnockoutBracket`
- `d26:speed` — `'slow' | 'normal' | 'fast'`

In-flight runs are always authoritative in `localStorage`. The remote
mirror is fire-and-forget.

### Supabase (optional remote mirror)

Schema in `supabase/migrations/0001_runs.sql`. Two tables:

- `runs` — `user_id, draft_json, stage_json, bracket_json, formation,
difficulty, average_overall, replaced_code, champion_code,
finished_round, completed_at`
- `events` — `user_id, session_id, event_type, props (jsonb)`

Both tables have RLS policies:

- `runs_owner_all` — owner sees all their rows
- `runs_public_read_completed` — anyone can read finished runs (no PII)

`src/lib/runs.ts` handles anonymous sign-in (`ensureAnonUser`) and the
fire-and-forget upserts. If `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
are unset, every Supabase call is a no-op and the app continues entirely
on `localStorage`.

The `runs` upsert is wired into the gameplay loop (called as each round and
each knockout match completes); the `events` table is wired through
`src/lib/track.ts` (see [§9](#9-telemetry--analytics)).

### Session context

`src/lib/session.ts` collects:

- A `sessionId` UUID per browser tab (sessionStorage)
- UTM parameters from the URL (`utm_source`, `utm_medium`, `utm_campaign`,
  `utm_content`, `utm_term`)
- Device class (mobile < 640 px, tablet < 1024 px, desktop ≥ 1024 px)
- Referrer, viewport (w × h), locale, timezone, pixel ratio

Sent once per session as the `session_init` event.

---

## 9. Telemetry & analytics

### Init (`src/lib/analytics.ts`)

- **Sentry** — dynamic import, gated on `VITE_SENTRY_DSN`. Release tag is
  `CF_PAGES_COMMIT_SHA[:7]` (or `'dev'` locally); `tracesSampleRate: 0` so
  it's error-only
- **Cloudflare Web Analytics** — script injection when
  `VITE_CF_BEACON_TOKEN` is set; provides page views + Core Web Vitals

Both are lazy/conditional to keep the initial bundle clean.

### Event tracking (`src/lib/track.ts`)

`track(eventType, props)` is fire-and-forget into Supabase `events`. It
never throws and is a no-op when Supabase isn't configured.

Tracked events:

- `session_init` — once per browser tab, with the full session context
- `view_page` — every route change (via `PageViewTracker`)
- `draft_started` — user enters `/draft`
- `draft_setup` — `{ formation, style, difficulty }` chosen
- `country_rolled` — `{ countryCode, slotPos, skippedBefore, source }`
- `player_picked` — `{ playerName, countryCode, slotPos, overall, candidatesCount }`
- `autofill_clicked` — `{ filledBefore }`
- `draft_completed` — `{ formation, style, difficulty, avgOverall, rollsUsed,
skipsUsed, autoFillUsed, topPicks[] }`
- `reset_clicked` — `{ from, hadDraft }`
- `match_started` — `{ kind, round?, userIsHome, oppCode, initialSpeed }`
- `match_speed_changed` — `{ kind, round?, from, to }`
- `match_completed` — `{ kind, round?, oppCode, userGoals, oppGoals,
result, margin }`
- `group_round_completed` — `{ round, userGoals, oppGoals, result, oppCode,
posAfter, pointsAfter }`
- `group_completed` — `{ fate, qualified }`
- `team_detail_viewed` — `{ code, country }`
- `cup_ended` — `{ finishedRound, champion, userWon }`

`PageViewTracker` is mounted inside `<BrowserRouter>` and fires `view_page`
on every location change.

---

## 10. Dev tooling & feature flags

### Feature flag (`src/lib/features.ts`)

- Enabled by `?dev=1` (persists to `localStorage` under the key
  `feature:dev`) or by setting `localStorage.setItem('feature:dev', '1')`
  directly
- Reading `features.dev` gates:
  - The dev-only Autofill button on `/draft`
  - The `?demo=1` shortcut on `/groups`
  - The `window.__draft26__` harness exposure (see below)

### Sim harness (`src/lib/sim-harness.ts`)

When `features.dev` is on and `loadSquads()` has resolved, `main.tsx`
attaches:

```js
window.__draft26__ = { simulateFullCup, runDistortionBatch }
```

- `simulateFullCup(seed, options?)` — runs a complete campaign
  (draft → groups → bracket) and returns a structured `RunResult` with the
  XI, all match results, the user fate, biggest win/loss, etc.
- `runDistortionBatch(count, baseSeed)` — runs `count` campaigns with
  seeds `baseSeed + 0 … baseSeed + count - 1` and returns a list of
  `RunResult` for statistical analysis

Used by `pnpm sim:distortions` (Playwright harness at
`e2e/distortions.spec.ts`), which writes a JSON + Markdown report to
`reports/distortions-{timestamp}.{json,md}`.

---

## 11. Error handling & monitoring

### `AppErrorBoundary` (`src/components/AppErrorBoundary.tsx`)

A class boundary that wraps the whole app in `main.tsx`. On render or
lifecycle errors:

- Reports to Sentry via a lazy import (preserves the Sentry chunk split)
- Renders a fallback ("Algo quebrou por aqui") with a reload button
- In dev mode, shows the stack trace

### Sentry hardening

- Release tagging: `CF_PAGES_COMMIT_SHA[:7]` from the Cloudflare Pages env
- Source-map upload via `@sentry/vite-plugin` when `SENTRY_AUTH_TOKEN` is
  set at build time; maps are deleted from `dist/` afterwards so they never
  ship to the browser

### SquadsGate

`src/components/SquadsGate.tsx` guards the rest of the app against null
references by blocking render until `loadSquads()` resolves (or showing an
error screen with a reload button if the fetch fails).

---

## 12. Performance optimizations

### Route code-splitting

`src/main.tsx` lazy-loads every route except `Home`, and wraps the
`<Routes>` in a `<Suspense>` with a minimal layout-stable fallback (an
`aria-busy` `div` reserving the viewport height — no spinner, no flash).

### Async squads

The 570 KB squad JSON is served as a static asset and fetched on boot
instead of being inlined. The previous inline strategy added the full JSON
weight to the initial bundle; the current pattern brings the gzipped
initial bundle to roughly **144 KB** (down from ~263 KB).

### Memo + ref-mirror in `Match.tsx`

`virtualMinute` is mirrored into a `useRef` so the `onSkipToEnd`
`useCallback` doesn't recreate every 60 ms tick — which would invalidate
`React.memo`'d children downstream.

### Tailwind v4 JIT

`@tailwindcss/vite` only emits used utilities; no unused CSS ships.

### Sentry chunking

The Sentry SDK is dynamically imported, so it lives in its own chunk and
doesn't tax the initial parse.

---

## 13. Security & headers

### `public/_headers` (Cloudflare Pages)

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(),
                      usb=(), interest-cohort=()
  Content-Security-Policy-Report-Only: default-src 'self';
    script-src 'self' https://static.cloudflareinsights.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob:;
    connect-src 'self' https://*.supabase.co https://*.ingest.sentry.io
                https://*.ingest.us.sentry.io https://cloudflareinsights.com;
    frame-ancestors 'none'; base-uri 'self'; form-action 'self';
    object-src 'none'
```

Notes:

- The hashed `/assets/*` chunks get `max-age=31536000, immutable`. HTML is
  intentionally **not** in `/*` here because Cloudflare Pages would
  concatenate duplicate `Cache-Control` directives; CF's default
  (`max-age=0, must-revalidate` for HTML) is already correct
- CSP is in **Report-Only** today — we observe violations before promoting
  to enforcement

### `public/_redirects`

```
/*    /index.html   200
```

SPA fallback only. Cloudflare Pages serves real assets (e.g.,
`/og.png`, `/data/squads-enriched.json`) **before** evaluating 200
rewrites, so the JSON fetch isn't shadowed.

### Supabase RLS

The anon key is public by design (it's a JWT shipped in the bundle). Row
Level Security in `supabase/migrations/0001_runs.sql` is what protects the
data:

- `runs_owner_all` — owner can read/write their own rows
- `runs_public_read_completed` — anonymous reads are only allowed for rows
  with `completed_at is not null`

---

## 14. Build, deploy & CI

### Local commands

```bash
pnpm dev               # vite dev server (localhost:5173)
pnpm build             # tsc -b && vite build → dist/
pnpm preview           # serve dist/
pnpm lint              # tsc -b --noEmit
pnpm test              # vitest run (~200ms, 96+ tests)
pnpm test:watch        # vitest in watch mode
pnpm test:coverage     # vitest run --coverage
pnpm test:e2e          # playwright (e2e/)
pnpm sim:distortions   # run 50 campaigns end-to-end and emit reports
pnpm data:rebuild      # full data pipeline (network-bound, ~minutes)
```

### Cloudflare Pages

- Build command: `pnpm build`
- Output directory: `dist/`
- Build-time env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_SENTRY_DSN`, `VITE_CF_BEACON_TOKEN`, `SENTRY_AUTH_TOKEN`. The
  Sentry org and project are hard-coded in `vite.config.ts`, so only the
  auth token needs to come from the environment

### CI (`.github/workflows/ci.yml`)

Triggered on push to `main` and on every PR:

1. Checkout
2. Setup pnpm 11
3. Setup Node 24 (cache via pnpm)
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm test`
7. `pnpm build`

Concurrency: stale runs cancel when a new push arrives.
`pnpm install` requires `allowBuilds: { esbuild: true }` in
`pnpm-workspace.yaml` (already set) — CI will break without it.

---

## 15. Tests

### Unit tests (Vitest, node env)

- `src/lib/draft.test.ts` — roll logic, cooldown, skip accounting
- `src/lib/positions.test.ts` — compatibility bridges and alt positions
- `src/lib/groups.test.ts` — standings, tiebreakers, qualifier computation
- `src/lib/bracket.test.ts` — seeding, NCAA snake order, advance logic
- `src/lib/simulate.test.ts` — Poisson model determinism, Dixon-Coles cells
- `src/lib/simulate.stats.test.ts` — **seeded statistical** suite running
  ~3,000 simulations per scenario, with ±10% tolerance. Asserts relative
  outcomes (e.g., rubber-band tilts hard < no-difficulty) instead of
  absolutes so re-calibration doesn't break tests
- Setup: `src/lib/test-setup.ts` hydrates the in-memory squads from disk

### E2E (Playwright)

`e2e/distortions.spec.ts` (run via `pnpm sim:distortions`):

- Starts the Vite dev server automatically (`playwright.config.ts`)
- Loads the app with `?dev=1` so `window.__draft26__` is exposed
- Calls `runDistortionBatch(50)` (or `DRAFT26_RUNS=N`)
- Aggregates the results into `reports/distortions-{timestamp}.json` and a
  human-readable `.md`

E2E is **not** part of `pnpm test` or default CI.

### Tooling

- `pnpm setup:e2e` — explicit `playwright install chromium` (the test
  scripts auto-install it too; no-op when already cached)

---

## 16. Data pipeline scripts

Every script lives in `scripts/` and is invoked through `pnpm`. Run in the
order below for a full rebuild, or invoke individually for incremental
work. `pnpm data:rebuild` chains them all.

| Command                       | Script                         | Purpose                                                                                                         |
| ----------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `pnpm scrape:squads`          | `scrape-squads.ts`             | Scrapes 48 squads from the Wikipedia "2026 FIFA World Cup squads" page                                          |
| `pnpm enrich:squads`          | `enrich-squads.ts`             | Adds ISO codes, flags, heuristic formation, club-tier overall                                                   |
| `pnpm download:fifa`          | `download-fifa-dataset.ts`     | Downloads the EA FC 26 player CSV (~10 MB, gitignored)                                                          |
| `pnpm enrich:fifa`            | `enrich-with-fifa.ts`          | Joins EA FC ratings with disambiguation; populates `primaryPosition` + `altPositions[]`                         |
| `pnpm download:transfermarkt` | `download-transfermarkt.ts`    | Pulls the dcaribou/transfermarkt-datasets ZIP and extracts players.csv (~4 MB)                                  |
| `pnpm enrich:transfermarkt`   | `enrich-with-transfermarkt.ts` | Cross-references market value; doesn't overwrite EA FC ratings                                                  |
| `pnpm enrich:alt-positions`   | `enrich-alt-positions.ts`      | Layers TM `sub_position` + heuristic bridges into `altPositions[]`                                              |
| `pnpm recalibrate:heuristic`  | `recalibrate-heuristic.ts`     | Recomputes the club-tier fallback overall formula                                                               |
| `pnpm download:fbref`         | `download-fbref.ts`            | Prints instructions for the Kaggle FBref download (manual)                                                      |
| `pnpm enrich:fbref`           | `enrich-with-fbref.ts`         | Joins FBref per-90 stats; stores them on `player.fbref`                                                         |
| `pnpm calibrate:fbref`        | `calibrate-from-fbref.ts`      | Per-bucket OLS regression (GK/DEF/MID/FWD) to fit overall for FBref-only players (`ratingSource = 'fbref-fit'`) |
| `pnpm download:matches`       | `download-matches.ts`          | Downloads international match results (~2018+) for sim calibration                                              |
| `pnpm calibrate:sim`          | `calibrate-sim.ts`             | Fits the Poisson model and Dixon-Coles ρ against the historical matches                                         |
| `pnpm data:rebuild`           | (chain)                        | Runs every step above in order                                                                                  |

`data/squads-enriched.json` is committed and is the runtime source of
truth. The raw CSVs are gitignored.
