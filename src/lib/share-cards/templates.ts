/**
 * Templates HTML dos share cards — formatos Stories (1080×1920) e Square
 * (1080×1080).
 *
 * Cada card é construído a partir de `ShareCardData` + um `Fmt` (preset de
 * tamanhos por formato) e devolve o HTML do nó raiz, pronto pra rasterizar por
 * `htmlToPngBlob`. Markup portado fielmente do design (Claude Design project
 * `torneio-de-verano-2026`, share-cards/*-{stories,square}.html): mesma
 * estrutura nos dois formatos, só mudam os tamanhos (square ≈ stories a 73% num
 * frame quadrado com `inset`). Os trechos repetidos viram sub-builders que leem
 * do `Fmt`.
 *
 * É XML (vai dentro de um `<foreignObject>`): todo texto dinâmico passa por
 * `esc()` e todas as tags ficam fechadas.
 */

/** Tipo de card suportado — subconjunto de OutcomeKind com card desenhado. */
export type ShareCardKind = 'champ' | 'classificado' | 'avancou' | 'grupo' | 'eliminado'

/** Formato/aspecto do card. */
export type ShareCardFormat = 'stories' | 'square'

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
  /** Headline dos cards de uma linha (avançou "NA SEMI!"). */
  headlineText: string
  /** Sublinha do card classificado (ex.: "1º DO GRUPO G"). */
  positionLine: string
  // Placar (champ / avancou / grupo / eliminado)
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
  // Artilheiro (champ, só no formato stories)
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
  red: '#ff3b3b',
} as const

/** Preset de tamanhos por formato. Todos os px que diferem entre stories/square. */
interface Fmt {
  format: ShareCardFormat
  w: number
  h: number
  framePos: string
  ringInset: number
  ringRadius: number
  bgChamp: string
  bgDefault: string
  bgElim: string
  // logo
  diceSize: number
  diceRadius: number
  dicePad: number
  diceGap: number
  dotMax: number
  logoGap: number
  wordmark: number
  wm26: number
  wmGap: number
  trophy: number
  // kicker
  kFont: number
  kGap: number
  dashW: number
  dashH: number
  // headline
  hlLh: number
  hlChamp1: number
  hlChamp2: number
  hlMain: number
  hlSub: number
  hlSubMt: number
  hlBig: number
  // match card
  mcRadius: number
  mcPad: string
  mcGap: number
  mcLabel: number
  mcLabelMb: number
  mcName: number
  mcScore: number
  mcScoreGap: number
  mcDash: number
  mcPen: number
  mcPenMt: number
  // stat block
  sbRadius: number
  sbPad: string
  sbTitle: number
  sbTitleMargin: string
  sbCellPad: string
  sbVal: number
  sbLabel: number
  sbLabelMt: number
  // standings
  stRadius: number
  stPad: string
  stCols: string
  stHead: number
  stHeadPad: string
  stRowRadius: number
  stRowPad: string
  stRowMb: number
  stNum: number
  stName: number
  stCell: number
  stPts: number
  // gaps
  midGap: number
  bottomGap: number
  // footer
  ftPadTop: number
  ftLeft: number
  ftRight: number
}

