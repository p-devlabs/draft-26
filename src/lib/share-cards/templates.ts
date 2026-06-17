/**
 * Templates HTML dos share cards (formato Stories, 1080×1920).
 *
 * Cada card é construído a partir de `ShareCardData` e devolve o HTML do nó raiz
 * (1080×1920, self-contained, px fixos), pronto pra ser rasterizado por
 * `htmlToPngBlob`. Markup portado fielmente do design (Claude Design project
 * `torneio-de-verano-2026`, share-cards/*-stories.html), com a parte dinâmica
 * parametrizada e os trechos repetidos extraídos em sub-builders.
 *
 * É XML (vai dentro de um `<foreignObject>`): todo texto dinâmico passa por
 * `esc()` e todas as tags ficam fechadas.
 */

/** Tipo de card suportado — subconjunto de OutcomeKind com card desenhado. */
export type ShareCardKind = 'champ' | 'classificado' | 'avancou' | 'grupo'

export interface ShareStandingRow {
  pos: number
  /** Código (ex.: 'NED') ou nome curto; ignorado quando isUser (vira "SEU XI"). */
  name: string
  isUser: boolean
  played: number
  /** Saldo de gols (inteiro com sinal aplicado na renderização). */
  gd: number
  pts: number
}

export interface ShareCardData {
  kind: ShareCardKind
  /** Linha do kicker (já formatada, ex.: "MATA-MATA · QUARTAS DE FINAL"). */
  kicker: string
  /** Headline do card avançou (ex.: "NA SEMI!"). */
  headlineText: string
  /** Sublinha do card classificado (ex.: "1º DO GRUPO G"). */
  positionLine: string
  // Placar (champ / avancou / grupo)
  userGoals: number
  oppGoals: number
  opp: string
  penalties: { user: number; opp: number } | null
  // Time
  formation: string
  styleLabel: string
  countries: number
  ovr: number
  // Campanha
  jogos: number
  rec: string
  gols: number
  saldo: string
  // Artilheiro (champ)
  topScorer: { name: string; goals: number } | null
  // Classificação (grupo / classificado)
  standings: ShareStandingRow[] | null
}

// Tokens de cor do tema dark (espelham --color-d-* do index.css).
const C = {
  bg: '#0a0b09',
  surface: '#141613',
  surface2: '#1b1e19',
  line: '#2a2e26',
  ink: '#f3f4ec',
  mut: '#888c80',
  lime: '#d4ff3d',
} as const

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Saldo com o sinal do design (− tipográfico pra negativos). */
function fmtGd(gd: number): string {
  if (gd > 0) return `+${gd}`
  if (gd < 0) return `−${Math.abs(gd)}`
  return '0'
}

// ---------- Sub-builders ----------

function headerRow(trophy: boolean): string {
  const dot = `<span style="width:10px;height:10px;border-radius:50%;background:${C.bg};place-self:center"></span>`
  const gap = `<span></span>`
  const dice =
    `<div style="width:64px;height:64px;border-radius:15px;background:${C.lime};display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr 1fr;gap:5px;padding:13px;flex:none">` +
    `${dot}${gap}${dot}${gap}${dot}${gap}${dot}${gap}${dot}</div>`
  const wordmark =
    `<div style="display:flex;align-items:baseline;gap:12px">` +
    `<span style="font-family:'Anton';font-size:55px;letter-spacing:.02em;color:${C.ink};line-height:1">DRAFT</span>` +
    `<span style="font-family:'Space Mono';font-weight:700;font-size:22px;color:${C.lime};line-height:1">26</span></div>`
  const trophyEl = trophy ? `<div style="font-size:83px;line-height:1">🏆</div>` : ''
  return (
    `<div style="display:flex;align-items:center;justify-content:space-between">` +
    `<div style="display:flex;align-items:center;gap:22px">${dice}${wordmark}</div>${trophyEl}</div>`
  )
}

function kickerLine(text: string): string {
  return (
    `<div style="display:flex;align-items:center;gap:14px;font-family:'Space Mono';font-weight:700;font-size:22px;letter-spacing:.22em;color:${C.lime}">` +
    `<span style="width:34px;height:4px;background:${C.lime};border-radius:2px"></span>${esc(text)}</div>`
  )
}

function statBlock(title: string, cells: { value: string; label: string }[]): string {
  const cellEls = cells
    .map(
      (c, i) =>
        `<div style="flex:1;text-align:center;padding:0 8px;${i > 0 ? `border-left:1px solid ${C.line}` : ''}">` +
        `<div style="font-family:'Anton';font-size:46px;line-height:.95;color:${C.ink}">${esc(c.value)}</div>` +
        `<div style="font-family:'Space Mono';font-weight:700;font-size:16px;letter-spacing:.12em;color:${C.mut};margin-top:10px">${c.label}</div></div>`,
    )
    .join('')
  return (
    `<div style="background:${C.surface};border:1px solid ${C.line};border-radius:22px;padding:30px 16px">` +
    `<div style="font-family:'Space Mono';font-weight:700;font-size:17px;letter-spacing:.18em;color:${C.mut};margin:0 0 24px 12px">${title}</div>` +
    `<div style="display:flex">${cellEls}</div></div>`
  )
}

