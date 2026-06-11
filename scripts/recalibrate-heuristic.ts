/**
 * Recalibra o overall dos jogadores que caíram no fallback heurístico,
 * usando valor de mercado do Transfermarkt como sinal primário.
 *
 * Roda DEPOIS de enrich:fifa + enrich:transfermarkt — espera value_eur_tm
 * e value_eur_tm_peak já populados quando existirem.
 *
 * Estratégia:
 *   - ratingSource === 'fifa' | 'fifa-fuzzy': não toca (FIFA é canônico)
 *   - ratingSource === 'heuristic' com TM: nova fórmula baseada em value_eur_tm
 *     (calibrada contra a distribuição observada nos jogadores FIFA-matched),
 *     ajustada por caps (popularidade/experiência) e idade. Vira 'tm'.
 *   - ratingSource === 'heuristic' sem TM: club-tier degradado, cap em 80.
 *     Vira 'club-tier'.
 *
 * Buckets calibrados (observados nos 861 jogadores FIFA com TM):
 *   €100M+  → ovr mediana 89
 *   €50-100M → 84
 *   €30-50M  → 81
 *   €15-30M  → 79
 *   €7-15M   → 76
 *   €3-7M    → 74
 *   €1-3M    → 73
 *   €300k-1M → 69
 *   <€300k   → 65
 *
 * Uso: pnpm recalibrate:heuristic
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type Bucket = 'GK' | 'DEF' | 'MID' | 'FWD'
type RatingSource = 'fifa' | 'fifa-fuzzy' | 'tm' | 'club-tier' | 'heuristic'

interface Player {
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

interface Squad {
  group: string
  country: string
  code: string
  flag: string
  coach: string | null
  formation: { primary: string; alternative: string; source: 'curated' | 'default' }
  players: Player[]
  averageOverall: number
}

// Club tiers degradados (usados só pra quem não tem TM).
// Bases mais baixas que enrich-squads.ts porque aqui o teto é 80.
const CLUB_TIERS: { tier: number; base: number; clubs: string[] }[] = [
  {
    tier: 1,
    base: 74,
    clubs: [
      'real madrid', 'barcelona', 'manchester city', 'arsenal', 'liverpool',
      'bayern munich', 'paris saint-germain', 'inter milan', 'inter ',
      'atlético madrid', 'atletico madrid', 'chelsea', 'manchester united',
      'milan', 'tottenham',
    ],
  },
  {
    tier: 2,
    base: 70,
    clubs: [
      'al-nassr', 'al nassr', 'al-hilal', 'al hilal', 'al-ittihad', 'al ittihad',
      'al-ahli', 'al ahli', 'al-shabab',
      'newcastle', 'aston villa', 'borussia dortmund', 'bayer leverkusen',
      'rb leipzig', 'leipzig', 'juventus', 'napoli', 'roma', 'lazio', 'atalanta',
      'marseille', 'olympique lyonnais', 'lyon', 'monaco', 'lille',
      'athletic', 'real sociedad', 'real betis', 'sevilla', 'villarreal', 'valencia',
      'benfica', 'porto', 'sporting',
      'ajax', 'psv', 'feyenoord',
      'galatasaray', 'fenerbahçe', 'fenerbahce', 'beşiktaş', 'besiktas',
      'celtic', 'rangers', 'inter miami',
    ],
  },
  {
    tier: 3,
    base: 66,
    clubs: [
      'brighton', 'brentford', 'west ham', 'crystal palace', 'wolves', 'wolverhampton',
      'bournemouth', 'everton', 'fulham',
      'eintracht frankfurt', 'wolfsburg', 'hoffenheim', 'mainz', 'stuttgart',
      'freiburg', 'union berlin', 'mönchengladbach', 'borussia mönchengladbach', 'köln',
      'bologna', 'fiorentina', 'udinese', 'torino', 'genoa', 'verona', 'parma',
      'strasbourg', 'rennes', 'nice', 'nantes', 'toulouse', 'reims', 'lens', 'brest',
      'flamengo', 'palmeiras', 'corinthians', 'são paulo', 'sao paulo',
      'atlético mineiro', 'atletico mineiro', 'fluminense', 'botafogo',
      'grêmio', 'gremio', 'internacional',
      'boca juniors', 'river plate', 'racing', 'independiente',
      'club américa', 'club america', 'tigres', 'monterrey', 'guadalajara',
      'pumas', 'cruz azul', 'lafc', 'los angeles fc', 'la galaxy', 'seattle',
      'shanghai', 'urawa', 'kashima', 'yokohama', 'al-duhail', 'al sadd',
    ],
  },
]

const DEFAULT_TIER_BASE = 60

function clubBase(club: string): number {
  const c = (club ?? '').toLowerCase()
  for (const tier of CLUB_TIERS) {
    if (tier.clubs.some((n) => c.includes(n))) return tier.base
  }
  return DEFAULT_TIER_BASE
}

/**
 * Valor de referência: combina o atual (refletindo "agora") com o pico
 * (preservando "fama histórica"). Peso 0.6 no pico evita que Neymar com €15M
 * atual seja tratado como jovem €15M.
 */
