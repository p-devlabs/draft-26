# Ratings and Difficulty — Calibration Decisions

Reference for how player overall ratings get calibrated and how
"difficulty" is layered on top of the pure Dixon-Coles simulation. All
decisions documented here were made on 2026-06-17.

## Player rating recalibration (`elite-2026`)

### Context

The base ratings come from a multi-source pipeline (EA FC 26 → FBref
regression → Transfermarkt heuristic → club-tier fallback). The raw
distribution included a long tail of sub-65 overalls (18% of all
players) that made rolling weaker countries feel unrewarding in the
draft — the whole Copa is supposed to be the SOTA of world football,
so a 26-player squad sitting at 62-68 broke immersion.

The recalibration lifts every player up a curve that's steepest for
the weak tail and gentle for the elite, then enforces an icon overlay
for the absolute legends.

### Function

Pure piecewise-linear, monotonic, idempotent (uses
`originalOverall` as the base on re-runs):

| original |       new | delta |
| -------: | --------: | ----: |
|     ≤ 60 |        71 | floor |
|       65 |        74 |    +9 |
|       70 |        76 |    +6 |
|       75 |        79 |    +4 |
|       80 |        82 |    +2 |
|       85 |        87 |    +2 |
|       90 |        92 |    +2 |
|     ≥ 91 | unchanged |     0 |

Interpolates linearly between breakpoints.

Code: `scripts/recalibrate-elite.ts` — function `rebumpOverall`.
Run: `pnpm recalibrate:elite`.

### Star overlay

A curated set of icons gets a minimum rating that overrides the
piecewise function. The overlay lives in `data/star-overrides.json`
and applies AFTER the function (takes the max of the two values).

Current tiers (8 names total — keep the list tight; the natural bump
already lifts the rest of the elite to 91-93):

| Rating | Players                           | Reason                                   |
| -----: | --------------------------------- | ---------------------------------------- |
|     95 | Messi, Mbappé, Haaland            | global icons                             |
|     94 | Cristiano Ronaldo, Dembélé, Rodri | legends + recent Ballon d'Or             |
|     93 | Vinícius Júnior, Salah            | tier-S talent the bump alone undershoots |

Edit the JSON and re-run `pnpm recalibrate:elite` to apply changes.

### Audit fields

Every recalibrated player record carries:

