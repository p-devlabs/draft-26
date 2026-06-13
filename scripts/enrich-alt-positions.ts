/**
 * Refina primaryPosition + altPositions usando dados secundários e curadoria.
 *
 * Pipeline (sempre por jogador):
 *   1. Se já tem primaryPosition do EA FC 26 e altPositions vindas da FIFA,
 *      mantém. (FIFA é a fonte mais confiável; só EXPANDE com bridge heurístico
 *      se a curadoria adicionar mais entradas.)
 *   2. Se ratingSource != 'fifa', tenta promover primaryPosition usando
 *      Transfermarkt sub_position (Centre-Back → CB, Right Winger → RW, etc).
 *      Default heurístico do enrich:fifa (CB/CM/ST) é substituído pelo
 *      sub_position quando disponível e bate com o bucket.
 *   3. Aplica overlay de data/position-overrides.json: { [countryCode]:
 *      { [normalizedName]: { primary?, altsAdd?, altsReplace? } } }.
 *   4. Adiciona bridges heurísticos: LB ↔ LWB+LM, RB ↔ RWB+RM, LM ↔ LW,
 *      RM ↔ RW, CDM ↔ CM, CAM ↔ CM (sem CDM↔CAM nem CB↔CM).
 *
 * Roda DEPOIS de enrich:transfermarkt:
 *   pnpm enrich:alt-positions
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import Papa from 'papaparse'

type Bucket = 'GK' | 'DEF' | 'MID' | 'FWD'
type RatingSource = 'fifa' | 'fifa-fuzzy' | 'tm' | 'club-tier' | 'heuristic'

interface PlayerEnriched {
  shirt: number | null
  position: Bucket
  primaryPosition?: string
  altPositions?: string[]
  name: string
  isCaptain: boolean
  dateOfBirth: string | null
  age: number | null
  caps: number
  goals: number
  club: string
  clubCountry: string | null
  overall: number
  value_eur?: number | null
  value_eur_tm?: number | null
  value_eur_tm_peak?: number | null
  ratingSource?: RatingSource
}

interface SquadEnriched {
  group: string
  country: string
  code: string
  flag: string
  coach: string | null
  formation: { primary: string; alternative: string; source: 'curated' | 'default' }
  players: PlayerEnriched[]
  averageOverall: number
}

interface TmRow {
  name: string
  last_name: string
  country_of_citizenship: string
  date_of_birth: string
  sub_position: string
  position: string
  current_club_name: string
}

// Mesmo mapeamento de nacionalidade usado no enrich:transfermarkt
const WIKI_TO_TM: Record<string, string> = {}

const TM_SUB_TO_GRANULAR: Record<string, string> = {
  Goalkeeper: 'GK',
  'Centre-Back': 'CB',
  'Left-Back': 'LB',
  'Right-Back': 'RB',
  'Defensive Midfield': 'CDM',
  'Central Midfield': 'CM',
  'Attacking Midfield': 'CAM',
  'Left Midfield': 'LM',
  'Right Midfield': 'RM',
  'Left Winger': 'LW',
  'Right Winger': 'RW',
  'Second Striker': 'CF',
  'Centre-Forward': 'ST',
}

const POSITION_BUCKET: Record<string, Bucket> = {
  GK: 'GK',
  CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'FWD', RW: 'FWD', LF: 'FWD', RF: 'FWD', CF: 'FWD', ST: 'FWD',
}

/**
 * Bridges heurísticos: dado uma primaryPosition, quais alt posições são
 * razoáveis de adicionar por DEFAULT (sem confirmação externa).
 * Conservador: só adiciona o que a maioria dos jogadores naquela posição
 * realmente joga em algum momento (lateral também faz ala, ponta também
 * cai pra meia da banda, volante cobre meia central). NÃO adiciona
 * CB→CDM, CAM↔CDM, ST→CAM, etc — exigem caso a caso.
 */
const HEURISTIC_BRIDGES: Record<string, string[]> = {
  LB: ['LWB', 'LM'],
  RB: ['RWB', 'RM'],
  LWB: ['LB', 'LM'],
  RWB: ['RB', 'RM'],
  LM: ['LW'],
  RM: ['RW'],
  LW: ['LM'],
  RW: ['RM'],
  CDM: ['CM'],
  CAM: ['CM'],
  CF: ['ST'],
}

