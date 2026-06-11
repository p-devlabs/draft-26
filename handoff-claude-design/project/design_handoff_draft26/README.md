# Handoff: DRAFT 26 — jogo de Copa no dado

## Overview
**DRAFT 26** é um jogo web onde o usuário monta um XI **no dado** entre os 26 convocados de cada uma das **48 seleções** da Copa 2026 e simula o torneio inteiro — fase de grupos + mata-mata de 5 fases — com o objetivo de **conquistar o mundo** (ser campeão; a goleada de 7 a 0 é o feito-assinatura).

Fluxo do app:
`LANDING → ESCALAÇÃO (monta o XI) → GRUPOS (3 jogos) → CHAVEAMENTO (5 fases) → PARTIDA (cada jogo) → Eliminado / Campeão`

> **Marca:** o produto se chama **DRAFT 26** — wordmark **DRAFT** (Anton) + tag lima **26** (Space Mono), ao lado de um *mark* de dado. O nome antigo era **ONZE**; já foi trocado em todas as telas. ⚠️ Os **nomes de arquivo** (`ONZE - *.dc.html`) seguem como estão — são só caminhos de referência, não a marca. A palavra minúscula "onze/time" pode aparecer em corpo de texto como vocabulário de futebol (o XI) — isso é intencional.

## About the Design Files
Os arquivos `.dc.html` deste bundle são **referências de design feitas em HTML** — protótipos que mostram a aparência e o comportamento pretendidos, **não** código de produção pra copiar direto. A tarefa é **recriar estes designs no ambiente já scaffolded do projeto** usando seus padrões.

**Stack alvo (já existe no repo):** Vite + React 19 + React Router 7 + Tailwind 4 + Supabase.

Cada `.dc.html` é um "Design Component": um arquivo isolado, com estilos 100% inline e zero CSS compartilhado, que abre direto no browser. A lógica de cada protótipo está numa classe `Component extends DCLogic` no fim do arquivo (depois do markup). Os dados (seleções/jogadores) estão **mockados** dentro dessa lógica (~8 seleções de amostra) — devem ser substituídos pela query do Supabase (48 × 26).

## Fidelity
**Alta-fidelidade (hifi).** Cores, tipografia, espaçamento e interações são finais. Recriar pixel-perfect com Tailwind, mapeando os tokens abaixo para o `tailwind.config`. As animações (dado girando, pulso do CTA, bottom-sheet subindo, flash de gol) fazem parte do design.

---

## Design Tokens

### Cores (mapear pra tokens Tailwind)
| Token | Hex | Uso |
|---|---|---|
| `bg` | `#0A0B09` | fundo da página |
| `surface` | `#141613` | cards, app bar |
| `surface2` | `#1B1E19` | inputs, chips, estados internos |
| `line` | `#2A2E26` | bordas / divisórias |
| `ink` | `#F3F4EC` | texto principal |
| `mut` | `#888C80` | texto secundário / muted |
| `lime` | `#D4FF3D` | **accent único** — CTA, destaque, dado |
| `red` | `#FF3B3B` | live / expulsão / dificuldade máx |
| `gk/warn` | `#FF8A3B` | goleiro / aviso |
| `info` | `#5AA0FF` | informativo |

Regra de cor: dark puro + **um** accent (lima). As cores de seleção entram só como "dado", nunca competindo com a lima.

### Tipografia (Google Fonts)
- **Anton** — display, placar, numerais, wordmark. `font-weight:400` (a fonte só tem um peso). Use para títulos grandes e scores.
- **Archivo** — UI e texto de leitura. Pesos 400–900 (800 para títulos de seção/cards).
- **Space Mono** — dados, códigos de seleção, rótulos técnicos, kickers. 400/700, geralmente com `letter-spacing` .08–.2em e caixa-alta.

Escala (não descer de): display clamp(34–72px); título de seção clamp(28–40px) Anton; card-title 17–18px/800 Archivo; body 14–17px; label 10–12px Space Mono.

### Raio
`6 · 9 · 11 · 14px` e `50%`/full. Cards ~14–16px, botões ~10–13px, chips ~7–8px, app bar pills ~8px.

### Espaçamento
Grade de 4px: `8 · 12 · 16 · 22 · 32 · 48`. Seções verticais `clamp(48,7vw,80)px`; gutter horizontal `clamp(20,5vw,56)px`; max-width de conteúdo 1120–1280px.

### Sombras / efeitos
- Glow do dado: `box-shadow:0 0 60px -6px rgba(212,255,61,.5)`.
- Pulso do CTA: `@keyframes onzePulse` (renomeável) — `box-shadow:0 0 0 0 → 0 0 0 9px rgba(212,255,61,.45→0)`, ~2.6s.
- App bar fixa: `background:rgba(10,11,9,.85);backdrop-filter:blur(8px)`.