function teamBlock(d: ShareCardData): string {
  return statBlock('O TIME', [
    { value: d.formation, label: 'FORMAÇÃO' },
    { value: d.styleLabel, label: 'ESTILO' },
    { value: String(d.countries), label: 'SELEÇÕES' },
    { value: String(d.ovr), label: 'OVR' },
  ])
}

function campaignBlock(d: ShareCardData): string {
  return statBlock('CAMPANHA', [
    { value: String(d.jogos), label: 'JOGOS' },
    { value: d.rec, label: 'V-E-D' },
    { value: String(d.gols), label: 'GOLS PRÓ' },
    { value: d.saldo, label: 'SALDO' },
  ])
}

function matchCard(d: ShareCardData): string {
  const userScoreColor = d.userGoals > d.oppGoals ? C.lime : C.ink
  const left =
    `<div style="text-align:left;min-width:0">` +
    `<div style="font-family:'Space Mono';font-weight:700;font-size:20px;letter-spacing:.16em;color:${C.lime};margin-bottom:8px">SEU XI</div>` +
    `<div style="font-family:'Anton';font-size:40px;letter-spacing:.02em;color:${C.ink};line-height:1">O DRAFT</div></div>`
  const score =
    `<div style="display:flex;align-items:center;gap:22px;flex:none">` +
    `<span style="font-family:'Anton';font-size:150px;line-height:.8;color:${userScoreColor}">${d.userGoals}</span>` +
    `<span style="font-family:'Anton';font-size:70px;color:${C.mut};line-height:.8">—</span>` +
    `<span style="font-family:'Anton';font-size:150px;line-height:.8;color:${C.ink}">${d.oppGoals}</span></div>`
  const penLine = d.penalties
    ? `<div style="font-family:'Space Mono';font-weight:700;font-size:20px;color:${C.lime};margin-top:6px">${d.penalties.user}-${d.penalties.opp} pen</div>`
    : ''
  const right =
    `<div style="text-align:right;min-width:0">` +
    `<div style="font-family:'Space Mono';font-weight:700;font-size:20px;letter-spacing:.16em;color:${C.mut};margin-bottom:8px">${d.penalties ? 'PÊNALTIS' : 'ADVERSÁRIO'}</div>` +
    `<div style="font-family:'Anton';font-size:40px;letter-spacing:.02em;color:${C.ink};line-height:1">${esc(d.opp)}</div>${penLine}</div>`
  return (
    `<div style="background:${C.surface};border:1px solid ${C.line};border-radius:22px;padding:34px 38px;display:flex;align-items:center;justify-content:space-between;gap:16px">` +
    `${left}${score}${right}</div>`
  )
}

function standingsBlock(rows: ShareStandingRow[]): string {
  const head =
    `<div style="display:grid;grid-template-columns:48px 1fr 56px 70px 72px;font-family:'Space Mono';font-weight:700;font-size:16px;letter-spacing:.1em;color:${C.mut};padding:0 20px 14px">` +
    `<span>#</span><span>SELEÇÃO</span><span style="text-align:center">J</span><span style="text-align:center">SG</span><span style="text-align:right">PTS</span></div>`
  const body = rows
    .map((r) => {
      const rowBg = r.isUser ? C.lime : C.surface2
      const numColor = r.isUser ? C.bg : C.mut
      const nameColor = r.isUser ? C.bg : C.ink
      const playedColor = r.isUser ? C.bg : C.mut
      const gdColor = r.isUser ? C.bg : C.ink
      const ptsColor = r.isUser ? C.bg : C.ink
      const name = r.isUser ? 'SEU XI' : esc(r.name)
      return (
        `<div style="display:grid;grid-template-columns:48px 1fr 56px 70px 72px;align-items:center;background:${rowBg};border-radius:12px;padding:16px 20px;margin-bottom:8px">` +
        `<span style="font-family:'Anton';font-size:28px;color:${numColor}">${r.pos}</span>` +
        `<span style="font-family:'Archivo';font-weight:800;font-size:26px;color:${nameColor};letter-spacing:.01em">${name}</span>` +
        `<span style="font-family:'Space Mono';font-weight:700;font-size:22px;text-align:center;color:${playedColor}">${r.played}</span>` +
        `<span style="font-family:'Space Mono';font-weight:700;font-size:22px;text-align:center;color:${gdColor}">${fmtGd(r.gd)}</span>` +
        `<span style="font-family:'Anton';font-size:30px;text-align:right;color:${ptsColor}">${r.pts}</span></div>`
      )
    })
    .join('')
  return `<div style="background:${C.surface};border:1px solid ${C.line};border-radius:22px;padding:24px 16px 16px">${head}${body}</div>`
}

