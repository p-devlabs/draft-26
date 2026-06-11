# DRAFT 26 — Mapa de Handoff

> **Marca:** o jogo agora se chama **DRAFT 26** (wordmark **DRAFT** + tag lima **26**). O nome antigo era ONZE.
> Os nomes de arquivo (`ONZE - *.dc.html`) seguem como estão — são só caminhos, não a marca.

Jogo: monte um XI **no dado** entre os 26 convocados das **48 seleções** da Copa 2026 e
simule o torneio (fase de grupos + mata-mata de 5 fases) até **fazer 7 a 0**.

Stack alvo: **Vite + React 19 + React Router 7 + Tailwind 4 + Supabase** (já scaffolded).
Os designs são protótipos em HTML/Design-Components — servem de fonte de verdade visual + de comportamento.

---

## Como dividir em chats (5 buckets)

Cada arquivo abre **isolado** (estilos inline, zero CSS compartilhado), então pode ser
levado pra um chat / sessão de Claude Code independente:

| # | Chat / Bucket | Arquivo fonte | O que entrega |
|---|---|---|---|
| 1 | **Foundations + Utils & Drawers** | `ONZE — Design System.dc.html` | tokens, tipografia, dado, biblioteca de componentes, padrão de bottom-sheet |
| 2 | **Escalação** | `ONZE - Escalacao.dc.html` | montagem do XI no dado (setup → sorteio → trava → cooldown → skip/dificuldade) |
| 3 | **Fase de Grupos** | `ONZE - Grupos.dc.html` | 12 grupos, seu grupo em destaque, jogos jogáveis |
| 4 | **Chaveamento** | `ONZE - Chaveamento.dc.html` | bracket de 5 fases (32-avos → final), caminho do usuário em destaque |
| 5 | **Partida + Desfechos** | `ONZE - Partida.dc.html` | simulação ao vivo (gols/expulsões), drawers de Eliminado e Campeão (+social) |

> Comece sempre pelo bucket 1 (Foundations) — os outros 4 consomem os mesmos tokens e padrões.

---

## Contratos compartilhados (TODO bucket respeita)

### Tokens (mesmos em todos os arquivos, no `style` raiz do componente)
```
--bg:#0a0b09  --surface:#141613  --surface2:#1b1e19  --line:#2a2e26
--ink:#f3f4ec --mut:#888c80  --lime:#d4ff3d (accent/CTA)  --red:#ff3b3b (live/expulsão)
```
Fontes: **Anton** (placar/numerais), **Archivo** (UI/texto), **Space Mono** (dados/códigos).

### Identidade de seleção = cor + código
Sem imagens de bandeira. Cada seleção = gradiente (2 cores) + código de 3 letras tipográfico.
Escala pras 48 sem assets. Schema sugerido (vem do Supabase):
```ts
Selecao  { code: 'BRA', name, c1, c2, textOn, grupo }
Jogador  { n, name, pos, grp: 'GOL'|'DEF'|'MEI'|'ATA', ovr, selecaoCode }
```

### Regras de jogo (não quebrar)
1. **Sorteio por posição**: cada vaga do XI rola o dado → sorteia 1 seleção → escala 1 jogador dela na posição.
2. **Trava**: posição preenchida não muda.
3. **Cooldown**: seleção já sorteada fica fora dos **próximos 5 sorteios**.
4. **Skip por dificuldade**: Fácil = 5 pulos · Médio = 3 · Difícil = 1. Pular re-sorteia a seleção e gasta 1 pulo (a seleção pulada entra no cooldown).

### Navegação (app bar igual em todas as telas)
`ESCALAÇÃO → GRUPOS → CHAVEAMENTO → PARTIDA` (links relativos entre os `.dc.html`).
Fluxo: Escalação (monta XI) → Grupos (joga os 3 jogos) → Chaveamento (5 fases) → Partida (cada jogo) → Eliminado/Campeão.

### Mata-mata (2026): 5 fases
32-avos (16 jogos) → Oitavas → Quartas → Semis → Final. Top 2 de cada grupo + 8 melhores 3ºs = 32 classificados.

---

## Observações de implementação
- Dados de seleções/jogadores estão **mockados** dentro da lógica de cada protótipo (≈8 seleções de amostra) — substituir pela query do Supabase (48 × 26).
- Drawers usam padrão **bottom-sheet** (`@keyframes sheetUp` + overlay com blur). Reaproveitar do bucket 1.
- O dado tem 3 estados: parado / rolando (gira em lima) / resultado.
- Nome do produto: **DRAFT 26** (wordmark **DRAFT** + tag lima **26** + mark de dado). Era ONZE; já trocado em todas as telas. A palavra "onze/time" como vocabulário de futebol (o XI) pode aparecer no corpo de texto — isso é intencional, não é a marca.