const STORIES: Fmt = {
  format: 'stories',
  w: 1080,
  h: 1920,
  framePos: 'top:250px;bottom:250px;left:80px;right:80px',
  ringInset: 34,
  ringRadius: 30,
  bgChamp:
    'radial-gradient(1100px 700px at 88% -8%, rgba(212,255,61,.22), transparent 60%), radial-gradient(900px 600px at 6% 108%, rgba(212,255,61,.12), transparent 60%), #0a0b09',
  bgDefault:
    'radial-gradient(1000px 640px at 88% -8%, rgba(212,255,61,.12), transparent 60%), #0a0b09',
  bgElim: 'radial-gradient(1000px 640px at 88% -8%, rgba(255,59,59,.16), transparent 60%), #0a0b09',
  diceSize: 64,
  diceRadius: 15,
  dicePad: 13,
  diceGap: 5,
  dotMax: 10,
  logoGap: 22,
  wordmark: 55,
  wm26: 22,
  wmGap: 12,
  trophy: 83,
  kFont: 22,
  kGap: 14,
  dashW: 34,
  dashH: 4,
  hlLh: 0.86,
  hlChamp1: 88,
  hlChamp2: 118,
  hlMain: 118,
  hlSub: 34,
  hlSubMt: 22,
  hlBig: 150,
  mcRadius: 22,
  mcPad: '34px 38px',
  mcGap: 16,
  mcLabel: 20,
  mcLabelMb: 8,
  mcName: 40,
  mcScore: 150,
  mcScoreGap: 22,
  mcDash: 70,
  mcPen: 20,
  mcPenMt: 6,
  sbRadius: 22,
  sbPad: '30px 16px',
  sbTitle: 17,
  sbTitleMargin: '0 0 24px 12px',
  sbCellPad: '0 8px',
  sbVal: 46,
  sbLabel: 16,
  sbLabelMt: 10,
  stRadius: 22,
  stPad: '24px 16px 16px',
  stCols: '48px 1fr 56px 70px 72px',
  stHead: 16,
  stHeadPad: '0 20px 14px',
  stRowRadius: 12,
  stRowPad: '16px 20px',
  stRowMb: 8,
  stNum: 28,
  stName: 26,
  stCell: 22,
  stPts: 30,
  midGap: 38,
  bottomGap: 18,
  ftPadTop: 27,
  ftLeft: 21,
  ftRight: 23,
}

const SQUARE: Fmt = {
  format: 'square',
  w: 1080,
  h: 1080,
  framePos: 'inset:64px',
  ringInset: 26,
  ringRadius: 24,
  bgChamp:
    'radial-gradient(800px 520px at 92% -10%, rgba(212,255,61,.22), transparent 60%), radial-gradient(700px 480px at 0% 110%, rgba(212,255,61,.12), transparent 60%), #0a0b09',
  bgDefault:
    'radial-gradient(760px 500px at 92% -10%, rgba(212,255,61,.12), transparent 60%), #0a0b09',
  bgElim: 'radial-gradient(760px 500px at 92% -10%, rgba(255,59,59,.16), transparent 60%), #0a0b09',
  diceSize: 53,
  diceRadius: 12,
  dicePad: 11,
  diceGap: 4,
  dotMax: 8,
  logoGap: 18,
  wordmark: 46,
  wm26: 18,
  wmGap: 10,
  trophy: 61,
  kFont: 18,
  kGap: 11,
  dashW: 28,
  dashH: 3,
  hlLh: 0.84,
  hlChamp1: 58,
  hlChamp2: 80,
  hlMain: 80,
  hlSub: 26,
  hlSubMt: 14,
  hlBig: 104,
  mcRadius: 17,
  mcPad: '27px 30px',
  mcGap: 12,
  mcLabel: 16,
  mcLabelMb: 6,
  mcName: 31,
  mcScore: 117,
  mcScoreGap: 17,
  mcDash: 55,
  mcPen: 16,
  mcPenMt: 5,
  sbRadius: 17,
  sbPad: '23px 12px',
  sbTitle: 13,
  sbTitleMargin: '0 0 19px 9px',
  sbCellPad: '0 6px',
  sbVal: 36,
  sbLabel: 12,
  sbLabelMt: 8,
  stRadius: 17,
  stPad: '19px 12px 12px',
  stCols: '37px 1fr 44px 55px 56px',
  stHead: 12,
  stHeadPad: '0 16px 11px',
  stRowRadius: 9,
  stRowPad: '12px 16px',
  stRowMb: 6,
  stNum: 22,
  stName: 20,
  stCell: 17,
  stPts: 23,
  midGap: 24,
  bottomGap: 12,
  ftPadTop: 21,
  ftLeft: 16,
  ftRight: 18,
}

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

function headerRow(f: Fmt, trophy: boolean): string {
  const dot = `<span style="width:${f.dotMax}px;height:${f.dotMax}px;border-radius:50%;background:${C.bg};place-self:center"></span>`
  const gap = `<span></span>`
  const dice =
    `<div style="width:${f.diceSize}px;height:${f.diceSize}px;border-radius:${f.diceRadius}px;background:${C.lime};display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr 1fr;gap:${f.diceGap}px;padding:${f.dicePad}px;flex:none">` +
    `${dot}${gap}${dot}${gap}${dot}${gap}${dot}${gap}${dot}</div>`
  const wordmark =
    `<div style="display:flex;align-items:baseline;gap:${f.wmGap}px">` +
    `<span style="font-family:'Anton';font-size:${f.wordmark}px;letter-spacing:.02em;color:${C.ink};line-height:1">DRAFT</span>` +
    `<span style="font-family:'Space Mono';font-weight:700;font-size:${f.wm26}px;color:${C.lime};line-height:1">26</span></div>`
  const trophyEl = trophy ? `<div style="font-size:${f.trophy}px;line-height:1">🏆</div>` : ''
  return (
    `<div style="display:flex;align-items:center;justify-content:space-between">` +
    `<div style="display:flex;align-items:center;gap:${f.logoGap}px">${dice}${wordmark}</div>${trophyEl}</div>`
  )
}

