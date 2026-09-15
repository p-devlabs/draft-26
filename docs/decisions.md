# Decisions

Only the calls that had a real alternative. Dated when we locked them.

## 1. Local-first, remote is a mirror — 2026-06

**Context.** A World Cup simulator has to work on a phone in a bar, mid-match, on bad Wi-Fi.

**Options.** (a) Supabase as source of truth for every click. (b) `localStorage` as source of truth; remote upserts are fire-and-forget.

**Choice.** (b). `src/lib/persistence.ts` owns the campaign. `src/lib/runs.ts` never blocks the loop; if `VITE_SUPABASE_*` is missing, every call is a no-op.

**Consequences.** Offline play is the default. Cross-device resume is a later problem, not a launch blocker. Schema on the server can lag the client as long as RLS stays tight.

## 2. Dixon–Coles, not “roll 2d6” — 2026-06

**Context.** Random scores feel cheap after three matches. A full Monte Carlo of every remaining game is too slow for a 60 fps playback.

**Options.** (a) Uniform / weighted random goals. (b) Independent Poisson. (c) Poisson + Dixon–Coles τ on low-score cells, calibrated on real internationals.

**Choice.** (c). Engine in `src/lib/simulate.ts`, fit in `scripts/calibrate-sim.ts` (~5,800 matches since 2018). Difficulty is a rubber-band on the **user’s** overall only; CPU vs CPU stays on the calibrated model.

**Consequences.** Tests assert relative properties (harder → tighter band), not frozen scorelines. Recalibration does not mean rewriting the suite.

## 3. Squads as a fetched asset, not a bundle module — 2026-06

**Context.** `squads-enriched.json` is ~570 KB. Inlining it in JS taxes every visit, including people who bounce on the landing page.

**Options.** (a) `import data from './squads.json'`. (b) `fetch('/data/squads-enriched.json')` behind a boot gate.

**Choice.** (b). `SquadsGate` holds the tree until `loadSquads()` resolves. Mutable module bindings stay so 50+ call sites keep synchronous reads. Cache: JS/CSS hashed + `immutable`; `/data/*` `must-revalidate` so a ratings rebuild is a 304 almost always.

**Consequences.** First JS payload stays about the landing page. A data-only release does not bust the JS cache.

## 4. Share identity is not the auth uid — 2026-06

**Context.** Viral links (`?r=`, `/r/:id`) need attribution without putting a Supabase user id in a URL a friend will paste into WhatsApp.

**Options.** (a) `auth.uid()` in the query string. (b) Opaque `playerToken` in `localStorage`, first-touch capture, public RLS only on **completed** runs.

**Choice.** (b). `src/lib/session.ts` + `supabase/migrations/0004_attribution.sql`. Views (`v_acquisition`, referral edges) are read from the dashboard with `service_role`, not from the client.

**Consequences.** Anon key in the bundle is fine. Completed campaigns are readable; in-progress drafts are not. Acquisition is first-touch, never last-click.
