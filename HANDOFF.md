# Handoff — Torneio de Verano '26

## O que é
Simulador single-player da Copa do Mundo 2026. Sorteia seleções → monta XI → joga grupos → bate chaveamento. Alternativa ao 7a0.com.br / 38a0.com, focada em UX limpa (Claude design) e dados oficiais.

Repo: `github.com:p-devlabs/draft-26`

## Estado atual (2026-06-11)
Tudo funciona em localhost + localStorage. Acabou de subir o initial commit pro GitHub. Sem deploy ainda, sem backend ainda.

Fluxo coberto end-to-end:
- Home (landing nova) → `/selecoes` (48 times + detalhe)
- `/draft` (formation/style/difficulty → sorteio com cooldown 5, skips por dificuldade, autofill via `?dev=1`)
- `/copa` (3 rodadas de grupo, simula matches paralelos, tiebreakers FIFA 2026 Article 13)
- `/copa/partida` (live com speed control lento/normal/rápido, narração de eventos, ET+pênaltis no mata-mata)
- `/mata-mata` (bracket de 32 NCAA-snake, renderiza só metade do user + final, drawers de eliminação e campeão)

## Stack
- **Build**: Vite 6 + React 19 + TS + Tailwind v4 (`@theme` tokens: paper/ink/clay/sand/moss/rule)
- **Routing**: React Router 7
- **Package manager**: pnpm 11 (precisa `allowBuilds: { esbuild: true }` no `pnpm-workspace.yaml`)
- **Tipografia**: Source Serif (display) + system stack
- **Persistência**: localStorage, chaves `tv26:draft`, `tv26:stage`, `tv26:bracket`

## Pipeline de dados
1. `pnpm scrape:squads` → Wikipedia "2026 FIFA World Cup squads" via cheerio → `data/squads.json`
2. `pnpm enrich:squads` → ISO, flag, formação heurística, overall por tier de clube → `data/squads-enriched.json`
3. `pnpm download:fifa` → EA FC 26 CSV (10MB, gitignored)
4. `pnpm enrich:fifa` → cruza com squads, desambigua por **bucket position + club + age** (Alisson Becker bug resolvido), separa `primaryPosition` + `altPositions[]`
5. `pnpm download:transfermarkt` → ZIP do dcaribou/transfermarkt-datasets, extrai players.csv (4MB, gitignored)
6. `pnpm enrich:transfermarkt` → cross-reference de valor (`value_eur_tm`), não sobrescreve EA FC
7. `pnpm data:rebuild` → faz tudo em sequência

Resultado final: `data/squads-enriched.json` (~570KB, **commitado**, inline no bundle hoje).

## Arquitetura
```
src/
├── lib/
│   ├── draft.ts          DraftState, rollUntilCompatible, useSkip, pickPlayer
│   ├── formations.ts     4-3-3, 4-2-3-1, 4-4-2, 3-4-3 + DIFFICULTIES (skip count)
│   ├── positions.ts      COMPAT (LB/RB↔CB, meias centrais fluidos, pontas/meias laterais)
│   ├── autofill.ts       greedy scoring por slot (feature flag)
│   ├── features.ts       ?dev=1 + localStorage
│   ├── simulate.ts       Poisson, Mulberry32, HOME_ADVANTAGE
│   ├── narrate.ts        eventos por minuto (gol/cartão), pesos por posição
│   ├── groups.ts         createGroupStage, playRound, miniTable (head-to-head)
│   ├── bracket.ts        SEED_ORDER_32 NCAA snake, setupBracket, userPath, ET+pênaltis
│   ├── persistence.ts    load/save/clear pra cada estado
│   └── rosters.ts        rosterForKnockout (compartilhado)
├── components/
│   ├── Drawer.tsx        bottom-up custom (sem libs)
│   ├── Field.tsx         SVG com 11 slots
│   ├── PickDrawer/SetupDrawer
│   ├── MatchCard, StandingsTable
│   ├── EliminationDrawer (grupos)
│   ├── BracketView (filtra userHalf + Final)
│   └── KnockoutEliminationDrawer, ChampionDrawer
└── routes/
    ├── Home.tsx          landing (Hero, FlagsTicker, HowItWorks, DataIntegrity, Journey, ClosingCTA, Credits)
    ├── Selecoes, SelecaoDetalhe
    ├── Draft, DraftSummary
    ├── Copa, Match (group | knockout via ?kind=)
    └── MataMata
```

## Decisões importantes
- **Posição primária + alternativas**: Alisson aparecia como zagueiro no enrich primeiro. Fix: score-based disambiguation (+50 bucket match, +30 club, +10 age ±1, -30 bucket diverge).
- **Tiebreakers FIFA 2026**: head-to-head **primeiro** (mudou no ciclo 2026), depois stats agregados.
- **Renderização do bracket**: simula upfront todo o lado oposto até a final pra mostrar só a metade do user + jogo final.
- **Pênaltis**: 5 rounds + sudden death, scored weighted por overall (clamp 0.3-0.9), sequência visualizada.
- **Country cooldown**: 5 picks (seleção sorteada não volta nos 5 próximos sorteios).
- **Difficulty**: easy=5 skips, medium=3, hard=1.
- **Anon key Supabase é pública por design** (vai pro bundle via `VITE_*`). RLS protege os dados, não a key.

## `.env.local` (gitignored)
```
VITE_SUPABASE_URL=https://pcclczydsjfspffuylmc.supabase.co
VITE_SUPABASE_ANON_KEY=<jwt>
```

## Próximos passos (CF + Supabase staged)
1. **CF Pages deploy estático** — sem backend ainda. Resolver o bundle de 795KB primeiro (code-split do `squads-enriched.json` em fetch async pra `/data/squads.json`). Wrangler config + GitHub Actions workflow.
2. **Supabase schema mínimo** — tabela `runs` (id, user_id, draft_json, stage_json, bracket_json, created_at, completed_at, champion_code). Anon auth (sem email). localStorage continua sendo fonte primária, Supabase espelha.
3. **Leaderboard** — primeira feature que justifica ter servidor. Ranking de XIs por rating + jogos vencidos.

## Gotchas conhecidos
- Bundle: **795KB JS / 158KB gzip** (CSS 34KB com keyframe do ticker). Code-split do JSON é a primeira otimização óbvia.
- `FooterMini` usa `window.location.pathname` direto (não é SSR-safe, mas não usamos SSR).
- Datasets crus (`eafc26-players.csv`, `transfermarkt-players.csv`) são gitignored — `pnpm data:rebuild` baixa de novo.
- `pnpm install` em CI vai precisar do `allowBuilds: esbuild` ou o bundler quebra.

## Comandos diários
```
pnpm dev              # localhost:5173
pnpm build            # produção
pnpm data:rebuild     # pipeline inteiro (precisa de rede)
```

## Pendências implícitas
- Conectar Supabase
- Code-split do JSON de squads
- Calibrar simulação (AVG_GOALS_PER_MATCH=2.6 hoje, dá pra refinar)
- Auth (anon basta pra leaderboard, login com OAuth fica pra v2)
