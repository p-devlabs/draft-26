/**
 * Adiciona valor de mercado do Transfermarkt SEM sobrescrever o do EA FC.
 *
 * Campos adicionados em cada player:
 *   value_eur_tm       — market_value_in_eur atual (Transfermarkt)
 *   value_eur_tm_peak  — highest_market_value_in_eur (pico histórico)
 *
 * Match strategy: igual ao do enrich-with-fifa.ts (nome + nacionalidade,
 * desambiguação por bucket posicional + clube + idade).
 *
 * Roda DEPOIS de enrich:fifa (não invalida os campos do FIFA).
 *
 * Uso: pnpm enrich:transfermarkt
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import Papa from 'papaparse'

const WIKI_TO_TM: Record<string, string> = {
  // O dataset usa nomes em inglês padrão. Mismatches conhecidos:
  // (nenhum identificado no sample inicial — adicione conforme aparecerem misses)
}

interface TmRow {
  player_id: string
  name: string
  first_name: string
  last_name: string
  country_of_citizenship: string
  date_of_birth: string
  position: string
  sub_position: string
  current_club_name: string
  market_value_in_eur: string
  highest_market_value_in_eur: string
}

type Bucket = 'GK' | 'DEF' | 'MID' | 'FWD'

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
  ratingSource?: 'fifa' | 'fifa-fuzzy' | 'heuristic'
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

const TM_POSITION_BUCKET: Record<string, Bucket> = {
  Goalkeeper: 'GK',
  Defender: 'DEF',
  Midfield: 'MID',
  Attack: 'FWD',
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.'`’\-]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokensMatch(wanted: string, candidate: string): boolean {
  const want = wanted.split(' ').filter((t) => t.length >= 2)
  if (want.length === 0) return false
  const tokens = new Set(candidate.split(' '))
  return want.every((t) => tokens.has(t))
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
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

function ageFromDob(dob: string): number | null {
  // formato "1992-10-02 00:00:00"
  const m = dob.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const today = new Date('2026-06-11') // congela em uma data — a Copa de 2026 começa em junho
  const birth = new Date(`${m[1]}-${m[2]}-${m[3]}`)
  let age = today.getFullYear() - birth.getFullYear()
  const mDiff = today.getMonth() - birth.getMonth()
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--
  return age
}

async function main() {
  const root = process.cwd()
  const csv = await readFile(resolve(root, 'data/transfermarkt-players.csv'), 'utf8')
  const { data: rows } = Papa.parse<TmRow>(csv, { header: true, skipEmptyLines: true })
  const players = rows.filter(
    (r) => r.name && r.country_of_citizenship && r.market_value_in_eur,
  )

  const byNationality = new Map<string, TmRow[]>()
  for (const p of players) {
    if (!byNationality.has(p.country_of_citizenship))
      byNationality.set(p.country_of_citizenship, [])
    byNationality.get(p.country_of_citizenship)!.push(p)
  }

  const squads: SquadEnriched[] = JSON.parse(
    await readFile(resolve(root, 'public/data/squads-enriched.json'), 'utf8'),
  )

  const stats = { matched: 0, fuzzy: 0, missed: 0 }
  const missedSamples: string[] = []

  for (const squad of squads) {
    const tmNat = WIKI_TO_TM[squad.country] ?? squad.country
    const candidates = byNationality.get(tmNat) ?? []

    for (const player of squad.players) {
      const wantedName = normalize(player.name)
      const wantedClub = normalize(player.club)

      const viable: { row: TmRow; nameScore: number; isFuzzy: boolean }[] = []
      for (const x of candidates) {
        const n = normalize(x.name)
        const ln = x.last_name ? normalize(x.last_name) : ''

        if (n === wantedName) viable.push({ row: x, nameScore: 100, isFuzzy: false })
        else if (ln && ln === wantedName) viable.push({ row: x, nameScore: 90, isFuzzy: false })
        else if (n.includes(wantedName) || wantedName.includes(n))
          viable.push({ row: x, nameScore: 70, isFuzzy: false })
        else if (tokensMatch(wantedName, n))
          viable.push({ row: x, nameScore: 60, isFuzzy: false })
      }

      if (viable.length === 0) {
        let best: TmRow | undefined
        let bestDist = Infinity
        for (const x of candidates) {
          const d = levenshtein(wantedName, normalize(x.name))
          if (d < bestDist) {
            bestDist = d
            best = x
          }
        }
        const threshold = Math.max(2, Math.floor(wantedName.length * 0.15))
        if (best && bestDist <= threshold) viable.push({ row: best, nameScore: 40, isFuzzy: true })
      }

      let bestMatch: { row: TmRow; isFuzzy: boolean; score: number } | undefined
      for (const v of viable) {
        let score = v.nameScore

        const bucket = TM_POSITION_BUCKET[v.row.position]
        if (bucket === player.position) score += 50
        else if (bucket && bucket !== player.position) score -= 30

        if (wantedClub && normalize(v.row.current_club_name) === wantedClub) score += 30
        else if (
          wantedClub &&
          (normalize(v.row.current_club_name).includes(wantedClub) ||
            wantedClub.includes(normalize(v.row.current_club_name)))
        )
          score += 15

        if (player.age != null && v.row.date_of_birth) {
          const tmAge = ageFromDob(v.row.date_of_birth)
          if (tmAge != null && Math.abs(tmAge - player.age) <= 1) score += 10
        }

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { row: v.row, isFuzzy: v.isFuzzy, score }
        }
      }

      if (bestMatch && bestMatch.score >= 50) {
        const cur = parseInt(bestMatch.row.market_value_in_eur, 10)
        const peak = parseInt(bestMatch.row.highest_market_value_in_eur, 10)
        player.value_eur_tm = Number.isFinite(cur) && cur > 0 ? cur : null
        player.value_eur_tm_peak = Number.isFinite(peak) && peak > 0 ? peak : null
        if (bestMatch.isFuzzy) stats.fuzzy++
        else stats.matched++
      } else {
        player.value_eur_tm = null
        player.value_eur_tm_peak = null
        stats.missed++
        if (missedSamples.length < 20) missedSamples.push(`${squad.country}: ${player.name}`)
      }
    }
  }

  await writeFile(
    resolve(root, 'public/data/squads-enriched.json'),
    JSON.stringify(squads, null, 2),
  )

  const total = stats.matched + stats.fuzzy + stats.missed
  console.log(`▸ Transfermarkt enrichment`)
  console.log(`▸ Total jogadores: ${total}`)
  console.log(`▸ TM exact match: ${stats.matched}  (${pct(stats.matched, total)})`)
  console.log(`▸ TM fuzzy match: ${stats.fuzzy}    (${pct(stats.fuzzy, total)})`)
  console.log(`▸ TM missed:     ${stats.missed}  (${pct(stats.missed, total)})`)

  if (missedSamples.length > 0) {
    console.log()
    console.log('▸ Amostras de jogadores sem valor TM:')
    for (const m of missedSamples) console.log(`  · ${m}`)
  }
}

function pct(n: number, total: number) {
  return `${((n / total) * 100).toFixed(1)}%`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
