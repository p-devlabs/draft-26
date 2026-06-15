# Plano de lançamento — Semana 1

Estratégia de virada de chave do Draft 26: sair do "tá no ar" pra "tem gente
jogando". Foco em distribuição orgânica casada com a Copa 2026 em fase de
grupos. Sem ads pagos nessa primeira semana — não vale o ruído com base zero.

**Janela:** seg 15/06 → dom 21/06 (referência inicial; replicável por semana
até a final em 19/07).

## TL;DR

- **Bloqueador real do share-loop:** OG image dinâmica no fim de campanha.
  Sem isso, o resto do plano fica capenga. ROI alto, esforço ~6h.
- **Cadência:** prepara D0, soft launch D1, picos casados com jogo do Brasil,
  retrô D6.
- **Canais:** X + IG + YouTube + TikTok, criados todos em D0 com handle único.
- **Distribuição:** comentários genuínos em lives BR > Reddit > X amplification
  > YouTube long-form.
- **Esforço estimado:** 25-35h de marketing na semana. Se sobrar metade, corta
  YouTube longo primeiro (D4) — esforço alto, retorno duvidoso em base zero.

## Premissas

- Produto está estável e os caminhos críticos têm telemetria (`view_page`,
  `country_rolled`, `player_picked`, `team_detail_viewed`, `match_completed`
  etc — ver `src/lib/track.ts`).
- Audiência-alvo é Brasil, pt-BR, mas com flanco aberto pro mercado FIFA
  gamer internacional (r/SoccerGaming).
- Performance pós-otimizações de junho/26: bundle inicial em 144 KB gzip,
  carrega rápido até em mobile fraco — pré-requisito pra share via mobile.
- Calendário da Copa: assumir 1-2 jogos do Brasil na semana sem assumir o
  dia exato — ajustar D3 conforme o fixture real.

## D0 — Hoje (Seg 15/06) · Setup

### Branding & contas (3-4h, faz tudo de uma vez)

- **Handle único** em todas: `@draft26` (ou `@usadraft26` se o curto estiver
  tomado). Cheque X / IG / TikTok / YT **antes** de fechar — handle
  consistente é não-negociável pra reconhecimento.
- **Bio única:** *"Role o dado. Faça o draft. Conquiste o mundo. — Simulador
  1P da Copa 2026"* + link `draft-26.pages.dev`.
- **Avatar:** logo monocromático sob fundo escuro (consistente com o tema
  `.d26-scope` da home).
- **Capa/banner:** screenshot do caça-níquel de países rolando.
- **X:** pin um post com vídeo de 15s (gravação do draft → primeiro jogo).
- **YouTube:** cria canal + 1 short de 30s só pra não ficar vazio.
- **TikTok:** cria mas não posta (entra D2-D3).

### Produto (paralelo, crítico)

- **Implementar OG image dinâmica** no fim de campanha. Opções:
  - Cloudflare Worker com Satori/`@vercel/og` (recomendado — edge, sem
    cold start)
  - Canvas no client + upload pra storage temporário (mais fácil, mais
    capenga)
- **Botão "Compartilhar"** na tela de resultado, pré-preenchendo:
  - X: texto + `#Draft26` + URL com `?campaign=<id>`
  - Cópia de link simples (Web Share API onde disponível)
- **Confirmar** que `share_clicked` está sendo trackeado no funil.

## D1 — Ter 16/06 · Soft launch

Sem promo pesada. Objetivo: criar conteúdo "evergreen" pra parecer que o
canal não nasceu ontem quando alguém abrir o perfil.

- **X:** thread "como nasceu o Draft 26" — referência ao 7a0/38a0, prints,
  1 GIF do draft. 4-5 tweets.
- **IG:** carrossel de 3 reels prontos: (a) tela inicial em loop, (b) draft
  de país aleatório, (c) campanha terminando.
- **YouTube:** 1 short de 60-90s "drafted XI de país aleatório vai dar bom?".
- **Reddit:** **não postar ainda.** Começar a comentar genuinamente em
  threads de r/futebol, r/brasil, r/desimpedidos. Constrói karma sem
  auto-promo.
- **Comentários em lives BR:** entra nas lives pós-jogo de Pilhado,
  Desimpedidos, Bola Pré comentando sobre o jogo de verdade. Sem mencionar
  produto. Só presença.

## D2 — Qua 17/06 · Primeiro empurrão público

- **X:** post visual "o XI mais bizarro que apareceu" (ex.: Cabo Verde,
  Uzbequistão) + screenshot. Esse é o formato que viraliza em pt-BR futebol.
- **Reddit:**
  - r/futebol: post com flair OC "fiz um simulador single-player da Copa
    2026". Leia as regras antes — alguns subs exigem 90 dias de conta.
  - r/brasil flair Tecnologia (audiência maior, menos rigoroso).
  - r/SoccerGaming (gringo, FIFA crowd) — abre flanco internacional.
- **IG Story:** poll "draftarias esse XI?" com link.
- **TikTok:** posta o melhor short do D1.

## D3 — Qui 18/06 · Tactical hit em jogo do Brasil

> Assume jogo do Brasil essa semana. Se for outro dia, troca D3 ↔ D4/D5.

- **2h antes do jogo:** thread no X "antes do Brasil entrar, simula a Copa
  inteira" + link. Pico de atenção pré-apito.
- **Durante o jogo:** posts curtos no X comentando o jogo — tom de torcedor,
  não de marketing.
