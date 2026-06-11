# Torneio de Verano 2026

Simulador da Copa do Mundo 2026 no navegador. Você sorteia uma das 48 seleções,
monta seu XI titular entre os 26 convocados oficiais e simula o torneio inteiro
— da fase de grupos à final no MetLife.

Inspirado em [7a0](https://7a0.com.br/) e [38a0](https://38a0.com/), mas focado
**só** na Copa 2026 e com obsessão por UI/UX.

## Stack

- **Vite + React 19 + TypeScript** — SPA, build rápida, types em tudo
- **Tailwind v4** — design system inline no CSS
- **Supabase** — Postgres + Auth + (no futuro) Realtime para multiplayer
- **Cloudflare Pages** — deploy estático na edge

## Rodar local

```bash
pnpm install
cp .env.example .env       # preencha com URL + anon key do Supabase
pnpm dev
```

Build de produção:

```bash
pnpm build
pnpm preview
```

## Supabase

Schema em `supabase/migrations/0001_init.sql`. Para inicializar o banco
localmente (precisa do [Supabase CLI](https://supabase.com/docs/guides/cli)):

```bash
supabase start
supabase db reset            # aplica migrations + seed
```

Ou rode a SQL direto no editor do dashboard se estiver usando projeto remoto.

## Deploy (Cloudflare Pages)

1. Conecte o repo no painel do Cloudflare Pages
2. Build command: `pnpm build`
3. Output directory: `dist`
4. Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

O `public/_redirects` já trata SPA fallback.

## Decisões de arquitetura

- **Single-player primeiro**: zero estado compartilhado, zero realtime. Prova
  o core loop antes de complicar com salas multiplayer.
- **Overall = valor de mercado (Transfermarkt)** normalizado 40–99. Critério
  único, atualizável, sem licenciamento de marcas tipo FIFA.
- **Cloudflare = só hosting estático**: a fonte de verdade é o Supabase. Sem
  Workers customizados pra reduzir superfície de complexidade.
- **Roteamento client-side** com `react-router-dom` v7. Sem SSR — o conteúdo
  é interativo e personalizado por usuário, não vale a pena pré-renderizar.

## Pipeline de dados

A pasta `data/` mistura curadoria manual e arquivos gerados:

| Arquivo                     | Origem                          | No git?       |
|-----------------------------|---------------------------------|---------------|
| `country-codes.json`        | curadoria manual                | ✅            |
| `tactics.json`              | curadoria manual                | ✅            |
| `squads.json`               | `pnpm scrape:squads` (Wikipedia)| ✅ (referência) |
| `squads-enriched.json`      | `pnpm enrich:squads` + `enrich:fifa` | ✅ (consumido pelo app) |
| `eafc26-players.csv`        | `pnpm download:fifa` (10 MB)    | ❌ (gitignored)|

Pra reconstruir tudo do zero:

```bash
pnpm data:rebuild
```

(equivale a `scrape:squads → enrich:squads → download:fifa → enrich:fifa`)

Match com EA FC 26 pega ~71% dos convocados; o resto (Irã, Jordânia, Uzbequistão
e outros mal cobertos pelo EA) cai numa heurística por tier do clube + caps + idade.

## Próximos passos

- [ ] Tela de draft (drawer com tática/estilo, depois sorteio por posição)
- [ ] Motor de simulação (probabilidade ponderada por overall)
- [ ] Tela de torneio com tabela dos grupos + chaveamento
- [ ] Subir os dados pro Supabase (hoje JSON inline no bundle, 594 KB)