---

## Identidade de seleção = cor + código (SEM bandeiras)
Não há imagens de bandeira. Cada seleção = **gradiente de 2 cores + código de 3 letras**. Escala pras 48 sem assets.

Badge (broadcast lower-third): retângulo `64×44`, `border-radius:8px`, `overflow:hidden`, borda `rgba(255,255,255,.12)`. O **código fica na base**, sobre um scrim escuro pra garantir contraste em qualquer cor:
```
código: position:absolute; left/right/bottom:0; padding:8px 7px 4px;
        background:linear-gradient(180deg,transparent,rgba(0,0,0,.72));
        color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.55);
        font:Space Mono 11px/700; letter-spacing:.04em;
```

Schema sugerido (vem do Supabase):
```ts
Selecao  { code: 'BRA', name, c1, c2, textOn, grupo }
Jogador  { n, name, pos, grp: 'GOL'|'DEF'|'MEI'|'ATA', ovr, selecaoCode }
```

---

## Regras de jogo (NÃO quebrar)
1. **Sorteio por posição** — cada vaga do XI rola o dado → sorteia 1 seleção → escala 1 jogador dela naquela posição.
2. **Trava** — posição preenchida não muda.
3. **Cooldown** — seleção já sorteada fica fora dos **próximos 5 sorteios**.
4. **Skip por dificuldade** — Fácil = **5** pulos · Médio = **3** · Difícil = **1**. Pular re-sorteia a seleção e gasta 1 pulo (a seleção pulada entra no cooldown).

**Mata-mata (2026): 5 fases** — 32-avos (16 jogos) → Oitavas → Quartas → Semis → Final. Classificados: top 2 de cada um dos 12 grupos + 8 melhores 3ºs = 32.

**O dado tem 3 estados:** parado (face fixa) · rolando (gira em lima, glow) · resultado (face do sorteio). Anim. de giro `@keyframes onzeSpin` (rotate 0→360, ~1.1s rolando / ~3.4s decorativo).

---

## Screens / Views

### 0. Landing (`ONZE - Landing.dc.html`) — porta de entrada / explica o jogo
- **Propósito:** apresentar o jogo e levar pro CTA "JOGAR" (→ Escalação).
- **Layout:** top bar sticky (logo DRAFT 26 + botão JOGAR). Hero em grid 1.15fr/0.85fr (colapsa pra 1 coluna ≤760px, com o dado indo pro topo): à esquerda kicker + h1 Anton clamp(40–72) "ROLE O DADO. / FAÇA O DRAFT. / **CONQUISTE O MUNDO.**", subhead, dois CTAs e uma linha de 4 stats (48 · 26 · 11 · 1 TAÇA); à direita o dado girando + caption. Depois, seções full-width com gutter: **COMO FUNCIONA** (4 cards numerados 01–04: Sorteie o XI / Fase de grupos / Mata-mata / Conquiste o mundo — o 04 tem fundo lima translúcido), **AS REGRAS DO DADO** (3 cards Trava/Cooldown/Skip + faixa de dificuldade 5·3·1), **O CAMINHO** (4 cards-link pras telas), **48 SELEÇÕES** (linha de badges cor+código + placeholder "+40"), **CTA FINAL** ("PRONTO PRA CONQUISTAR O MUNDO?" + botão JOGAR AGORA), footer.
- **Responsivo:** breakpoints a 760px (hero 1-col, dado 104px no topo) e 480px (stats com gap menor, cards de "O CAMINHO" full-width).
- **CTAs** → todos navegam pra Escalação.

### 1. Escalação (`ONZE - Escalacao.dc.html`) — monta o XI no dado
- **Propósito:** montar as 11 posições, cada uma sorteada no dado.
- **Telas internas:** `setup` (PASSO 1 · escolher tática/estilo, num bottom-sheet "MONTE SEU TIME") → `build` (campo com 11 chips de posição; barra de progresso XI n/11; "OVR DO TIME"; sorteio → trava → cooldown; skip conforme dificuldade) → ao completar, CTA "SIMULAR →" libera Grupos.
- Componentes-chave: chip de posição no campo (círculo 48px, borda lima quando preenchido, número Anton + nome + pill `OVR · POS`), player row (selecionado vs pool), seletor de formação (4-3-3 / 4-4-2 / 3-5-2), dado nos 3 estados, app bar com nav.

