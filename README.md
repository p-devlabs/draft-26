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

## Próximos passos

- [ ] Importar as 48 convocações oficiais (`scripts/import-squads.ts`)
- [ ] Tela de draft de seleção (sorteio com animação)
- [ ] Editor de XI com formação configurável
- [ ] Motor de simulação (probabilidade ponderada por overall + fator casa)
- [ ] Tela de torneio com tabela dos grupos + chaveamento
