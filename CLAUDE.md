# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Draft 26 — single-player simulator of the 2026 FIFA World Cup. The user drafts an XI position-by-position (each slot rolls a random country, then picks a compatible player from that country's roster), then plays group stage + knockout bracket against the other 47 nations. Inspired by 7a0.com.br / 38a0.com, scoped narrowly to Copa 2026.

The repo's `README.md` and `HANDOFF.md` are the canonical product overview — read them before scoping any non-trivial change. Code comments are in pt-BR; default to pt-BR for new comments/docstrings.

## Commands

```bash
pnpm dev               # vite dev server (localhost:5173)
pnpm build             # tsc -b && vite build → dist/
pnpm preview           # serve dist/
pnpm lint              # tsc -b --noEmit
pnpm test              # vitest run (~200ms, 96+ tests)
pnpm test:watch        # vitest in watch mode
pnpm test:coverage     # vitest run --coverage (HTML report em coverage/)
pnpm test:e2e          # playwright (e2e/)
pnpm sim:distortions   # roda 50 campanhas E2E e gera report (reports/distortions-*.{json,md})
pnpm data:rebuild      # full data pipeline (network-bound, ~minutes)
```

Individual pipeline steps (run in order if rebuilding manually):
`pnpm scrape:squads` → `pnpm enrich:squads` → `pnpm download:fifa` → `pnpm enrich:fifa` → `pnpm download:transfermarkt` → `pnpm enrich:transfermarkt` → `pnpm enrich:alt-positions`.

CI roda `lint + test + build` em PR e push pra main (`.github/workflows/ci.yml`). When asked to verify, run `pnpm lint && pnpm test` and exercise the UI in the dev server.

Tests live next to the code they test (`src/lib/*.test.ts`). Engine has both deterministic (correctness) and seeded statistical suites (`simulate.stats.test.ts` — N≈3000 sims com tolerância ±10%). Stats tests preferem comparações relativas (rubber-band em hard < no-difficulty) sobre asserts absolutos pra resistir a re-calibração.

E2E (Playwright, `e2e/`) ficam separados — não rodam no `pnpm test` nem no CI default. Use `pnpm sim:distortions` pra rodar 50 (ou `DRAFT26_RUNS=200`) campanhas inteiras via `window.__draft26__` (exposto em dev mode em `src/main.tsx`) e gerar `reports/distortions-{timestamp}.{json,md}`. O harness vive em `src/lib/sim-harness.ts` (`simulateFullCup(seed)` retorna `RunResult` estruturado). Configuração em `playwright.config.ts` — sobe o vite dev server automaticamente.

Playwright 1.38+ não baixa o Chromium no `pnpm install` — os scripts `test:e2e`, `test:e2e:ui` e `sim:distortions` rodam `playwright install chromium` antes do test (no-op se já cacheado, ~150MB no primeiro run). Pra instalar separado: `pnpm setup:e2e`.

`pnpm install` requires `allowBuilds: { esbuild: true }` in `pnpm-workspace.yaml` (already set) — CI will break without it.

## Architecture

### Frontend (SPA)

Vite 6 + React 19 + TS + Tailwind v4. Routing via React Router 7 (`BrowserRouter`, defined in `src/main.tsx`):

| Route          | Component                       | Purpose                                              |
|----------------|---------------------------------|------------------------------------------------------|
| `/`            | `routes/Home`                   | Landing (dark-themed, scoped via `.d26-scope`)       |
| `/teams`       | `routes/Selecoes`               | 48-nation grid (wrapped in `AppLayout`)              |
| `/teams/:code` | `routes/SelecaoDetalhe`         | Single squad detail                                  |
| `/draft`       | `routes/Draft`                  | Formation/style/difficulty setup → roll-by-slot      |
| `/groups`      | `routes/Copa`                   | 3-round group stage                                  |
| `/match`       | `routes/Match`                  | Live match (group or knockout via `?kind=`)          |
| `/bracket`     | `routes/MataMata`               | 32-team knockout, renders user's half + final only   |

Note: README.md / HANDOFF.md still reference the old Portuguese paths (`/selecoes`, `/copa`, `/mata-mata`). The code has moved to English paths — trust `src/main.tsx`, not the docs.

### Core domain (everything important is in `src/lib/`)

