/**
 * Refina public/data/squads-enriched.json com dados de EA FC 26.
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

// Partículas/artigos que não devem ser exigidos no match de tokens.
// Cobre prefixos árabes ("al-"), holandeses ("van", "de"), espanhóis ("de la"),
// portugueses ("dos", "da"), alemães ("von", "zu"), franceses ("le", "du"), etc.
const STOPWORD_TOKENS = new Set([
  'al', 'el', 'bin', 'ibn', 'abu', 'abd',
  'van', 'von', 'der', 'den', 'ter', 'de', 'da', 'do', 'dos', 'das',
  'la', 'le', 'les', 'du', 'di', 'del', 'della', 'lo',
  'mc', 'mac', 'st', 'jr', 'sr', 'ii', 'iii',
])

// Apelidos conhecidos onde o "nome de convocação" da Wikipedia difere muito
// do nome formal usado pela EA FC. Mapeamento normalizado.
// Manter pequeno — só pra casos onde nem prefix-match nem inicial salvam.
const NICKNAMES: Record<string, string[]> = {
  andy: ['andrew'],
  alex: ['alexander', 'alejandro', 'alessandro'],
  chuck: ['charles'],
  jim: ['james'],
  bill: ['william'],
  bob: ['robert'],
  tony: ['anthony', 'antonio'],
  noni: ['chukwunonso'],
  paddy: ['patrick'],
}

interface FifaRow {
  long_name: string
  short_name: string
  player_positions: string
  overall: string
  value_eur: string
  nationality_name: string
  age: string
  club_name: string
}

type Bucket = 'GK' | 'DEF' | 'MID' | 'FWD'
type RatingSource = 'fifa' | 'fifa-fuzzy' | 'heuristic'

interface PlayerEnriched {
  shirt: number | null
  position: Bucket
  primaryPosition?: string // ex: 'GK', 'CB', 'LW', 'ST'
  altPositions?: string[] // ex: ['CF', 'RW']
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

// Mapeia posição FIFA granular pro bucket Wikipedia (GK/DEF/MID/FWD)
const POSITION_BUCKET: Record<string, Bucket> = {
  GK: 'GK',
  CB: 'DEF',
  LB: 'DEF',
  RB: 'DEF',
  LWB: 'DEF',
  RWB: 'DEF',
  CDM: 'MID',
  CM: 'MID',
  CAM: 'MID',
  LM: 'MID',
  RM: 'MID',
  LW: 'FWD',
  RW: 'FWD',
  LF: 'FWD',
  RF: 'FWD',
  CF: 'FWD',
  ST: 'FWD',
}

function fifaBucket(positions: string): Bucket | null {
  const first = positions.split(',')[0]?.trim()
  return first ? (POSITION_BUCKET[first] ?? null) : null
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
    .replace(/[̀-ͯ]/g, '') // tira diacríticos combinantes (faixa explícita)
    .replace(/ø/g, 'o') // ø não decompõe em NFD
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/[.'`’\-]/g, ' ') // pontos e apóstrofos viram espaço
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Norueguês: "Håland" ↔ "Haaland", "Bjørn" ↔ "Bjoern". Gera variantes do nome
// normalizado pra testar contra cada candidato.
function nameVariants(name: string): string[] {
  const v = new Set<string>([name])
  // aa <-> a (Håland → haland; mas Wiki escreve Haaland → haaland)
  if (name.includes('aa')) v.add(name.replace(/aa/g, 'a'))
  if (/(^|[^a])a([^a]|$)/.test(name)) v.add(name.replace(/a/g, 'aa'))
  return [...v]
}

function isStopword(t: string): boolean {
  return STOPWORD_TOKENS.has(t)
}

function nicknameVariants(token: string): string[] {
  return NICKNAMES[token] ?? []
}

/**
 * Token-based match com tolerância a:
 *   - stopwords ("al", "van", "de"...) — não exigidos
 *   - prefix-match ("dayot" casa com "dayotchanculle")
 *   - apelidos ("andy" casa com "andrew" via NICKNAMES)
 *   - inicial ("a" casa com "andy"/"andrew")
 *
 * Wanted token vale se: aparece exato OU é prefix de algum candidato OU
 * algum apelido do wanted aparece OU é uma inicial isolada e o sobrenome
 * do wanted bate exato em algum token candidato.
 */
function tokensMatch(wanted: string, candidate: string): boolean {
  const wantAll = wanted.split(' ').filter((t) => t.length >= 1)
  const want = wantAll.filter((t) => t.length >= 2 && !isStopword(t))
  if (want.length === 0) return false

  const candAll = candidate.split(' ').filter(Boolean)
  const candTokens = new Set(candAll)

  return want.every((t) => {
    if (candTokens.has(t)) return true
    if (t.length >= 3 && candAll.some((c) => c.startsWith(t))) return true
    const nicks = nicknameVariants(t)
    if (nicks.length && candAll.some((c) => nicks.includes(c) || nicks.some((n) => c.startsWith(n))))
      return true
    return false
  })
}