- `originalOverall` — the value before the function was applied (only
  set once; subsequent recalibrations read from this, so the math
  doesn't compound).
- `calibration` — string tag (`'elite-2026'`).

`Squad.averageOverall` is recomputed from the new player ratings.

### Distribution effect (before / after)

48 squads, 1247 players total:

|  Band | Before | After |
| ----: | -----: | ----: |
|  < 65 |  18.4% |    0% |
| 65–69 |  15.2% |    0% |
| 70–74 |  22.5% | 22.4% |
| 75–79 |  24.1% | 38.7% |
| 80–84 |  14.0% | 29.3% |
| 85–89 |   5.2% |  7.5% |
|   90+ |   0.6% |  2.2% |

Mean overall moved from 72.7 → 78.2; the floor went from 52 → 71. The
piecewise design avoids clusters (an earlier `[40, 70] → [71, 74]`
remap collapsed 56% of players into a single band).

### Simulation effect

Across 100 sim-distortions runs (XI auto-filled, default difficulty):

|             Metric | Before | After |
| -----------------: | -----: | ----: |
|    XI mean overall |   72.9 |  78.3 |
| Qualification rate |    64% |   60% |
|  Round-of-16 reach |    15% |   19% |
|     Quarter-finals |     8% |   10% |
|        Semi-finals |     4% |    5% |
|           Champion |     0% |    0% |

Note the slight drop in qualification: the bump is monotonic across
all teams, so weak opponents get bigger relative lifts than the user's
XI — the strong/weak gap compresses and group-stage upsets become
slightly more frequent. Mid-to-late knockout progression rises a
notch because the XI is closer to true elite. Net difficulty: roughly
neutral, with a different texture.

## Difficulty model

### Split of responsibilities

- **`Difficulty` (easy / medium / hard)** — declared at draft time.
  Today this **only** controls `DIFFICULTY_SKIPS` (5 / 3 / 1) — how
  many times the user can re-roll a slot during the draft. **It does
  not affect simulation outcomes.** The rubber-band code in
  `simulate.ts` still reads `difficulty` for the regression tests in
  `simulate.stats.test.ts`, but production code paths
  (`groups.ts:playRound` and `routes/Match.tsx`) no longer pass it.

- **`matchPressure`** — per-match additive multiplier in [0, ~0.10]
  computed from phase + opponent tier. Damps the user's effective
  overall before Dixon-Coles. Composes additively with `userBoost`.

- **`userBoost`** — per-XI additive multiplier in [0, ~0.07] computed
  from player synergy (star tiers in the drafted XI). Lifts the user's
  effective overall. Net signal applied is
  `overall × (1 − matchPressure + userBoost)`.

Code: `src/lib/match-pressure.ts`.

### Phase modifier

Captures torneo pacing — group stage breezy, knockout crescendo, with
estreia-jitters as a one-off bump:

| Phase                  | Modifier |
| ---------------------- | -------: |
| group jogo 1 (estreia) |      +3% |
| group jogos 2 & 3      |       0% |
| 16-avos (R32)          |      +1% |
| 8as (R16)              |      +2% |
| QF                     |      +3% |
| SF                     |      +4% |
| F                      |      +5% |

### Opponent tier modifier

Curated by name — blends historical aura (Copas won, World Cup
appearances) with current relevance. Refine via FIFA ranking if it
ever becomes relevant.

| Tier                   | Modifier | Teams                        |
| ---------------------- | -------: | ---------------------------- |
| S — clássicos mundiais |      +3% | BRA, ARG, GER, FRA, ESP      |
| A — programa forte     |      +2% | ENG, NED, POR, URU, BEL      |
| B — sólidos modernos   |      +1% | CRO, COL, MEX, USA, MAR, JPN |
| C — demais (32 teams)  |       0% | everyone else                |

### Player synergy (`userBoost`)

Reciprocal mechanism that rewards drafting elite players: stars in the
user's XI lift the team's effective overall. Mirrors `matchPressure`
in sign — pressure damps, synergy lifts, both additive on a single
`(1 − pressure + boost)` multiplier inside `simulate.ts:rates`.

#### Player tiers

| Tier            | Bonus | Players                                                                                                                                   |
| --------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (icon)        |   +4% | Messi, Mbappé, Haaland, Cristiano Ronaldo (curated by name)                                                                               |
| 2 (elite)       |   +3% | calibrated overall 91–94 (Kane, Bellingham, VVD, Dembélé, Rodri, Vini, Salah, Yamal, Pedri, Vitinha, Wirtz, Hakimi, Valverde, Alisson, …) |
| 3 (strong star) |   +1% | calibrated overall 88–90 (Saka, Isak, Musiala, De Bruyne, Lautaro, Raphinha, McTominay, Caicedo, …)                                       |

GKs count. Anyone outside the tiers contributes 0.

A safety clause also catches uncurated overall-95+ players as tier 1,
in case the icon overlay (`star-overrides.json`) is expanded later.

#### Stacking

Partial — top 3 stars in the XI, ordered by **tier (1 first) → overall
desc → name asc**, contribute their tier bonus weighted by:

```
1.0  ·  0.5  ·  0.25
```

Anything past the top 3 is ignored.

Worked examples:

| XI configuration               | Stars taken                       |        Boost |
| ------------------------------ | --------------------------------- | -----------: |
| Messi alone                    | Messi (T1, 4%·1.0)                |       +4.00% |
| Kane alone                     | Kane (T2, 3%·1.0)                 |       +3.00% |
| Messi + Kane                   | Messi (4%·1.0) + Kane (3%·0.5)    |       +5.50% |
| Messi + Kane + Valverde        | Messi + Kane + Valverde (3%·0.25) |       +6.25% |
| Messi + Mbappé + Haaland + CR7 | three T1 stacked, CR7 ignored     | +7.00% (max) |
| No stars (overall < 88)        | —                                 |           0% |

Net signal examples (synergy − pressure):

| Scenario                             | Pressure | Boost |       Net |
| ------------------------------------ | -------: | ----: | --------: |
| Messi-led XI vs Curaçao, group debut |      +3% |   +4% |   **+1%** |
| Kane-led XI vs Iraq, R32             |      +1% |   +3% |   **+2%** |
| Messi + Kane vs Brazil, semi         |      +7% | +5.5% | **−1.5%** |
| No stars vs France, final            |      +8% |     0 |   **−8%** |

#### Composition

`matchPressure(phase, opponent) = phaseModifier(phase) +
opponentModifier(opponent)`. Aditivo, sem cap explícito. Cenários
relevantes:

| Scenario                 | Pressure |
| ------------------------ | -------: |
| Estreia vs Curaçao       |      +3% |
| Estreia vs Brasil        |      +6% |
| 16-avos vs Iraq          |      +1% |
| Quarter-final vs Holanda |      +5% |
| Semi vs Argentina        |      +7% |
| Final vs França          |      +8% |

The natural maximum is around +8%; nothing in the codebase clamps it,
so introducing harder difficulty multipliers (e.g., hard mode → ×1.5
on pressure) remains an option for the future.

### Why pressure dampens the user (not boosts the opponent)

Two implementations would have similar end-game results:

- User × (1 − pressure) — chosen
- Opponent × (1 + pressure)

The user-damp variant maps cleanly to the narrative ("the moment
weighs on you") and keeps the opponent's strength signal stable for
downstream consumers (broadcast text, narrative chips, etc).

### Implementation map

| Path                              | What happens                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/match-pressure.ts`       | pure tables + `matchPressure()` + `playerSynergy()`                                                                                               |
| `src/lib/simulate.ts`             | `SimOptions.matchPressure` + `SimOptions.userBoost` applied in `rates()` after rubber-band, composed as `(1 − pressure + boost)`                  |
| `src/lib/groups.ts:playRound`     | derives phase = `group-debut` (round 1) or `group-other`, looks up opponent code, computes synergy once per round, passes both to `simulateMatch` |
| `src/routes/Match.tsx` (knockout) | derives phase from `match.round` (R32 / R16 / QF / SF / F), computes synergy from the drafted XI, passes both to `fullySimulate`                  |

CPU vs CPU matches don't receive pressure or boost because the
multiplier gate is `home.isUser || away.isUser` inside
`simulate.ts:rates()`.

## How to tune

- **Lift / lower a player without overlay**: edit
  `scripts/recalibrate-elite.ts` `BREAKPOINTS` and re-run. The
  function is idempotent — re-runs always read from `originalOverall`.
- **Promote a player to icon status**: append to
  `data/star-overrides.json` `stars` array and re-run.
- **Reshape phase pacing**: edit `PHASE_MODIFIER` in
  `src/lib/match-pressure.ts`.
- **Re-tier an opponent**: edit `TIER_BY_CODE` in
  `src/lib/match-pressure.ts`.
- **Add / remove an icon from synergy tier 1**: edit
  `SYNERGY_TIER1_NAMES` in `src/lib/match-pressure.ts`. Match by exact
  player name (the data uses canonical names like "Lionel Messi",
  "Kylian Mbappé").
- **Tweak synergy bonuses or stack weights**: edit
  `SYNERGY_TIER_BONUS` and `SYNERGY_STACK_WEIGHTS` in the same file.

After any of the above, run `pnpm test` (the unit tests on
`match-pressure` lock the exact values) and ideally
`pnpm sim:distortions` over 100+ runs to check the win-rate impact.
