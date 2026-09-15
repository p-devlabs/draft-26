# Operação — Draft 26

O README do repositório é a vitrine. Aqui fica ambiente, dados e deploy.

## Variáveis de ambiente

Copie `.env.example` para `.env.local`. Tudo `VITE_*` entra no bundle.

| Variável                 | Obrigatória | Uso                                                           |
| ------------------------ | ----------- | ------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Não         | Espelho da campanha + analytics. Sem ela o jogo é 100% local. |
| `VITE_SUPABASE_ANON_KEY` | Não         | Anon key — pública por design. RLS protege os dados.          |
| `VITE_SENTRY_DSN`        | Não         | Erros no client. Vazio = sem Sentry.                          |
| `VITE_CF_BEACON_TOKEN`   | Não         | Cloudflare Web Analytics. Vazio = sem beacon.                 |
| `SENTRY_AUTH_TOKEN`      | Não (CI)    | Upload de sourcemap. Org/projeto estão em `vite.config.ts`.   |

Não coloque `service_role` nem token de CLI no frontend.

## Supabase

Schema em `supabase/migrations/`. Local:

```bash
supabase start
supabase db reset
```

Ou rode o SQL no editor do projeto remoto.

## Deploy (Cloudflare Pages)

- Build: `pnpm build`
- Output: `dist`
- SPA: `public/_redirects`
- Headers (HSTS, CSP, XFO): `public/_headers`

Produção: [draft-26.pages.dev](https://draft-26.pages.dev)

## Pipeline de dados

`data/` mistura curadoria e arquivos gerados:

| Arquivo                     | Origem                           | No git?       |
| --------------------------- | -------------------------------- | ------------- |
| `country-codes.json`        | curado                           | sim           |
| `tactics.json`              | curado                           | sim           |
| `position-overrides.json`   | overlay de posições              | sim           |
| `sim-params.json`           | `pnpm calibrate:sim`             | sim           |
| `squads.json`               | `pnpm scrape:squads` (Wikipedia) | sim           |
| `squads-enriched.json`      | pipeline de enrich               | sim (runtime) |
| `eafc26-players.csv`        | `pnpm download:fifa`             | não (~10 MB)  |
| `transfermarkt-players.csv` | `pnpm download:transfermarkt`    | não           |
| `fbref-players.csv`         | Kaggle, manual                   | não           |

Rebuild completo:

```bash
pnpm data:rebuild
```

Ordem: `scrape:squads → enrich:squads → download:fifa → enrich:fifa → download:transfermarkt → enrich:transfermarkt → enrich:alt-positions → recalibrate:heuristic → download:fbref → enrich:fbref → calibrate:fbref → download:matches → calibrate:sim`.

EA FC 26 cobre ~73% dos convocados. Transfermarkt entra ~8% (por valor de mercado, sem sobrescrever overall/posição da EA). FBref cobre a cauda (~2%). A heurística de clube pega o resto (~17%), em geral ligas domésticas.

Ratings e dificuldade: [`ratings-and-difficulty.md`](./ratings-and-difficulty.md).