function scorerBlock(name: string, goals: number): string {
  return (
    `<div style="background:${C.surface};border:1px solid ${C.line};border-radius:22px;padding:26px 32px;display:flex;align-items:center;justify-content:space-between">` +
    `<div style="font-family:'Space Mono';font-weight:700;font-size:17px;letter-spacing:.18em;color:${C.mut}">ARTILHEIRO</div>` +
    `<div style="display:flex;align-items:baseline;gap:16px">` +
    `<span style="font-family:'Archivo';font-weight:900;font-size:40px;color:${C.ink}">${esc(name)}</span>` +
    `<span style="font-family:'Anton';font-size:48px;color:${C.lime}">${goals}</span>` +
    `<span style="font-family:'Space Mono';font-weight:700;font-size:18px;color:${C.mut}">gols</span></div></div>`
  )
}

function footer(): string {
  return (
    `<div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid ${C.line};padding-top:27px">` +
    `<div style="font-family:'Space Mono';font-size:21px;letter-spacing:.1em;color:${C.mut}">SIMULADOR DA COPA 2026</div>` +
    `<div style="font-family:'Space Mono';font-weight:700;font-size:23px;letter-spacing:.04em;color:${C.lime}">draft-26.pages.dev</div></div>`
  )
}

function frame(opts: { ring: boolean; bg: string; inner: string }): string {
  const ring = opts.ring
    ? `<div style="position:absolute;inset:34px;border:1px solid rgba(212,255,61,.28);border-radius:30px;pointer-events:none"></div>`
    : ''
  return (
    `<div style="width:1080px;height:1920px;position:relative;overflow:hidden;color:${C.ink};font-family:'Archivo',sans-serif;background:${opts.bg}">` +
    ring +
    `<div style="position:absolute;top:250px;bottom:250px;left:80px;right:80px;display:flex;flex-direction:column;justify-content:space-between">` +
    opts.inner +
    `</div></div>`
  )
}

const BG_CHAMP =
  'radial-gradient(1100px 700px at 88% -8%, rgba(212,255,61,.22), transparent 60%), radial-gradient(900px 600px at 6% 108%, rgba(212,255,61,.12), transparent 60%), #0a0b09'
const BG_DEFAULT =
  'radial-gradient(1000px 640px at 88% -8%, rgba(212,255,61,.12), transparent 60%), #0a0b09'

function col(gap: number, children: string): string {
  return `<div style="display:flex;flex-direction:column;gap:${gap}px">${children}</div>`
}

// ---------- Cards ----------

function champCard(d: ShareCardData): string {
  const headline =
    `<div style="font-family:'Anton';line-height:.86;letter-spacing:.005em">` +
    `<div style="font-size:88px;color:${C.ink}">SEU XI É</div>` +
    `<div style="font-size:118px;color:${C.lime}">CAMPEÃO DO MUNDO</div></div>`
  const middle = col(38, kickerLine(d.kicker) + headline + matchCard(d))
  const bottom = col(
    18,
    teamBlock(d) +
      campaignBlock(d) +
      (d.topScorer ? scorerBlock(d.topScorer.name, d.topScorer.goals) : ''),
  )
  return frame({ ring: true, bg: BG_CHAMP, inner: headerRow(true) + middle + bottom + footer() })
}

function classificadoCard(d: ShareCardData): string {
  const headline =
    `<div style="font-family:'Anton';line-height:.86;letter-spacing:.005em">` +
    `<div style="font-size:118px;color:${C.lime}">CLASSIFICADO</div>` +
    `<div style="font-family:'Space Mono';font-weight:700;font-size:34px;letter-spacing:.06em;color:${C.ink};margin-top:22px">${esc(d.positionLine)}</div></div>`
  const middle = col(38, kickerLine(d.kicker) + headline)
  const bottom = col(
    18,
    (d.standings ? standingsBlock(d.standings) : '') + teamBlock(d) + campaignBlock(d),
  )
  return frame({
    ring: false,
    bg: BG_DEFAULT,
    inner: headerRow(false) + middle + bottom + footer(),
  })
}

function avancouCard(d: ShareCardData): string {
  const headline = `<div style="font-family:'Anton';line-height:.86;letter-spacing:.005em"><div style="font-size:150px;color:${C.lime}">${esc(d.headlineText)}</div></div>`
  const middle = col(38, kickerLine(d.kicker) + headline + matchCard(d))
  const bottom = col(18, teamBlock(d) + campaignBlock(d))
  return frame({
    ring: false,
    bg: BG_DEFAULT,
    inner: headerRow(false) + middle + bottom + footer(),
  })
}

function grupoCard(d: ShareCardData): string {
  const headline = `<div style="font-family:'Anton';line-height:.86;letter-spacing:.005em"><div style="font-size:150px;color:${C.lime}">VITÓRIA</div></div>`
  const middle = col(38, kickerLine(d.kicker) + headline + matchCard(d))
  const bottom = col(18, (d.standings ? standingsBlock(d.standings) : '') + teamBlock(d))
  return frame({
    ring: false,
    bg: BG_DEFAULT,
    inner: headerRow(false) + middle + bottom + footer(),
  })
}

/** Monta o HTML do nó raiz (1080×1920) do card a partir dos dados. */
export function cardHtml(d: ShareCardData): string {
  switch (d.kind) {
    case 'champ':
      return champCard(d)
    case 'classificado':
      return classificadoCard(d)
    case 'avancou':
      return avancouCard(d)
    case 'grupo':
      return grupoCard(d)
  }
}
