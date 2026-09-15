# Draft 26

**Play the game → [draft-26.pages.dev](https://draft-26.pages.dev)**

A dice-draft simulator for the 2026 FIFA World Cup. You roll one of the 48 nations, build a starting XI from the official 26-man roster, and play the whole tournament — group stage through the final.

Inspired by [7a0](https://7a0.com.br/) and [38a0](https://38a0.com/), scoped **only** to Copa 2026, with a custom UI and ratings merged from several real-world sources.

[Play](https://draft-26.pages.dev) · [Decisions](./docs/decisions.md) · [Features](./FEATURES.md)

## Product

The loop is the product. Everything else exists to make that loop feel fair, fast, and shareable.

1. **Draft** — pick formation, style, and difficulty. One dice roll per slot, with a nation cooldown so you cannot farm the same squad.
2. **Groups** — three rounds, FIFA 2026 Article 13 tie-breakers, and the eight best third-place sides into a 32-team knockout.
3. **Match** — minute-by-minute playback, extra time, and penalties in knockout.
4. **Bracket** — your half of the tree plus the final. Auto-scrolls to the playable tie.
5. **Share** — a generated image card and an addressable campaign at `/r/:id`.

The game is fully playable with no backend. `localStorage` holds the campaign; Supabase is an optional mirror for analytics and public runs.

## Strategy

Shipped as a **single-player client**. Multiplayer lobbies, betting, and a generic “any tournament” engine were explicit non-goals — they blow up state, RLS, and the UI for a loop that has to work on a phone during a match.

Quality is a **ratchet**, not a freeze. ESLint is `recommended` rather than type-aware (`~800` issues on a lift); `jsx-a11y` exceptions on drawer backdrops are documented with the follow-up (`<dialog>`). `pnpm check` is the gate: format, lint, typecheck, tests, build.

The four calls that actually had alternatives (local-first, Dixon–Coles, fetched squads JSON, opaque share ids) live in [`docs/decisions.md`](./docs/decisions.md). Ratings math is in [`docs/ratings-and-difficulty.md`](./docs/ratings-and-difficulty.md).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Pages (static SPA)                              │
│  hashed /assets/*  ·  must-revalidate /data/*  ·  CSP       │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│  React 19  ·  Vite 6  ·  React Router 7                     │
│                                                             │
│  Home is eager. Every other route is React.lazy.            │
│  Sentry and share-card generation are dynamic imports.      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ UI / routes  │  │ Domain libs  │  │ Data             │  │
│  │ (React)      │─▶│ (pure TS)    │◀─│ squads-enriched  │  │
│  └──────────────┘  │ draft        │  │ sim-params       │  │
│                    │ simulate     │  └───────────────────┘  │
│                    │ groups       │                         │
│                    │ bracket      │  localStorage keys      │
│                    │ narrate      │  d26:draft / worldcup / │
│                    └──────────────┘  bracket / speed        │
└────────────────────────────┬────────────────────────────────┘
                             │ optional
              ┌──────────────┴──────────────┐
              │ Supabase (RLS)              │
              │ Sentry (errors only)        │
              │ Cloudflare Web Analytics    │
              └─────────────────────────────┘
```

**Boundaries that matter**

- **The engine does not import React.** Match math, group tables, and bracket progression live in `src/lib/*` and are unit-tested in Node. UI is a consumer.
- **Home is the only eager route.** First paint does not wait on `/draft`, `/match`, or `/bracket` chunks. The Suspense fallback is an empty `100dvh` shell so the layout does not jump.
- **Backend is progressive enhancement.** No `VITE_SUPABASE_*` → full local game. With Supabase → campaign mirror, attribution, shareable `/r/:id`.
- **Observability is opt-in and lazy.** Sentry is a manual chunk (`manualChunks.sentry`) and `import()`’d from `initAnalytics()`. No DSN → zero Sentry bytes on the critical path. Sourcemaps upload in CI, then Vite deletes `dist/**/*.map` so they never ship to the browser.

## Patterns and techniques

### Simulation

Poisson scoring with a **Dixon–Coles (1997)** τ correction on 0–0 / 0–1 / 1–0 / 1–1, sampled on a 0–8 × 0–8 grid. Parameters (ρ, home advantage, goals/game) are fit in `scripts/calibrate-sim.ts` against ~5,800 competitive internationals since 2018.

Difficulty is a **rubber-band on the user’s overall only** (`match-pressure` + synergy). CPU vs CPU stays on the calibrated model, so the rest of the World Cup does not warp when you pick “hard”.

Statistical tests (`simulate.stats.test.ts`) run ~3,000 seeded campaigns and assert **relative** claims (“harder difficulty tightens the band”), so a recalibration does not fail the suite.

### Ratings pipeline

EA FC 26 covers ~73% of called-up players. Transfermarkt, an FBref per-bucket OLS fit, and a club-tier heuristic fill the rest. Joins disambiguate on `(positional bucket, club, age)` — without that, Alisson Becker (Liverpool GK) collided with a different Alisson.

A later **elite-2026** pass lifts the weak tail (World Cup squads should not sit at 62 overall) with a monotonic piecewise curve plus a tiny icon overlay. `originalOverall` is stored so re-runs do not compound.

### Competition rules as code

Group qualification is FIFA 2026 Article 13: 12 winners, 12 runners-up, eight best thirds → R32. Tie-breakers, including recursive head-to-head, live in `src/lib/groups.ts`, not in the UI.

The user’s XI **replaces the weakest side in a drawn group**. The other 11 groups simulate in lockstep with the user’s round, so the knockout picture is a real World Cup, not a fantasy bracket.

### Frontend craft

| Pattern                    | Where                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Route-based code splitting | `src/main.tsx` — `React.lazy` + named-export adapters                                                                    |
| Feature flags              | `?dev=1` persisted to `localStorage` (`src/lib/features.ts`)                                                             |
| Versioned persistence      | `d26:worldcup` bumped when the schema went from 1 group to 12; old saves are discarded, not migrated half-broken         |
| Error boundary             | `AppErrorBoundary` around the tree                                                                                       |
| Cache split                | hashed JS/CSS `immutable` for a year; `/data/*` `must-revalidate` so a ratings rebuild is picked up                      |
| Share cards                | HTML templates → PNG blob, native share sheet on mobile, download on desktop; loaded only when the user actually shares  |
| Addressable campaigns      | `/r/:id` for a public run without turning the game into a multiplayer app                                                |
| Local-first + RLS          | `localStorage` is source of truth; remote upserts never block; RLS = owner write, public **read of completed runs only** |
| Opaque share identity      | `playerToken` in links, not `auth.uid()`; first-touch UTM captured once (`src/lib/session.ts`)                           |
| Squads off the JS bundle   | ~570 KB JSON fetched at boot (`SquadsGate`); module bindings stay sync for existing call sites                           |
| Playback without churn     | `virtualMinute` mirrored on a ref so skip-to-end callbacks do not rebuild every 60 ms tick                               |

### Testing strategy

- **Jest** on pure domain code (draft, groups, bracket, simulate, narration).
- **Playwright** for the product path and a distortion batch (`pnpm sim:distortions`) that writes JSON/Markdown reports.
- A `window.__draft26__` harness in dev only, gated on squads load, so e2e can `waitForFunction` instead of sleeping.

## Stack

Vite 6 · React 19 · TypeScript · Tailwind v4 · React Router 7 · Jest · Playwright · Cloudflare Pages · Supabase (optional) · Sentry (optional)

## Local setup

```bash
pnpm install
cp .env.example .env.local   # all keys optional
pnpm dev
```

```bash
pnpm check                   # format, lint, typecheck, tests, build
pnpm test:e2e
```

Env, schema, and the data rebuild: [`docs/operations.md`](./docs/operations.md). Why we picked the model: [`docs/decisions.md`](./docs/decisions.md). Ratings curve: [`docs/ratings-and-difficulty.md`](./docs/ratings-and-difficulty.md). Every shipped screen: [`FEATURES.md`](./FEATURES.md).

## Layout

```
src/routes/          screens (lazy except Home)
src/components/      UI that is not a route
src/lib/             domain + persistence + telemetry (no React in the engine)
src/data/            squads loader / types
scripts/             scrape, enrich, calibrate — not the runtime
supabase/migrations  RLS + attribution views
docs/                operations, decisions, ratings
e2e/                 Playwright + distortion batch
```

## License

MIT. Built by [Rafael Pereira](https://github.com/rafael-pereira-tech).