interface OverrideEntry {
  primary?: string
  altsAdd?: string[]
  altsReplace?: string[]
}
type Overrides = Record<string, Record<string, OverrideEntry>>

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[.'`’\-]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function ageFromDob(dob: string): number | null {
  const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const today = new Date('2026-06-11')
  const birth = new Date(`${m[1]}-${m[2]}-${m[3]}`)
  let age = today.getFullYear() - birth.getFullYear()
  const mDiff = today.getMonth() - birth.getMonth()
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) dp[j] = j
  for (let i = 1; i <= m; i++) {
    let prevDiag = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prevDiag + cost)
      prevDiag = tmp
    }
  }
  return dp[n]
}

/** Match nome/clube/idade igual ao enrich:transfermarkt, sem exigir threshold alto. */
function findTmRow(player: PlayerEnriched, candidates: TmRow[]): TmRow | undefined {
  const wantedName = normalize(player.name)
  const wantedClub = normalize(player.club)

  const viable: { row: TmRow; nameScore: number }[] = []
  for (const x of candidates) {
    const n = normalize(x.name)
    const ln = x.last_name ? normalize(x.last_name) : ''
    if (n === wantedName) viable.push({ row: x, nameScore: 100 })
    else if (ln && ln === wantedName) viable.push({ row: x, nameScore: 90 })
    else if (n.includes(wantedName) || wantedName.includes(n)) viable.push({ row: x, nameScore: 70 })
    else {
      const tokens = new Set(n.split(' '))
      const want = wantedName.split(' ').filter((t) => t.length >= 2)
      if (want.length > 0 && want.every((t) => tokens.has(t))) viable.push({ row: x, nameScore: 60 })
    }
  }
  if (viable.length === 0) {
    let best: TmRow | undefined
    let bestDist = Infinity
    for (const x of candidates) {
      const d = levenshtein(wantedName, normalize(x.name))
      if (d < bestDist) { bestDist = d; best = x }
    }
    const threshold = Math.max(2, Math.floor(wantedName.length * 0.15))
    if (best && bestDist <= threshold) viable.push({ row: best, nameScore: 40 })
  }

  let best: { row: TmRow; score: number } | undefined
  for (const v of viable) {
    let score = v.nameScore
    if (wantedClub && normalize(v.row.current_club_name) === wantedClub) score += 30
    else if (
      wantedClub &&
      (normalize(v.row.current_club_name).includes(wantedClub) ||
        wantedClub.includes(normalize(v.row.current_club_name)))
    ) score += 15
    if (player.age != null && v.row.date_of_birth) {
      const tmAge = ageFromDob(v.row.date_of_birth)
      if (tmAge != null && Math.abs(tmAge - player.age) <= 1) score += 10
    }
    if (!best || score > best.score) best = { row: v.row, score }
  }
  return best && best.score >= 50 ? best.row : undefined
}