function kickerLine(f: Fmt, text: string, accent: string): string {
  return (
    `<div style="display:flex;align-items:center;gap:${f.kGap}px;font-family:'Space Mono';font-weight:700;font-size:${f.kFont}px;letter-spacing:.22em;color:${accent}">` +
    `<span style="width:${f.dashW}px;height:${f.dashH}px;background:${accent};border-radius:2px"></span>${esc(text)}</div>`
  )
}

function statBlock(f: Fmt, title: string, cells: { value: string; label: string }[]): string {
  const cellEls = cells
    .map(
      (c, i) =>
        `<div style="flex:1;text-align:center;padding:${f.sbCellPad};${i > 0 ? `border-left:1px solid ${C.line}` : ''}">` +
        `<div style="font-family:'Anton';font-size:${f.sbVal}px;line-height:.95;color:${C.ink}">${esc(c.value)}</div>` +
        `<div style="font-family:'Space Mono';font-weight:700;font-size:${f.sbLabel}px;letter-spacing:.12em;color:${C.mut};margin-top:${f.sbLabelMt}px">${c.label}</div></div>`,
    )
    .join('')
  return (
    `<div style="background:${C.surface};border:1px solid ${C.line};border-radius:${f.sbRadius}px;padding:${f.sbPad}">` +
    `<div style="font-family:'Space Mono';font-weight:700;font-size:${f.sbTitle}px;letter-spacing:.18em;color:${C.mut};margin:${f.sbTitleMargin}">${title}</div>` +
    `<div style="display:flex">${cellEls}</div></div>`
  )
}

function teamBlock(f: Fmt, d: ShareCardData): string {
  return statBlock(f, 'O TIME', [
    { value: d.formation, label: 'FORMAÇÃO' },
    { value: d.styleLabel, label: 'ESTILO' },
    { value: String(d.countries), label: 'SELEÇÕES' },
    { value: String(d.ovr), label: 'OVR' },
  ])
}

function campaignBlock(f: Fmt, d: ShareCardData): string {
  return statBlock(f, 'CAMPANHA', [
    { value: String(d.jogos), label: 'JOGOS' },
    { value: d.rec, label: 'V-E-D' },
    { value: String(d.gols), label: 'GOLS PRÓ' },
    { value: d.saldo, label: 'SALDO' },
  ])
}

function matchCard(f: Fmt, d: ShareCardData): string {
  const userScoreColor = d.userGoals > d.oppGoals ? C.lime : C.ink
  const left =
    `<div style="text-align:left;min-width:0">` +
    `<div style="font-family:'Space Mono';font-weight:700;font-size:${f.mcLabel}px;letter-spacing:.16em;color:${C.lime};margin-bottom:${f.mcLabelMb}px">SEU XI</div>` +
    `<div style="font-family:'Anton';font-size:${f.mcName}px;letter-spacing:.02em;color:${C.ink};line-height:1">O DRAFT</div></div>`
  const score =
    `<div style="display:flex;align-items:center;gap:${f.mcScoreGap}px;flex:none">` +
    `<span style="font-family:'Anton';font-size:${f.mcScore}px;line-height:.8;color:${userScoreColor}">${d.userGoals}</span>` +
    `<span style="font-family:'Anton';font-size:${f.mcDash}px;color:${C.mut};line-height:.8">—</span>` +
    `<span style="font-family:'Anton';font-size:${f.mcScore}px;line-height:.8;color:${C.ink}">${d.oppGoals}</span></div>`
  const penLine = d.penalties
    ? `<div style="font-family:'Space Mono';font-weight:700;font-size:${f.mcPen}px;color:${C.lime};margin-top:${f.mcPenMt}px">${d.penalties.user}-${d.penalties.opp} pen</div>`
    : ''
  const right =
    `<div style="text-align:right;min-width:0">` +
    `<div style="font-family:'Space Mono';font-weight:700;font-size:${f.mcLabel}px;letter-spacing:.16em;color:${C.mut};margin-bottom:${f.mcLabelMb}px">${d.penalties ? 'PÊNALTIS' : 'ADVERSÁRIO'}</div>` +
    `<div style="font-family:'Anton';font-size:${f.mcName}px;letter-spacing:.02em;color:${C.ink};line-height:1">${esc(d.opp)}</div>${penLine}</div>`
  return (
    `<div style="background:${C.surface};border:1px solid ${C.line};border-radius:${f.mcRadius}px;padding:${f.mcPad};display:flex;align-items:center;justify-content:space-between;gap:${f.mcGap}px">` +
    `${left}${score}${right}</div>`
  )
}