### 2. Grupos (`ONZE - Grupos.dc.html`) — fase de grupos
- 12 grupos; **seu grupo em destaque**; tabela de classificação; jogos jogáveis (3 por grupo). CTA pra Partida e, ao concluir os 3, libera Chaveamento. Status mono "FASE DE GRUPOS · JOGO n/3".

### 3. Chaveamento (`ONZE - Chaveamento.dc.html`) — bracket de 5 fases
- 32-avos → oitavas → quartas → semis → final, com o **caminho do usuário em destaque**. Cada confronto jogável abre a Partida. (`ONZE - Chaveamento v1.dc.html` é uma versão anterior — pode ignorar.)

### 4. Partida (`ONZE - Partida.dc.html`) — simulação ao vivo + desfechos
- **Propósito:** rodar a partida (gols, expulsões) e mostrar o resultado.
- Placar grande Anton, badge `LIVE` vermelho piscando (`@keyframes blink`/`liveDot`), flash no gol (`@keyframes goalFlash` scale 1→1.18→1). Ao fim, **bottom-sheet** de desfecho: **CAMPEÃO** (banner lima radial, taça, share social) ou **ELIMINADO** (vermelho), ambos com CTA "JOGAR DE NOVO" → Escalação.

### Design System (`ONZE - Design System.dc.html`) — referência de tokens/componentes
- Não é tela do app; é a fonte de verdade visual: paleta, tipografia, raio/espaço, os 3 estados do dado, biblioteca de componentes (botões, filtros, badges de seleção, OVR, player row, progresso+placar, chip de campo, formação) e a anatomia/spec do bottom-sheet. **Comece por aqui** ao traduzir pros tokens do Tailwind.

---

## Interactions & Behavior
- **Navegação (app bar igual em todas as telas):** pills `ESCALAÇÃO · GRUPOS · CHAVEAMENTO · PARTIDA` — vira `<Link>` do React Router. A pill ativa é lima sólida; as demais mut. App bar sticky com blur.
- **Sorteio:** clicar "ROLAR" → dado entra em `rolando` (~1.1s, gira em lima) → cai no `resultado` → escala o jogador → posição **trava** → seleção entra em cooldown (5).
- **Skip:** disponível só se restam pulos (5/3/1 por dificuldade); re-sorteia e decrementa o contador.
- **Bottom-sheet (todo modal/desfecho):** scrim `rgba(6,7,5,.78)` + `blur(4px)` (`fadeIn .25s`); folha ancorada na base, `border-radius:22px 22px 0 0`, entra com `@keyframes sheetUp .32s`; max-width 600px / 100% no mobile; max-height 92vh com scroll interno; z-index scrim 30 / folha 31; grabber 38×4 no topo.
- **Responsivo:** app bar quebra em ≤820px (nav vira faixa scrollável); Landing em 760/480px (ver acima).

## State Management
- `dificuldade` ('facil'|'medio'|'dificil') → define `pulosRestantes` (5/3/1).
- `formacao` / `estilo`.
- `xi[]` — 11 slots `{ pos, selecaoCode, jogador, travado }`.
- `cooldown` — fila/contador das últimas 5 seleções sorteadas (excluídas do próximo sorteio).
- `faseDado` — 'parado' | 'rolando' | 'resultado'.
- Progressão do torneio: `grupo` + resultados dos jogos → classificação → `bracket` (5 fases) → resultado de cada partida → desfecho (campeão/eliminado).
- **Dados:** hoje mockados na lógica de cada `.dc.html`; trocar por queries Supabase (48 seleções × 26 jogadores). Persistir o progresso do torneio.

## Assets
Nenhum asset de imagem. Bandeiras = gradiente cor+código (ver acima). Fontes via Google Fonts (Anton, Archivo, Space Mono). Ícones desenhados com CSS (dado, dots) ou emoji pontual (🏆 no card de campeão).

## Files (referência de design, neste bundle)
- `ONZE - Landing.dc.html` — landing / explica o jogo (mais recente)
- `ONZE - Escalacao.dc.html` — montagem do XI no dado
- `ONZE - Grupos.dc.html` — fase de grupos
- `ONZE - Chaveamento.dc.html` — bracket de 5 fases
- `ONZE - Partida.dc.html` — simulação + desfechos (campeão/eliminado)
- `ONZE - Design System.dc.html` — tokens + biblioteca de componentes (começar por aqui)
- `ONZE - Chaveamento v1.dc.html` — versão anterior do bracket (ignorável)
- `Escalacao - Direcoes.dc.html` — explorações da Escalação
- `support.js` — runtime dos Design Components (só pra abrir os `.dc.html` no browser; **não** portar)

> Para abrir os protótipos localmente, sirva a pasta (ex: `npx serve`) e abra cada `.dc.html` — eles dependem do `support.js` ao lado.