/** Tenta casar "A. Robertson" (short_name) com "Andy Robertson" via inicial+sobrenome. */
function initialPlusSurnameMatch(wanted: string, candidateShort: string): boolean {
  const wantTokens = wanted.split(' ').filter((t) => t.length >= 2 && !isStopword(t))
  if (wantTokens.length < 2) return false
  const surname = wantTokens[wantTokens.length - 1]
  const firstInitial = wantTokens[0][0]
  // candidateShort tipicamente: "a robertson" depois de normalize
  const parts = candidateShort.split(' ').filter(Boolean)
  if (parts.length < 2) return false
  return parts[0] === firstInitial && parts[parts.length - 1] === surname
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
    await readFile(resolve(root, 'public/data/squads-enriched.json'), 'utf8'),
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
      const wantedClub = normalize(player.club)
      const variants = nameVariants(wantedName)

      // 1. Junta TODOS os candidatos viáveis (por nome) sem escolher ainda
      const viable: { row: FifaRow; nameScore: number; isFuzzy: boolean }[] = []

      for (const x of candidates) {
        const ln = normalize(x.long_name)
        const sn = normalize(x.short_name)
        let matched = false
        let nameScore = 0

        for (const v of variants) {
          if (ln === v || sn === v) { nameScore = 100; matched = true; break }
          if (ln.includes(v) || v.includes(ln) || sn.includes(v)) { nameScore = 70; matched = true; break }
          if (tokensMatch(v, ln) || tokensMatch(v, sn)) { nameScore = 60; matched = true; break }
          if (initialPlusSurnameMatch(v, sn)) { nameScore = 55; matched = true; break }
        }

        if (matched) viable.push({ row: x, nameScore, isFuzzy: false })
      }

      // 2. Se nada por nome direto, tenta fuzzy contra long_name e short_name (todas variantes)
      if (viable.length === 0) {
        let best: FifaRow | undefined
        let bestDist = Infinity
        for (const x of candidates) {
          const ln = normalize(x.long_name)
          const sn = normalize(x.short_name)
          for (const v of variants) {
            const d = Math.min(levenshtein(v, ln), levenshtein(v, sn))
            if (d < bestDist) { bestDist = d; best = x }
          }
        }
        const threshold = Math.max(2, Math.floor(wantedName.length * 0.2))
        if (best && bestDist <= threshold) {
          viable.push({ row: best, nameScore: 40, isFuzzy: true })
        }
      }

      // 3. Desambiguação: pra cada viável, soma bônus por bucket/clube/idade
      let bestMatch: { row: FifaRow; isFuzzy: boolean; score: number } | undefined
      for (const v of viable) {
        let score = v.nameScore

        // Bucket de posição: considera TODAS posições FIFA (primary + alt).
        // Penalidade só se NENHUMA delas cai no bucket da Wiki — versáteis tipo
        // Kimmich (CDM, RB, CM → MID + DEF) não são mais mortos pela penalidade.
        const allPositions = v.row.player_positions.split(',').map((s) => s.trim()).filter(Boolean)
        const buckets = new Set(allPositions.map((p) => POSITION_BUCKET[p]).filter(Boolean))
        if (buckets.has(player.position)) score += 50
        else if (buckets.size > 0) score -= 10 // suave (era -30)

        // Clube bate
        if (wantedClub && normalize(v.row.club_name) === wantedClub) score += 30
        else if (
          wantedClub &&
          (normalize(v.row.club_name).includes(wantedClub) ||
            wantedClub.includes(normalize(v.row.club_name)))
        )
          score += 15

        // Idade próxima (±1)
        if (player.age != null && v.row.age) {
          const fifaAge = parseInt(v.row.age, 10)
          if (Math.abs(fifaAge - player.age) <= 1) score += 10
        }

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { row: v.row, isFuzzy: v.isFuzzy, score }
        }
      }

      if (bestMatch && bestMatch.score >= 50) {
        const positions = bestMatch.row.player_positions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        player.overall = parseInt(bestMatch.row.overall, 10)
        player.primaryPosition = positions[0]
        player.altPositions = positions.slice(1)
        const val = parseInt(bestMatch.row.value_eur, 10)
        player.value_eur = Number.isFinite(val) ? val : null
        player.ratingSource = bestMatch.isFuzzy ? 'fifa-fuzzy' : 'fifa'
        if (bestMatch.isFuzzy) stats.fuzzy++
        else stats.matched++
        c.matched++
      } else {
        player.primaryPosition = defaultDetailedPos(player.position)
        player.altPositions = []
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
    resolve(root, 'public/data/squads-enriched.json'),
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