function referenceValue(cur: number | null | undefined, peak: number | null | undefined): number {
  const c = cur ?? 0
  const p = (peak ?? 0) * 0.6
  return Math.max(c, p)
}

function tmBaseOverall(refValue: number): number {
  if (refValue >= 100_000_000) return 88
  if (refValue >= 50_000_000) return 84
  if (refValue >= 30_000_000) return 81
  if (refValue >= 15_000_000) return 79
  if (refValue >= 7_000_000) return 76
  if (refValue >= 3_000_000) return 73
  if (refValue >= 1_000_000) return 71
  if (refValue >= 300_000) return 68
  return 64
}

function capsModifier(caps: number): number {
  // popularidade/experiência internacional: stars veteranos têm muitos caps
  if (caps >= 100) return 2
  if (caps >= 50) return 1
  if (caps < 5) return -1
  return 0
}

function ageModifier(age: number | null): number {
  if (age == null) return 0
  if (age >= 35) return -2
  if (age >= 33) return -1
  if (age <= 18) return -2
  if (age <= 20) return -1
  return 0
}

function captainBonus(isCaptain: boolean): number {
  return isCaptain ? 1 : 0
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function overallFromTm(p: Player): number {
  const ref = referenceValue(p.value_eur_tm, p.value_eur_tm_peak)
  const base = tmBaseOverall(ref)
  const mod = capsModifier(p.caps) + ageModifier(p.age) + captainBonus(p.isCaptain)
  return clamp(base + mod, 50, 88)
}

function overallFromClubTier(p: Player): number {
  const base = clubBase(p.club)
  let mod = 0
  // caps com sinal mais forte aqui (única evidência além do clube)
  if (p.caps >= 50) mod += 4
  else if (p.caps >= 20) mod += 2
  else if (p.caps >= 10) mod += 1
  else if (p.caps < 5) mod -= 2
  if (p.age != null) {
    if (p.age < 22) mod -= 2
    else if (p.age <= 30) mod += 1
    else if (p.age >= 34) mod -= 2
  }
  if (p.isCaptain) mod += 1
  return clamp(base + mod, 50, 80)
}

async function main() {
  const root = process.cwd()
  const squads: Squad[] = JSON.parse(
    await readFile(resolve(root, 'data/squads-enriched.json'), 'utf8'),
  )

  let touchedTm = 0
  let touchedClub = 0
  const before: number[] = []
  const after: number[] = []
  const changes: Array<{ name: string; country: string; before: number; after: number; src: string }> = []

  for (const squad of squads) {
    for (const player of squad.players) {
      if (player.ratingSource === 'fifa' || player.ratingSource === 'fifa-fuzzy') continue

      const prev = player.overall
      const hasTm = (player.value_eur_tm ?? 0) > 0 || (player.value_eur_tm_peak ?? 0) > 0

      if (hasTm) {
        player.overall = overallFromTm(player)
        player.ratingSource = 'tm'
        touchedTm++
      } else {
        player.overall = overallFromClubTier(player)
        player.ratingSource = 'club-tier'
        touchedClub++
      }

      before.push(prev)
      after.push(player.overall)
      if (Math.abs(player.overall - prev) >= 5) {
        changes.push({
          name: player.name,
          country: squad.country,
          before: prev,
          after: player.overall,
          src: player.ratingSource,
        })
      }
    }

    squad.averageOverall =
      Math.round((squad.players.reduce((s, p) => s + p.overall, 0) / squad.players.length) * 10) /
      10
  }

  await writeFile(
    resolve(root, 'data/squads-enriched.json'),
    JSON.stringify(squads, null, 2),
  )

  const mean = (a: number[]) =>
    a.length ? Math.round((a.reduce((s, v) => s + v, 0) / a.length) * 10) / 10 : 0

  console.log(`▸ Recalibrados via Transfermarkt: ${touchedTm}`)
  console.log(`▸ Recalibrados via club-tier (sem TM): ${touchedClub}`)
  console.log(`▸ Média overall ANTES: ${mean(before)}  → DEPOIS: ${mean(after)}`)
  console.log()

  const topMoves = changes.sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before)).slice(0, 25)
  console.log('▸ Maiores ajustes (Δ >= 5):')
  for (const c of topMoves) {
    const delta = c.after - c.before
    const arrow = delta > 0 ? '↑' : '↓'
    console.log(
      `  ${arrow} ${c.before}→${c.after} (${delta > 0 ? '+' : ''}${delta})  ${c.name.padEnd(28)}  ${c.country.padEnd(16)} via ${c.src}`,
    )
  }
  console.log()

  const top10 = [...squads].sort((a, b) => b.averageOverall - a.averageOverall).slice(0, 10)
  console.log('▸ Top 10 por averageOverall (após recalibração):')
  for (const s of top10) {
    console.log(`  ${s.code}  ${s.country.padEnd(22)}  ${s.averageOverall.toFixed(1)}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