- **`draft.ts`** — `DraftState` plus the country-cooldown sorter. `rollUntilCompatible` re-rolls automatically when the random country has no player compatible with the current slot. `COUNTRY_COOLDOWN = 5` (a rolled country can't reappear in the next 5 rolls). Pending rolls are persisted on the slot itself so closing/reopening the drawer doesn't re-randomize.
- **`formations.ts`** — 4 formations (4-3-3, 4-2-3-1, 4-4-2, 3-4-3) with `{x, y}` coordinates per slot; `DIFFICULTY_SKIPS` = `{ easy: 5, medium: 3, hard: 1 }`.
- **`positions.ts`** — slot↔player compatibility checks `primaryPosition` **OR** any `altPositions[]` entry against the slot's COMPAT table. Bridges built into COMPAT (sem precisar de alt no jogador): `LB↔LWB`, `RB↔RWB`, `LM↔LW`, `RM↔RW`, `CF↔ST`. Cruzamentos CDM/CM/CAM e LB→LM etc precisam vir do dado (altPositions). Alt positions são populadas em três camadas — FIFA `player_positions` (enrich:fifa), TM `sub_position` + bridges heurísticos (enrich:alt-positions), e overlay curado em `data/position-overrides.json`.
- **`simulate.ts`** — Poisson-weighted match engine; per-team rate = `(strength^1.5 / total) * 2.6` with `HOME_ADVANTAGE = 2` added to the home overall. `seededRng` is Mulberry32 for reproducibility.
- **`groups.ts`** — Modela TODOS os 12 grupos da Copa via `WorldCupGroups = { userLetter, groups[12] }`. `createWorldCup` cria o grupo do user (substitui o time mais fraco pelo XI) + 11 grupos CPU. `playCpuRound` simula a rodada N nos 11 grupos CPU em lockstep com o user (chama `playRound` no grupo do user separadamente pra preservar narração + difficulty). `standings` tiebreakers implementam FIFA 2026 Article 13: H2H pts → H2H GD → H2H GF → GD geral → GF geral → (skipped fair play) → `averageOverall` proxy FIFA. `computeQualifiers` aplica a regra Copa 2026: 12 1ºs + 12 2ºs + 8 melhores 3ºs = 32. `userFate` retorna o destino preciso do user (`qualified-1st`/`qualified-2nd`/`qualified-3rd-rank`/`eliminated-3rd-rank`/`eliminated-4th`).
- **`bracket.ts`** — `createBracket(worldCup)` consome os 32 qualifiers e seedeia por (groupPosition asc → pts → GD → GF → overall) num pareamento NCAA snake (`SEED_ORDER_32`). Setup chama `setupBracket(worldCup)` que monta + `ensureRoundsSimulated`. Quando o bracket é criado, `simulateOtherHalfToFinal` imediatamente simula o lado oposto até a final. `ensureRoundsSimulated` avança round-a-round conforme o user joga. Knockout vai jogo completo: ET (≈0.7 expected goals) → penalties (5 + morte súbita, prob por chute clamped 0.3–0.9 pelo overall).
- **`narrate.ts`** — per-minute event stream (goals/cards), weighted by player position; consumed by `routes/Match` for the live playback.
- **`persistence.ts`** — `localStorage` keys: `d26:draft`, `d26:worldcup`, `d26:bracket`, `d26:speed`. This is the source of truth for in-progress runs. The `Formation` object isn't serialized — only `formationName`, and `loadDraft` re-derives it.
- **`features.ts`** — `?dev=1` (or localStorage `d26:dev`) enables dev affordances like autofill (`autofill.ts`).
- **`supabase.ts` / `runs.ts`** — scaffolded but **not yet wired into the app flow**. Schema is in `supabase/migrations/0001_runs.sql` (table `runs` with RLS: owner sees all, public reads only `completed_at is not null`). Persistence still lives entirely in `localStorage`. Don't introduce Supabase writes unless explicitly asked.

### Data layer

The bundle inlines `data/squads-enriched.json` (~570 KB) via `src/data/squads.ts`. That JSON is committed and is the runtime source of squad/player data. Player records carry a granular `primaryPosition` (CB, LW, ST…) plus a coarse `position` bucket (GK/DEF/MID/FWD) — slot compatibility uses `primaryPosition`; narration uses the bucket.

Two-source rating system: ~71% of players match EA FC 26 (`ratingSource: 'fifa'`); the rest fall back to a heuristic by club tier + caps + age (`ratingSource: 'heuristic'`, marked with ✦ in UI). Match disambiguation scores candidates by `(positional bucket, club, age)` — this fixed the bug where GK Alisson Becker was being matched to a RW namesake at Shakhtar. Don't simplify the matcher back to name-only.

Raw CSVs (`eafc26-players.csv`, `transfermarkt-players.csv`) are gitignored — `pnpm data:rebuild` re-downloads them.

### Styling

Two coexisting design systems in `src/index.css`:
- **Light "paper/ink" theme** (the default) — Tailwind v4 `@theme` tokens like `paper`, `ink`, `ink-soft`, `clay`, `sand`, `moss`, `rule`. Used by `/teams`, `/draft`, `/groups`, `/bracket`, `/match`.
- **Dark "Draft 26" theme** — tokens prefixed `--color-d-*` plus `.d26-*` utility classes; scoped via the `.d26-scope` wrapper on `routes/Home`.

Inline-style-driven responsive overrides for the Draft screen live as `.az-*` classes with `!important` — they exist to defeat inline styles set by the component. Don't refactor away unless you're also removing the inline styles.

### Deployment

Cloudflare Pages, static only. Build `pnpm build`, output `dist/`, SPA fallback in `public/_redirects`. Env vars at build time: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the anon key is public by design — RLS protects the data, not the key).

## Conventions specific to this repo

- Prefer pt-BR for new comments and user-facing strings; the codebase is consistently Portuguese.
- Treat `localStorage` as authoritative for in-flight runs. Don't shim Supabase writes into the gameplay loop without explicit ask.
- Keep the country-cooldown / 1:1 position-match invariants intact — they're the load-bearing constraints of the draft loop.
- `averageOverall` is the canonical strength signal across simulation, seeding, and tiebreakers. If you change how it's computed, expect ripple effects in `groups.ts`, `bracket.ts`, and `simulate.ts`.
- The bundle is ~795 KB JS / 158 KB gzip; the obvious next optimization (code-splitting the squads JSON to `/data/squads.json` fetched async) is on the roadmap but **not done** — don't add unrelated code-splitting without checking with the user.
