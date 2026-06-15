# Launch promo copy — Week 1

Ready-to-paste promotional messages for the Week 1 launch window, with
per-message UTM tracking so we can attribute signups and run completions
back to the specific channel and copy variant.

Pairs with [docs/launch-plan.md](./launch-plan.md), which sets the broader
strategy.

## UTM scheme

All URLs embed the same UTM convention so analytics can break results
down by channel and copy variant:

- `utm_campaign=launch-w1` — fixed for the whole launch window, lets us
  isolate this week against future campaigns.
- `utm_source` — platform: `youtube` or `reddit`.
- `utm_medium` — format: `comment` or `post`.
- `utm_content` — unique slug per message variant. The Reddit slugs are
  prefixed with the subreddit (`rfutebol-*`, `rbrasil-*`, …) so we can
  group by sub without parsing.

UTM capture is already wired in `src/lib/session.ts` — the 5 standard
UTM params land on the `session_init` event automatically. No code
change required.

### Tracking dimensions we'll be able to slice on

- **YouTube vs Reddit**: `group by utm_source`
- **Subreddit performance**: filter `utm_source=reddit`, group by
  `utm_content` prefix
- **Copy variant**: group by full `utm_content`, cross with `cup_ended`
  for completion-rate per origin
- **Launch window**: filter `utm_campaign=launch-w1` to isolate W1 from
  later weeks

Note that `session_init` only fires **once per tab** (sessionStorage
flag in `src/lib/track.ts`), so a returning user keeps their first-touch
attribution. That's standard UTM behavior and what we want for first-touch
analysis.

---

## YouTube comments

Short, fan-tone messages designed to drop naturally on Brazilian football
livestreams and reaction videos (Cazé TV, Desimpedidos, Bola Pré,
Pilhado, etc). One message per channel, never repeat verbatim across
multiple channels on the same day.

All YouTube links: `utm_source=youtube&utm_medium=comment`.

### 1. Post-match reaction

> deu vontade de jogar Draft 26 depois dessa 😂 é tipo o 7a0/38a0 mas SÓ Copa 2026, com o elenco real dos 26 convocados. já viciei. → draft-26.pages.dev/?utm_source=youtube&utm_medium=comment&utm_campaign=launch-w1&utm_content=yt-postjogo

### 2. Absurd XI hook (Cape Verde)

> acabei de tirar Cabo Verde no Draft 26 e cheguei na final contra a Argentina kkkk. mesmo esquema do 7a0, mas só Copa 2026 e bem mais bonitinho. → draft-26.pages.dev/?utm_source=youtube&utm_medium=comment&utm_campaign=launch-w1&utm_content=yt-caboverde

### 3. Pre-match anticipation

> enquanto não começa, simula tua Copa em 5 min — Draft 26. tipo o 7a0 mas só com as 48 dessa Copa, ratings da EA FC 26. → draft-26.pages.dev/?utm_source=youtube&utm_medium=comment&utm_campaign=launch-w1&utm_content=yt-prejogo

### 4. Direct recommendation to 7a0 fans

> pessoal que curte 7a0/38a0: lançou o Draft 26, mesma pegada mas focado 100% na Copa 2026 — roster oficial, UI muito mais limpa. ta viciante demais. → draft-26.pages.dev/?utm_source=youtube&utm_medium=comment&utm_campaign=launch-w1&utm_content=yt-rec7a0

### 5. Underdog hook (Uzbekistan)

> sorteei Uzbequistão e fui pras oitavas, ganhei do Brasil nos pênaltis. Draft 26, é o "7a0 da Copa 2026". gratis e roda no celular. → draft-26.pages.dev/?utm_source=youtube&utm_medium=comment&utm_campaign=launch-w1&utm_content=yt-uzbequistao

---

## Reddit posts

Full-length posts tuned per subreddit. Each link is wrapped in markdown
syntax — Reddit hides the UTM tail and only the clean domain shows in
the rendered post.

All Reddit links: `utm_source=reddit&utm_medium=post`.

### 6. r/futebol — flair OC

**Title:** Fiz uma versão do 7a0 focada só na Copa 2026 — Draft 26