function standingsBlock(f: Fmt, rows: ShareStandingRow[]): string {
  const head =
    `<div style="display:grid;grid-template-columns:${f.stCols};font-family:'Space Mono';font-weight:700;font-size:${f.stHead}px;letter-spacing:.1em;color:${C.mut};padding:${f.stHeadPad}">` +
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
        `<div style="display:grid;grid-template-columns:${f.stCols};align-items:center;background:${rowBg};border-radius:${f.stRowRadius}px;padding:${f.stRowPad};margin-bottom:${f.stRowMb}px">` +
        `<span style="font-family:'Anton';font-size:${f.stNum}px;color:${numColor}">${r.pos}</span>` +
        `<span style="font-family:'Archivo';font-weight:800;font-size:${f.stName}px;color:${nameColor};letter-spacing:.01em">${name}</span>` +
        `<span style="font-family:'Space Mono';font-weight:700;font-size:${f.stCell}px;text-align:center;color:${playedColor}">${r.played}</span>` +
        `<span style="font-family:'Space Mono';font-weight:700;font-size:${f.stCell}px;text-align:center;color:${gdColor}">${fmtGd(r.gd)}</span>` +
        `<span style="font-family:'Anton';font-size:${f.stPts}px;text-align:right;color:${ptsColor}">${r.pts}</span></div>`
      )
    })
    .join('')
  return `<div style="background:${C.surface};border:1px solid ${C.line};border-radius:${f.stRadius}px;padding:${f.stPad}">${head}${body}</div>`
}

/** Bloco de artilheiro — só no champ stories (sizes fixos; square não usa). */
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

function footer(f: Fmt, accent: string): string {
  return (
    `<div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid ${C.line};padding-top:${f.ftPadTop}px">` +
    `<div style="font-family:'Space Mono';font-size:${f.ftLeft}px;letter-spacing:.1em;color:${C.mut}">SIMULADOR DA COPA 2026</div>` +
    `<div style="font-family:'Space Mono';font-weight:700;font-size:${f.ftRight}px;letter-spacing:.04em;color:${accent}">draft-26.pages.dev</div></div>`
  )
}

function frame(f: Fmt, opts: { ring: boolean; bg: string; inner: string }): string {
  const ring = opts.ring
    ? `<div style="position:absolute;inset:${f.ringInset}px;border:1px solid rgba(212,255,61,.28);border-radius:${f.ringRadius}px;pointer-events:none"></div>`
    : ''
  return (
    `<div style="width:${f.w}px;height:${f.h}px;position:relative;overflow:hidden;color:${C.ink};font-family:'Archivo',sans-serif;background:${opts.bg}">` +
    ring +
    `<div style="position:absolute;${f.framePos};display:flex;flex-direction:column;justify-content:space-between">` +
    opts.inner +
    `</div></div>`
  )
}

function col(gap: number, children: string): string {
  return `<div style="display:flex;flex-direction:column;gap:${gap}px">${children}</div>`
}

function headlineWrap(f: Fmt, inner: string): string {
  return `<div style="font-family:'Anton';line-height:${f.hlLh};letter-spacing:.005em">${inner}</div>`
}

// ---------- Cards ----------

