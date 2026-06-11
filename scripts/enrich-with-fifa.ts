/**
 * Refina data/squads-enriched.json com dados de EA FC 26.
 *
 * Substitui o overall heurístico por overall FIFA quando consegue match,
 * adiciona positions granulares ("CB, LB" estilo FIFA) e valor de mercado.
 *
 * Match strategy, por jogador:
 *   1. exact normalized long_name
 *   2. exact normalized short_name
 *   3. containment (FIFA name contains wiki name ou vice-versa)
 *   4. Levenshtein <= 2 (ou 15% do tamanho) — marcado como `fifa-fuzzy`
 *   5. fallback: mantém heurística, marca `heuristic`
 *
 * Fonte do CSV: github.com/ismailoksuz/EAFC26-DataHub (scrape de sofifa.com)
 *
 * Uso: pnpm enrich:fifa
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import Papa from 'papaparse'

// Nomes que diferem entre Wikipedia (convocações) e dataset FIFA
const WIKI_TO_FIFA: Record<string, string> = {
  'Cape Verde': 'Cabo Verde',
  Curaçao: 'Curacao',
  'Czech Republic': 'Czechia',
  'DR Congo': 'Congo DR',
  'Ivory Coast': "Côte d'Ivoire",
  'South Korea': 'Korea Republic',
  Turkey: 'Türkiye',
}

interface FifaRow {
  long_name: string
  short_name: string
  player_positions: string
  overall: string
  value_eur: string
  nationality_name: string
  age: string
}

type RatingSource = 'fifa' | 'fifa-fuzzy' | 'heuristic'

interface PlayerEnriched {
  shirt: number | null
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  positions?: string[]
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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira diacríticos combinantes
    .replace(/[.'`’\-]/g, ' ') // pontos e apóstrofos viram espaço (E. Álvarez → e alvarez)
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// "todos os tokens do nome desejado aparecem no nome FIFA" — pega
// "edson alvarez" dentro de "edson omar alvarez velazquez"
function tokensMatch(wanted: string, candidate: string): boolean {
  const want = wanted.split(' ').filter((t) => t.length >= 2)
  if (want.length === 0) return false
  const candTokens = new Set(candidate.split(' '))
  return want.every((t) => candTokens.has(t))
}

// Levenshtein distância — O(m*n) com array linear
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

function defaultDetailedPos(p: PlayerEnriched['position']): string {
  return { GK: 'GK', DEF: 'CB', MID: 'CM', FWD: 'ST' }[p]
}

async function main() {
  const root = process.cwd()
  const csv = await readFile(resolve(root, 'data/eafc26-players.csv'), 'utf8')
  const parsed = Papa.parse<FifaRow>(csv, { header: true, skipEmptyLines: true })
  const fifa = parsed.data.filter((r) => r.long_name && r.overall && r.nationality_name)

  // Index por nacionalidade pra restringir o espaço de busca
  const byNationality = new Map<string, FifaRow[]>()
  for (const p of fifa) {
    if (!byNationality.has(p.nationality_name)) byNationality.set(p.nationality_name, [])
    byNationality.get(p.nationality_name)!.push(p)
  }

  const squads: SquadEnriched[] = JSON.parse(
    await readFile(resolve(root, 'data/squads-enriched.json'), 'utf8'),
  )

  const stats = { matched: 0, fuzzy: 0, missed: 0 }
  const missedSamples: string[] = []
  const countryStats: { country: string; matched: number; missed: number }[] = []

  for (const squad of squads) {
    const fifaNat = WIKI_TO_FIFA[squad.country] ?? squad.country
    const candidates = byNationality.get(fifaNat) ?? []

    const c = { country: squad.country, matched: 0, missed: 0 }

    for (const player of squad.players) {
      const wantedName = normalize(player.name)
      let match: FifaRow | undefined
      let isFuzzy = false

      // 1. exact long_name
      match = candidates.find((x) => normalize(x.long_name) === wantedName)

      // 2. exact short_name
      if (!match) match = candidates.find((x) => normalize(x.short_name) === wantedName)

      // 3. containment (qualquer direção)
      if (!match) {
        match = candidates.find((x) => {
          const ln = normalize(x.long_name)
          const sn = normalize(x.short_name)
          return ln.includes(wantedName) || wantedName.includes(ln) || sn.includes(wantedName)
        })
      }

      // 3.5 token-based: todos tokens do nome wiki batem no long_name
      if (!match) {
        match = candidates.find((x) => tokensMatch(wantedName, normalize(x.long_name)))
      }

      // 4. fuzzy Levenshtein
      if (!match) {
        let best: FifaRow | undefined
        let bestDist = Infinity
        for (const x of candidates) {
          const d = Math.min(
            levenshtein(wantedName, normalize(x.long_name)),
            levenshtein(wantedName, normalize(x.short_name)),
          )
          if (d < bestDist) {
            bestDist = d
            best = x
          }
        }
        // tolerância: 2 chars ou 15% do nome, o que for maior
        const threshold = Math.max(2, Math.floor(wantedName.length * 0.15))
        if (best && bestDist <= threshold) {
          match = best
          isFuzzy = true
        }
      }

      if (match) {
        player.overall = parseInt(match.overall, 10)
        player.positions = match.player_positions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        const val = parseInt(match.value_eur, 10)
        player.value_eur = Number.isFinite(val) ? val : null
        player.ratingSource = isFuzzy ? 'fifa-fuzzy' : 'fifa'
        if (isFuzzy) stats.fuzzy++
        else stats.matched++
        c.matched++
      } else {
        player.positions = [defaultDetailedPos(player.position)]
        player.value_eur = null
        player.ratingSource = 'heuristic'
        stats.missed++
        c.missed++
        if (missedSamples.length < 25) missedSamples.push(`${squad.country}: ${player.name}`)
      }
    }

    // recalcular média
    squad.averageOverall =
      Math.round((squad.players.reduce((s, p) => s + p.overall, 0) / squad.players.length) * 10) /
      10
    countryStats.push(c)
  }

  await writeFile(
    resolve(root, 'data/squads-enriched.json'),
    JSON.stringify(squads, null, 2),
  )

  const total = stats.matched + stats.fuzzy + stats.missed
  console.log(`▸ Total jogadores: ${total}`)
  console.log(`▸ FIFA exact match: ${stats.matched}  (${pct(stats.matched, total)})`)
  console.log(`▸ FIFA fuzzy match: ${stats.fuzzy}    (${pct(stats.fuzzy, total)})`)
  console.log(`▸ Heuristic fallback: ${stats.missed}  (${pct(stats.missed, total)})`)
  console.log()

  // Top 10 by averageOverall após refinamento
  const top10 = [...squads].sort((a, b) => b.averageOverall - a.averageOverall).slice(0, 10)
  console.log('▸ Top 10 por averageOverall (refinado):')
  for (const s of top10) {
    console.log(`  ${s.code}  ${s.country.padEnd(22)}  ${s.averageOverall.toFixed(1)}`)
  }
  console.log()

  // Países com mais missed
  const worst = countryStats.filter((c) => c.missed > 0).sort((a, b) => b.missed - a.missed)
  if (worst.length > 0) {
    console.log('▸ Países com jogadores não encontrados:')
    for (const c of worst.slice(0, 15)) {
      console.log(`  ${c.country.padEnd(22)}  ${c.matched} match / ${c.missed} missed`)
    }
  }

  if (missedSamples.length > 0) {
    console.log()
    console.log('▸ Amostras de jogadores que caíram no fallback heurístico:')
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