- **Pós-jogo:** "se o Brasil acabou de cair, vinga no Draft 26" — joga na
  emoção do momento.
- **Comentários em lives:** Cazé TV, Desimpedidos, Bola Pré durante a live.
  **1 mensagem por canal** — tem que parecer natural, não spam.

## D4 — Sex 19/06 · Mid-week + outreach

- **YouTube:** vídeo de 5-8min "campanha completa com país aleatório" em
  formato vlog. **Investimento maior da semana.** Posta de manhã (algoritmo
  YT prefere manhã pra sustentar exposição no fim de semana).
- **TikTok:** 3 shorts ao longo do dia (manhã, almoço, noite). Cada um com
  hook diferente (engraçado, sério, surpresa).
- **Outreach 1-on-1:** DM em 3-5 micro-influencers (10-50k seguidores) de
  futebol no X/IG. **Não pede divulgação — pede pra eles jogarem.** Algo
  como *"Mano, fiz um simulador da Copa, topa drafted ao vivo no próximo
  stream?"* Conversão muito maior que mass DM.
- **X:** meme do dia. Ex.: *"POV: você draftou a Bolívia e o primeiro jogo é
  Argentina."*

## D5 — Sáb 20/06 · Pico do fim de semana

- 3-4 posts no X ao longo do dia, com prints de campanhas reais (se já
  tiver usuários — anon, sem PII).
- Reel de 30s no IG (não Story) — algoritmo prioriza vídeo aos sábados.
- YouTube Short adicional (mantém momentum do vídeo longo de sexta).
- Se Brasil jogar sábado, repete playbook do D3.

## D6 — Dom 21/06 · Retrospectiva + carve-out

- **X thread:** "Os 10 XIs mais doidos da semana" — repost user-generated
  com crédito. Esse formato gera bounce: as pessoas marcadas amplificam.
- **IG carrossel:** "Os campeões da semana" — top 5 países que mais viraram
  campeões.
- **Métricas internas:** DAU, runs iniciadas vs. completadas, share rate,
  fontes de tráfego (UTM já está instrumentado — ver `src/lib/session.ts`).
  Decide próxima semana com base nesses dados.

## Conteúdo recorrente — manter durante a semana toda

- **X:** 2-3 posts/dia. 1 "produto" (print/draft), 1 "futebol" (comentário
  do dia), 1 reply em conta grande.
- **IG Story:** 1-2 por dia, mantém o feed vivo.
- **Comentários em lives:** ~30min/dia em 2 canais grandes. Não menciona
  produto na primeira semana exceto quando tiver hook genuíno.

## Canais brasileiros pra comentar (ordem de prioridade)

1. **Cazé TV** — lives com 200k+ ao vivo. Atenção barata, moderação difícil.
   Comportamento: torcedor, não marketing.
2. **Desimpedidos / Bola Pré** — audiência exata do produto.
3. **Pilhado** — torcedor raiz, polêmica = engagement.
4. **Mundo GE / GE direto da Copa** — comentário mais técnico, audiência
   mais velha.
5. **Crew Pro / Bola na Trave** — nicho FIFA gamer, perfeito pro produto.
6. **Benja (Joel Datena Jr)** — micro mas engajado.

## Riscos / o que NÃO fazer

- **Spam em r/futebol = ban.** Engaja 3-4 dias antes de postar.
- **Mass DM sem contexto = blocked.** Pesquisa 5min antes de cada DM.
- **Sumir em dia de jogo do Brasil = perde a janela.**
- **Posts genéricos** ("fiz um simulador, joga aí") morrem. Toda mensagem
  precisa de hook (XI bizarro, resultado absurdo, treta).
- **Cuidado com marca:** "Copa 2026", não "FIFA World Cup 2026™" — já está
  OK no produto, manter assim na comunicação.

## Métricas pra acompanhar

A telemetria atual cobre o necessário pra decidir o que funciona:

| Métrica                              | Onde                       |
|--------------------------------------|----------------------------|
| Sessões / DAU                        | `view_page` + `session_id` |
| Funil draft → grupos → mata-mata     | `country_rolled`, `player_picked`, `match_completed` |
| Run completion rate                  | `run_finished` / `run_started` |
| Share rate                           | `share_clicked` (a instrumentar) |
| Origem de tráfego                    | UTM no `track-session-once` |
| Países draftados mais frequentes     | agregado de `country_rolled` |
| Países que mais viram campeões       | agregado de `run_finished` |

Critério de "deu certo na semana 1": >500 runs completadas E share rate >5%.
Abaixo disso, replanejar a semana 2 priorizando o canal que está convertendo.

## Próximos passos imediatos

Em ordem de prioridade pra hoje:

1. **OG image dinâmica** (~6h). Sem ela, todo o resto fica fraco.
2. **Reservar handles** em X / IG / TikTok / YT (~30min).
3. **Gravar 3-5 clipes curtos** (draft random, campanha terminando, XI
   bizarro) pra ter banco de conteúdo (~1h).
4. **Instrumentar `share_clicked`** (~30min).

## Cronograma de revisão

- **Dom 21/06:** retrô da semana 1 com métricas. Decide semana 2.
- **Toda quinta:** mid-week check — o que tá funcionando, o que pivota.
- **Pós-final (19/07):** decidir se vira produto permanente
  (multiplayer, próximas competições) ou se entra em modo arquivo.
