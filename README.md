# Draft 26

Jogo no dado da Copa do Mundo 2026. Sorteia uma das 48 seleções, monta o XI nos 26 convocados e simula o torneio inteiro — grupos, 16-avos, final.

**Demo:** [draft-26.pages.dev](https://draft-26.pages.dev)

Inspirado em [7a0](https://7a0.com.br/) e [38a0](https://38a0.com/), mas só Copa 2026, com UI própria e ratings cruzados em mais de uma fonte.

## O loop

1. **Draft** — formação, estilo e dificuldade; um dado por posição, com cooldown entre seleções.
2. **Grupos** — 3 rodadas, desempate FIFA 2026 (Artigo 13) e os 8 melhores terceiros.
3. **Partida** — playback minuto a minuto, prorrogação e pênaltis no mata-mata.
4. **Chave** — 32 times; a UI mostra a sua metade + a final.
5. **Share** — card de imagem da campanha e run endereçável em `/r/:id`.

Estado vive no `localStorage` e, se houver Supabase, espelha a campanha. Sem backend o jogo roda inteiro no cliente.

## Motor

Poisson + ajuste Dixon–Coles (1997), calibrado em ~5.800 jogos de seleção pós-2018. Overall vem de EA FC 26 (~73% dos convocados), Transfermarkt, FBref (OLS por bucket) e uma heurística de clube para o restante. Desambiguação por `(posição, clube, idade)` — sem isso o Alisson do Liverpool colidia com outro Alisson.

A suíte estatística roda ~3.000 sims com seed e afirma **resultados relativos** (ex.: dificuldade alta aperta mais o rubber-band), então o teste não quebra a cada recalibração.

## Stack

Vite 6 · React 19 · TypeScript · Tailwind v4 · React Router 7 · Jest · Playwright · Cloudflare Pages · Supabase (opcional) · Sentry (opcional)

## Desenvolvimento

```bash
pnpm install
cp .env.example .env.local   # Supabase / Sentry / beacon são opcionais
pnpm dev
```

```bash
pnpm check                   # format, lint, typecheck, testes, build
pnpm test:e2e                # Playwright
```

Inventário de telas e regras: [`FEATURES.md`](./FEATURES.md). Pipeline de dados, schema e deploy: [`docs/operations.md`](./docs/operations.md).