function dedupePositions(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of list) {
    if (!p) continue
    if (seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

async function main() {
  const root = process.cwd()

  // 1. Carrega squads enriquecidas (saída do enrich:transfermarkt)
  const squads: SquadEnriched[] = JSON.parse(
    await readFile(resolve(root, 'data/squads-enriched.json'), 'utf8'),
  )

  // 2. Carrega TM CSV pra fallback de primaryPosition
  const tmCsv = await readFile(resolve(root, 'data/transfermarkt-players.csv'), 'utf8')
  const { data: tmRows } = Papa.parse<TmRow>(tmCsv, { header: true, skipEmptyLines: true })
  const tmByNat = new Map<string, TmRow[]>()
  for (const r of tmRows) {
    if (!r.country_of_citizenship || !r.sub_position) continue
    if (!tmByNat.has(r.country_of_citizenship)) tmByNat.set(r.country_of_citizenship, [])
    tmByNat.get(r.country_of_citizenship)!.push(r)
  }

  // 3. Carrega overrides curados (opcional). Normaliza as chaves de nome
  // aqui pra que o JSON possa ser editado com nomes humanos.
  let overrides: Overrides = {}
  const overridesPath = resolve(root, 'data/position-overrides.json')
  if (existsSync(overridesPath)) {
    const raw: Overrides = JSON.parse(await readFile(overridesPath, 'utf8'))
    for (const [code, entries] of Object.entries(raw)) {
      overrides[code] = {}
      for (const [name, entry] of Object.entries(entries)) {
        overrides[code][normalize(name)] = entry
      }
    }
  }

  const stats = {
    tmPromoted: 0,           // jogador heurístico ganhou primary granular via TM
    overrideApplied: 0,      // overlay curado mexeu em primary ou alts
    heuristicAltsAdded: 0,   // bridges heurísticos adicionaram >= 1 alt
    playersWithAlts: 0,      // jogadores que terminam com alguma alt
    playersWithoutAlts: 0,
  }

  const sampleTmPromotions: string[] = []
  const sampleOverrides: string[] = []

  for (const squad of squads) {
    const tmCandidates = tmByNat.get(WIKI_TO_TM[squad.country] ?? squad.country) ?? []
    const ovCountry = overrides[squad.code] ?? {}

    for (const player of squad.players) {
      const isHeuristicPrimary =
        player.ratingSource !== 'fifa' && player.ratingSource !== 'fifa-fuzzy'

      // ── Passo A: promover primary via TM sub_position ──────────────
      if (isHeuristicPrimary) {
        const row = findTmRow(player, tmCandidates)
        if (row) {
          const granular = TM_SUB_TO_GRANULAR[row.sub_position]
          if (granular && POSITION_BUCKET[granular] === player.position) {
            const before = player.primaryPosition
            if (before !== granular) {
              player.primaryPosition = granular
              if (sampleTmPromotions.length < 25)
                sampleTmPromotions.push(
                  `${squad.code} ${player.name}: ${before} → ${granular} (TM ${row.sub_position})`,
                )
              stats.tmPromoted++
            }
          }
        }
      }

      // ── Passo B: overlay curado ─────────────────────────────────────
      const key = normalize(player.name)
      const ov = ovCountry[key]
      if (ov) {
        let changed = false
        if (ov.primary && ov.primary !== player.primaryPosition) {
          player.primaryPosition = ov.primary
          changed = true
        }
        if (ov.altsReplace) {
          player.altPositions = dedupePositions(
            ov.altsReplace.filter((p) => p !== player.primaryPosition),
          )
          changed = true
        } else if (ov.altsAdd && ov.altsAdd.length > 0) {
          const base = player.altPositions ?? []
          const merged = dedupePositions([...base, ...ov.altsAdd]).filter(
            (p) => p !== player.primaryPosition,
          )
          if (merged.length !== base.length) {
            player.altPositions = merged
            changed = true
          }
        }
        if (changed) {
          stats.overrideApplied++
          if (sampleOverrides.length < 25)
            sampleOverrides.push(
              `${squad.code} ${player.name}: ${player.primaryPosition} + [${(player.altPositions ?? []).join(',')}]`,
            )
        }
      }

      // ── Passo C: bridges heurísticos ────────────────────────────────
      if (player.primaryPosition && HEURISTIC_BRIDGES[player.primaryPosition]) {
        const base = player.altPositions ?? []
        const bridges = HEURISTIC_BRIDGES[player.primaryPosition]
        const merged = dedupePositions([...base, ...bridges]).filter(
          (p) => p !== player.primaryPosition,
        )
        if (merged.length > base.length) {
          player.altPositions = merged
          stats.heuristicAltsAdded++
        }
      }

      if (player.altPositions && player.altPositions.length > 0) stats.playersWithAlts++
      else stats.playersWithoutAlts++
    }
  }

  await writeFile(
    resolve(root, 'data/squads-enriched.json'),
    JSON.stringify(squads, null, 2),
  )

  console.log('▸ enrich:alt-positions')
  console.log(`▸ primary promovido via TM:        ${stats.tmPromoted}`)
  console.log(`▸ overrides curados aplicados:    ${stats.overrideApplied}`)
  console.log(`▸ alts heurísticos adicionados:   ${stats.heuristicAltsAdded}`)
  console.log(
    `▸ jogadores com alts agora:       ${stats.playersWithAlts} / ${stats.playersWithAlts + stats.playersWithoutAlts}`,
  )

  if (sampleTmPromotions.length > 0) {
    console.log()
    console.log('▸ Amostras de promoções via TM:')
    for (const s of sampleTmPromotions) console.log(`  · ${s}`)
  }
  if (sampleOverrides.length > 0) {
    console.log()
    console.log('▸ Amostras de overrides aplicados:')
    for (const s of sampleOverrides) console.log(`  · ${s}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