> Galera, sou fã de 7a0/38a0 há tempos e sempre achei que faltava uma versão focada na Copa do Mundo com o elenco oficial dos 26 convocados de cada seleção. Acabei fazendo — chama **Draft 26**.
>
> Como funciona: sorteia um país aleatório por posição (igual o "rola o dado"), você escolhe um jogador da lista oficial, repete pelas 11 posições. Depois joga a fase de grupos + mata-mata contra as outras 47 seleções.
>
> O que mudou em relação ao 7a0:
> - elenco real (scrape da Wikipedia dos 26 convocados de cada seleção)
> - rating vem da EA FC 26 nos jogadores que a EA cobre (~73%), com Transfermarkt e FBref pra preencher o resto
> - regras de desempate da FIFA 2026 implementadas (head-to-head primeiro, mudou pra esse ciclo)
> - mata-mata simula o lado oposto da chave automaticamente pra deixar o foco no SEU caminho
> - UI bem mais polida, animação de slot machine no sorteio
>
> [draft-26.pages.dev](https://draft-26.pages.dev/?utm_source=reddit&utm_medium=post&utm_campaign=launch-w1&utm_content=rfutebol-oc) — gratuito, sem login, roda no celular.
>
> Projeto solo, feedback é muito bem-vindo.

### 7. r/brasil — flair Tecnologia

**Title:** [OC] Fiz um simulador single-player da Copa 2026 com React 19 + ratings da EA FC 26

> Inspirado nos clássicos 7a0.com.br e 38a0.com, mas com escopo 100% na Copa 2026:
>
> - 48 seleções, com os 26 convocados reais (scrape da Wikipedia)
> - overall vem da EA FC 26 (~73%), com fallback em Transfermarkt + regressão OLS sobre stats per-90 do FBref pros que a EA não cobriu (~2%, tipo o Rayan e o Jeremy Arévalo)
> - engine de partida: correção Dixon-Coles sobre Poisson, vantagem de mando + rubber-band por dificuldade
> - desempate FIFA 2026 (head-to-head primeiro, mudou pra esse ciclo)
> - mata-mata 32-times com seeding NCAA snake, ET + pênaltis (probabilidade por chute clamped por overall)
>
> Stack: Vite 6 + React 19 + TS + Tailwind v4 + Supabase como mirror opcional. Bundle inicial ~144 KB gzip.
>
> [draft-26.pages.dev](https://draft-26.pages.dev/?utm_source=reddit&utm_medium=post&utm_campaign=launch-w1&utm_content=rbrasil-tech) — sem login, sem ads.
>
> Se alguém tiver curiosidade na parte de pipeline de dados (scrape → enriquecimento multi-fonte → desambiguação por bucket+clube+idade → calibração da simulação) conto mais nos comentários, é a parte que mais me deu trabalho.

### 8. r/SoccerGaming — en-US

**Title:** I built a single-player 2026 World Cup simulator inspired by 7a0/38a0 — real squads, EA FC 26 ratings, Dixon-Coles match engine

> Big fan of the Brazilian sites 7a0 and 38a0 (you roll a random country per position, pick a player from their roster, then play a whole season/cup with that XI). Always wanted a version locked to a specific tournament with the real call-up data.
>
> So I built **Draft 26**, narrow scope — just the 2026 World Cup.
>
> - All 48 nations with the real 26-player squad lists
> - Overall: EA FC 26 covers ~73% of called-up players. Fallback chain: Transfermarkt market value (~8%) → per-90 OLS regression trained on FBref Top 5 leagues data (~2%) → club-tier heuristic for the long tail (~17%, mostly Iran/Uzbekistan/Saudi domestic leagues)
> - Player disambiguation scored by (positional bucket + club + age) so e.g. Alisson Becker the Liverpool GK doesn't get confused with the Shakhtar RW of the same name
> - Match engine: Dixon-Coles correction over weighted Poisson, home advantage, rubber-band by difficulty
> - FIFA 2026 tiebreakers (H2H first — this changed for this cycle)
> - 32-team knockout, NCAA snake seeding, full ET + 5-round penalties + sudden death
>
> [draft-26.pages.dev](https://draft-26.pages.dev/?utm_source=reddit&utm_medium=post&utm_campaign=launch-w1&utm_content=rsoccergaming-en) — runs in the browser, free, no login.
>
> Happy to answer questions about the data sourcing or the calibration model.

### 9. r/futebol — absurd campaign variant

**Title:** Tirei Cabo Verde no Draft 26 e cheguei à final contra a Argentina

> Achei um simulador novo da Copa 2026 (Draft 26) e tô viciado. Mesma ideia do 7a0/38a0 mas com elenco oficial dos 26 convocados de cada seleção.
>
> A campanha que me fez postar: sorteei Cabo Verde como seleção principal. Olhei o elenco (Bebé, Stopira, Ryan Mendes), montei um 4-3-3 com o que tinha, classifiquei em 2º no grupo, ganhei na prorrogação das oitavas, parei na Argentina na final. Perdi nos pênaltis 4-2 mas a campanha foi insana.
>
> A vibe é a do 7a0, mas mais polida — animação de slot machine no sorteio, narração jogo a jogo, UI bem clean. E é exclusivamente Copa 2026.
>
> [draft-26.pages.dev](https://draft-26.pages.dev/?utm_source=reddit&utm_medium=post&utm_campaign=launch-w1&utm_content=rfutebol-caboverde) — sem login, roda no celular.
>
> Qual o time mais aleatório que vocês conseguiram levar longe? Posta o print aí.

### 10. r/desimpedidos — successor-to-7a0 framing

**Title:** Lançou o sucessor do 7a0 focado na Copa 2026 (Draft 26)

> Pra quem viciou em 7a0 e 38a0 ano passado: lançou um chamado **Draft 26**, mesmo conceito (sorteia país por posição, monta XI, joga o torneio) mas com escopo 100% Copa 2026.
>
> O que ganha em relação aos antecessores:
> - elenco oficial dos 26 convocados de cada seleção
> - ratings reais (EA FC 26, com fallback de Transfermarkt + FBref)
> - regras FIFA 2026 (desempate começa por confronto direto)
> - 3 dificuldades, 4 formações, narração minuto a minuto
> - chave de mata-mata renderizada de um jeito que dá pra ver claramente o seu caminho
>
> [draft-26.pages.dev](https://draft-26.pages.dev/?utm_source=reddit&utm_medium=post&utm_campaign=launch-w1&utm_content=rdesimpedidos-7a0) — gratuito, sem cadastro, mobile-friendly.
>
> Quem testar, posta a campanha mais absurda nos comentários — quero ver até onde a galera conseguiu levar país zebra.

---

## Quick reference — URL slugs

| # | Channel | utm_content |
|---|---------|-------------|
| 1 | YouTube — post-match reaction | `yt-postjogo` |
| 2 | YouTube — absurd XI (Cape Verde) | `yt-caboverde` |
| 3 | YouTube — pre-match | `yt-prejogo` |
| 4 | YouTube — 7a0 recommendation | `yt-rec7a0` |
| 5 | YouTube — underdog (Uzbekistan) | `yt-uzbequistao` |
| 6 | r/futebol — OC | `rfutebol-oc` |
| 7 | r/brasil — Tecnologia flair | `rbrasil-tech` |
| 8 | r/SoccerGaming — en-US | `rsoccergaming-en` |
| 9 | r/futebol — campaign variant | `rfutebol-caboverde` |
| 10 | r/desimpedidos — 7a0 successor | `rdesimpedidos-7a0` |

## Usage notes

- **YouTube cosmetics.** The raw URL with 4 UTM params is ~100 chars and
  looks busy in a comment. It still works fine, but if a channel filters
  long links or it visually hurts engagement, shorten via bit.ly /
  short.io per variant — the redirect preserves the params end-to-end.
- **Reddit markdown** hides the UTM tail. Use `[text](url)` syntax
  everywhere; only the clean domain shows in the rendered post.
- **One message per channel** on YouTube. Don't paste the same comment
  on three lives the same day — drops engagement and flags spam.
- **Subreddit rules.** r/futebol can require accounts >90 days old.
  r/brasil is more lenient with the Tecnologia flair. r/SoccerGaming is
  the most permissive for OC and a good place to start the international
  flank. Engage 3-4 days before posting to build karma — see
  [launch-plan.md](./launch-plan.md) for the full posting protocol.
- **Don't repeat the absurd XI hook** across both r/futebol posts
  (variants 6 and 9) — pick one. Variant 9 is stronger if Cape Verde
  actually shows up in your campaign that week; otherwise use 6.

## Review checkpoint

On **Sun Jun 21** (Week 1 retro), pull the breakdown from Supabase and
decide which variants to rerun in Week 2:

```sql
-- session_init rows tagged by UTM, grouped by content slug
select
  utm_content,
  count(*) as sessions,
  count(*) filter (where run_completed) as completions
from runs
where utm_campaign = 'launch-w1'
group by utm_content
order by sessions desc;
```

Kill underperformers, double down on the top 2-3.
