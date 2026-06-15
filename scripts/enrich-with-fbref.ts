/**
 * Anexa stats da temporada 2025-26 do FBref (Top 5 ligas) aos jogadores
 * do squads-enriched.json. NÃO altera overall ainda — só adiciona dados.
 *
 * O calibrate-from-fbref.ts depois usa essas stats pra:
 *   1. Treinar regressão `overall ~ f(stats, age, position)` nos jogadores
 *      FIFA-matched (~580 deles também estão no FBref Top 5);
 *   2. Aplicar essa regressão pros jogadores sem FIFA mas com FBref stats.
 *
 * Match strategy: nation (3-letter code) → tokens-match nome → desambigua
 * por (clube ~ FBref Squad, idade ±1). Threshold conservador — preferimos
 * miss a um match errado, porque rating é load-bearing.
 *
 * 4 das 48 seleções não têm ninguém no Top 5 (QAT, CUW, IRN, IRQ).
 *
 * Roda DEPOIS de enrich:transfermarkt + enrich:alt-positions. Uso:
 *   pnpm download:fbref && pnpm enrich:fbref
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import Papa from 'papaparse'

interface FbrefRow {
  Player: string
  Nation: string // "es ESP", "fr FRA", etc
  Pos: string // "MF,FW" — primeira é principal
  Squad: string
  Comp: string
  Age: string // "24.0" às vezes vazio
  Born: string
  MP: string
  Starts: string
  Min: string
  '90s': string
  Gls: string
  Ast: string
  'G+A': string
  'G-PK': string
  PK: string
  PKatt: string
  CrdY: string
  CrdR: string
  Sh: string
  SoT: string
  'Sh/90': string
  'SoT/90': string
  Crs: string
  TklW: string
  Int: string
  // Goleiro
  GA: string
  GA90: string
  Saves: string
  'Save%': string
  CS: string
  'CS%': string
}

interface PlayerEnriched {
  shirt: number | null
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
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
  ratingSource?: string
  fbref?: FbrefStats
}

/** Stats da temporada normalizadas — todas per-90 quando faz sentido. */
export interface FbrefStats {
  squad: string
  comp: string
  minutes90: number // 90s — quantos jogos completos equivalentes
  // Per-jogo
  goalsPer90: number
  assistsPer90: number
  shotsPer90: number
  shotsOnTargetPer90: number
  // Defesa per-90
  tacklesWonPer90: number
  interceptionsPer90: number
  // Discipline per-90
  yellowsPer90: number
  redsPer90: number
  // Goleiro só
  isKeeper: boolean
  savePercent: number | null
  cleanSheetPercent: number | null
  gaPer90: number | null
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

/** Extrai o código de 3 letras do final do "xx YYY". */
function extractNationCode(nation: string): string | null {
  if (!nation) return null
  const parts = nation.trim().split(/\s+/)
  return parts[parts.length - 1] ?? null
}

function tokensMatch(wanted: string, candidate: string): boolean {
  const want = wanted.split(' ').filter((t) => t.length >= 2)
  if (want.length === 0) return false
  const tokens = new Set(candidate.split(' '))
  return want.every((t) => tokens.has(t) || [...tokens].some((c) => c.startsWith(t) || t.startsWith(c)))
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

function num(s: string): number {
  if (!s || s === '') return 0
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function maybeNum(s: string): number | null {
  if (!s || s === '') return null
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function rowToStats(row: FbrefRow): FbrefStats {
  const minutes90 = num(row['90s'])
  const safe = (per90: number) => (minutes90 > 0 ? per90 / minutes90 : 0)
  // Detecta goleiro pelo Pos do FBref (GK) — não nosso bucket.
  const isKeeper = (row.Pos || '').toUpperCase().startsWith('GK')
  return {
    squad: row.Squad,
    comp: row.Comp,
    minutes90,
    goalsPer90: safe(num(row.Gls)),
    assistsPer90: safe(num(row.Ast)),
    shotsPer90: num(row['Sh/90']) || safe(num(row.Sh)),
    shotsOnTargetPer90: num(row['SoT/90']) || safe(num(row.SoT)),
    tacklesWonPer90: safe(num(row.TklW)),
    interceptionsPer90: safe(num(row.Int)),
    yellowsPer90: safe(num(row.CrdY)),
    redsPer90: safe(num(row.CrdR)),
    isKeeper,
    savePercent: isKeeper ? maybeNum(row['Save%']) : null,
    cleanSheetPercent: isKeeper ? maybeNum(row['CS%']) : null,
    gaPer90: isKeeper ? maybeNum(row.GA90) : null,
  }
}

async function main() {
  const root = process.cwd()
  const csv = await readFile(resolve(root, 'data/fbref-players.csv'), 'utf8')
  const parsed = Papa.parse<FbrefRow>(csv, { header: true, skipEmptyLines: true })
  const fbref = parsed.data.filter((r) => r.Player && r.Nation)

  const byNationCode = new Map<string, FbrefRow[]>()
  for (const r of fbref) {
    const code = extractNationCode(r.Nation)
    if (!code) continue
    if (!byNationCode.has(code)) byNationCode.set(code, [])
    byNationCode.get(code)!.push(r)
  }

  const squads: SquadEnriched[] = JSON.parse(
    await readFile(resolve(root, 'data/squads-enriched.json'), 'utf8'),
  )

  const stats = {
    matched: 0,
    matchedNonFifa: 0,
    notFound: 0,
    nationMissing: 0,
  }
  const sampleMatches: string[] = []
  const sampleMisses: string[] = []

  for (const squad of squads) {
    const candidates = byNationCode.get(squad.code) ?? []
    if (candidates.length === 0) {
      stats.nationMissing += squad.players.length
      continue
    }

    for (const player of squad.players) {
      const wantedName = normalize(player.name)
      const wantedClub = normalize(player.club)

      // 1. coleta candidatos por nome
      const viable: { row: FbrefRow; nameScore: number }[] = []
      for (const x of candidates) {
        const n = normalize(x.Player)
        if (n === wantedName) viable.push({ row: x, nameScore: 100 })
        else if (n.includes(wantedName) || wantedName.includes(n)) viable.push({ row: x, nameScore: 70 })
        else if (tokensMatch(wantedName, n)) viable.push({ row: x, nameScore: 60 })
      }

      // 2. fallback fuzzy
      if (viable.length === 0) {
        let best: FbrefRow | undefined
        let bestDist = Infinity
        for (const x of candidates) {
          const d = levenshtein(wantedName, normalize(x.Player))
          if (d < bestDist) { bestDist = d; best = x }
        }
        const threshold = Math.max(2, Math.floor(wantedName.length * 0.15))
        if (best && bestDist <= threshold) viable.push({ row: best, nameScore: 40 })
      }

      // 3. desambigua por clube + idade
      let bestMatch: { row: FbrefRow; score: number } | undefined
      for (const v of viable) {
        let score = v.nameScore
        if (wantedClub && normalize(v.row.Squad) === wantedClub) score += 30
        else if (
          wantedClub &&
          (normalize(v.row.Squad).includes(wantedClub) || wantedClub.includes(normalize(v.row.Squad)))
        ) score += 15
        if (player.age != null && v.row.Age) {
          const fbAge = parseFloat(v.row.Age)
          if (Number.isFinite(fbAge) && Math.abs(fbAge - player.age) <= 1) score += 10
        }
        if (!bestMatch || score > bestMatch.score) bestMatch = { row: v.row, score }
      }

      if (bestMatch && bestMatch.score >= 60) {
        player.fbref = rowToStats(bestMatch.row)
        stats.matched++
        if (player.ratingSource !== 'fifa' && player.ratingSource !== 'fifa-fuzzy') {
          stats.matchedNonFifa++
        }
        if (sampleMatches.length < 12) {
          sampleMatches.push(
            `${squad.code} ${player.name} → ${bestMatch.row.Player} @ ${bestMatch.row.Squad} (${bestMatch.score})`,
          )
        }
      } else {
        stats.notFound++
        if (
          sampleMisses.length < 8 &&
          player.ratingSource !== 'fifa' &&
          player.ratingSource !== 'fifa-fuzzy'
        ) {
          sampleMisses.push(`${squad.code} ${player.name} (${player.club})`)
        }
      }
    }
  }

  await writeFile(
    resolve(root, 'data/squads-enriched.json'),
    JSON.stringify(squads, null, 2),
  )

  const total = stats.matched + stats.notFound + stats.nationMissing
  console.log('▸ enrich:fbref')
  console.log(`▸ Total jogadores:               ${total}`)
  console.log(`▸ FBref match:                   ${stats.matched}`)
  console.log(`  └ desses, sem FIFA antes:      ${stats.matchedNonFifa}`)
  console.log(`▸ Não encontrado (Top 5):        ${stats.notFound}`)
  console.log(`▸ Seleção sem ninguém no Top 5:  ${stats.nationMissing} (QAT/CUW/IRN/IRQ)`)
  if (sampleMatches.length > 0) {
    console.log()
    console.log('▸ Amostra de matches:')
    for (const m of sampleMatches) console.log(`  · ${m}`)
  }
  if (sampleMisses.length > 0) {
    console.log()
    console.log('▸ Amostra de misses úteis (heurísticos que ficariam melhor com FBref):')
    for (const m of sampleMisses) console.log(`  · ${m}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