function champCard(f: Fmt, d: ShareCardData): string {
  const headline = headlineWrap(
    f,
    `<div style="font-size:${f.hlChamp1}px;color:${C.ink}">SEU XI É</div>` +
      `<div style="font-size:${f.hlChamp2}px;color:${C.lime}">CAMPEÃO DO MUNDO</div>`,
  )
  const middle = col(f.midGap, kickerLine(f, d.kicker, C.lime) + headline + matchCard(f, d))
  // Artilheiro só cabe no stories; o square omite (menos altura).
  const scorer =
    f.format === 'stories' && d.topScorer ? scorerBlock(d.topScorer.name, d.topScorer.goals) : ''
  const bottom = col(f.bottomGap, teamBlock(f, d) + campaignBlock(f, d) + scorer)
  return frame(f, {
    ring: true,
    bg: f.bgChamp,
    inner: headerRow(f, true) + middle + bottom + footer(f, C.lime),
  })
}

function classificadoCard(f: Fmt, d: ShareCardData): string {
  const headline = headlineWrap(
    f,
    `<div style="font-size:${f.hlMain}px;color:${C.lime}">CLASSIFICADO</div>` +
      `<div style="font-family:'Space Mono';font-weight:700;font-size:${f.hlSub}px;letter-spacing:.06em;color:${C.ink};margin-top:${f.hlSubMt}px">${esc(d.positionLine)}</div>`,
  )
  const middle = col(f.midGap, kickerLine(f, d.kicker, C.lime) + headline)
  const bottom = col(
    f.bottomGap,
    (d.standings ? standingsBlock(f, d.standings) : '') + teamBlock(f, d) + campaignBlock(f, d),
  )
  return frame(f, {
    ring: false,
    bg: f.bgDefault,
    inner: headerRow(f, false) + middle + bottom + footer(f, C.lime),
  })
}

function avancouCard(f: Fmt, d: ShareCardData): string {
  const headline = headlineWrap(
    f,
    `<div style="font-size:${f.hlBig}px;color:${C.lime}">${esc(d.headlineText)}</div>`,
  )
  const middle = col(f.midGap, kickerLine(f, d.kicker, C.lime) + headline + matchCard(f, d))
  const bottom = col(f.bottomGap, teamBlock(f, d) + campaignBlock(f, d))
  return frame(f, {
    ring: false,
    bg: f.bgDefault,
    inner: headerRow(f, false) + middle + bottom + footer(f, C.lime),
  })
}

function grupoCard(f: Fmt, d: ShareCardData): string {
  const headline = headlineWrap(
    f,
    `<div style="font-size:${f.hlBig}px;color:${C.lime}">VITÓRIA</div>`,
  )
  const middle = col(f.midGap, kickerLine(f, d.kicker, C.lime) + headline + matchCard(f, d))
  const bottom = col(
    f.bottomGap,
    (d.standings ? standingsBlock(f, d.standings) : '') + teamBlock(f, d),
  )
  return frame(f, {
    ring: false,
    bg: f.bgDefault,
    inner: headerRow(f, false) + middle + bottom + footer(f, C.lime),
  })
}

function eliminadoCard(f: Fmt, d: ShareCardData): string {
  const headline = headlineWrap(
    f,
    `<div style="font-size:${f.hlMain}px;color:${C.red}">FIM DE LINHA</div>`,
  )
  const middle = col(f.midGap, kickerLine(f, d.kicker, C.red) + headline + matchCard(f, d))
  const bottom = col(f.bottomGap, teamBlock(f, d) + campaignBlock(f, d))
  return frame(f, {
    ring: false,
    bg: f.bgElim,
    inner: headerRow(f, false) + middle + bottom + footer(f, C.red),
  })
}

/** Monta o HTML do nó raiz do card a partir dos dados + formato. */
export function cardHtml(d: ShareCardData, format: ShareCardFormat): string {
  const f = format === 'square' ? SQUARE : STORIES
  switch (d.kind) {
    case 'champ':
      return champCard(f, d)
    case 'classificado':
      return classificadoCard(f, d)
    case 'avancou':
      return avancouCard(f, d)
    case 'grupo':
      return grupoCard(f, d)
    case 'eliminado':
      return eliminadoCard(f, d)
  }
}

/** Dimensões do PNG por formato. */
export function cardDimensions(format: ShareCardFormat): { width: number; height: number } {
  const f = format === 'square' ? SQUARE : STORIES
  return { width: f.w, height: f.h }
}
