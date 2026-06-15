/**
 * Enriquece data/squads.json com:
 *  - código ISO-3 do país + emoji da bandeira
 *  - overall heurístico (40-99) por jogador
 *  - formação primária e alternativa do time
 *
 * Lê:  data/squads.json + data/tactics.json + data/country-codes.json
 * Escreve: public/data/squads-enriched.json
 *
 * Uso: pnpm enrich:squads
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

interface ScrapedPlayer {
  shirt: number | null
  position: Position
  name: string
  isCaptain: boolean
  dateOfBirth: string | null
  age: number | null
  caps: number
  goals: number
  club: string
  clubCountry: string | null
}

interface ScrapedSquad {
  group: string
  country: string
  coach: string | null
  players: ScrapedPlayer[]
}

interface EnrichedPlayer extends ScrapedPlayer {
  overall: number
}

interface EnrichedSquad extends ScrapedSquad {
  code: string
  flag: string
  formation: { primary: string; alternative: string; source: 'curated' | 'default' }
  players: EnrichedPlayer[]
  averageOverall: number
}

// ─── Tiers de clube (overall base) ─────────────────────────────────────────

// Match por substring (lowercase). Primeiro tier que casa vence.
const CLUB_TIERS: { tier: number; base: number; clubs: string[] }[] = [
  {
    tier: 1,
    base: 88,
    clubs: [
      'real madrid',
      'barcelona',
      'manchester city',
      'arsenal',
      'liverpool',
      'bayern munich',
      'paris saint-germain',
      'inter milan',
      'inter ',
      'atlético madrid',
      'atletico madrid',
      'chelsea',
      'manchester united',
      'milan',
      'al-nassr',
      'al nassr',
      'al-hilal',
      'al hilal',
      'al-ittihad',
      'al ittihad',
      'tottenham',
    ],
  },
  {
    tier: 2,
    base: 82,
    clubs: [
      'newcastle',
      'aston villa',
      'borussia dortmund',
      'bayer leverkusen',
      'rb leipzig',
      'leipzig',
      'juventus',
      'napoli',
      'roma',
      'lazio',
      'atalanta',
      'marseille',
      'olympique lyonnais',
      'lyon',
      'monaco',
      'lille',
      'athletic',
      'real sociedad',
      'real betis',
      'sevilla',
      'villarreal',
      'valencia',
      'benfica',
      'porto',
      'sporting',
      'ajax',
      'psv',
      'feyenoord',
      'galatasaray',
      'fenerbahçe',
      'fenerbahce',
      'beşiktaş',
      'besiktas',
      'celtic',
      'rangers',
      'al-ahli',
      'al ahli',
      'al-shabab',
      'inter miami',
    ],
  },
  {
    tier: 3,
    base: 74,
    clubs: [
      'brighton',
      'brentford',
      'west ham',
      'crystal palace',
      'wolves',
      'wolverhampton',
      'bournemouth',
      'everton',
      'fulham',
      'eintracht frankfurt',
      'wolfsburg',
      'hoffenheim',
      'mainz',
      'stuttgart',
      'freiburg',
      'union berlin',
      'mönchengladbach',
      'borussia mönchengladbach',
      'köln',
      'bologna',
      'fiorentina',
      'udinese',
      'torino',
      'genoa',
      'verona',
      'parma',
      'strasbourg',
      'rennes',
      'nice',
      'nantes',
      'toulouse',
      'reims',
      'lens',
      'brest',
      'flamengo',
      'palmeiras',
      'corinthians',
      'são paulo',
      'sao paulo',
      'atlético mineiro',
      'atletico mineiro',
      'fluminense',
      'botafogo',
      'grêmio',
      'gremio',
      'internacional',
      'boca juniors',
      'river plate',
      'racing',
      'independiente',
      'club américa',
      'club america',
      'tigres',
      'monterrey',
      'guadalajara',
      'pumas',
      'cruz azul',
      'lafc',
      'los angeles fc',
      'la galaxy',
      'seattle',
      'shanghai',
      'urawa',
      'kashima',
      'yokohama',
      'al-duhail',
      'al sadd',
    ],
  },
]

const DEFAULT_TIER_BASE = 66

function clubBase(club: string): number {
  const c = club.toLowerCase()
  for (const tier of CLUB_TIERS) {
    if (tier.clubs.some((needle) => c.includes(needle))) return tier.base
  }
  return DEFAULT_TIER_BASE
}

// ─── Modificadores ──────────────────────────────────────────────────────────

function capsBonus(caps: number): number {
  if (caps >= 100) return 8
  if (caps >= 50) return 5
  if (caps >= 30) return 3
  if (caps >= 15) return 1
  if (caps >= 5) return 0
  return -2
}

function ageBonus(age: number | null): number {
  if (age == null) return 0
  if (age < 21) return -3
  if (age < 24) return -1
  if (age <= 30) return 2
  if (age <= 33) return 0
  return -2
}

function computeOverall(player: ScrapedPlayer): number {
  const base = clubBase(player.club)
  const o = base + capsBonus(player.caps) + ageBonus(player.age) + (player.isCaptain ? 2 : 0)
  return Math.max(40, Math.min(99, Math.round(o)))
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const root = process.cwd()
  const squads: ScrapedSquad[] = JSON.parse(
    await readFile(resolve(root, 'data/squads.json'), 'utf8'),
  )
  const tactics: Record<string, { primary: string; alternative: string; source: string }> =
    JSON.parse(await readFile(resolve(root, 'data/tactics.json'), 'utf8'))
  const countryCodes: Record<string, { code: string; flag: string }> = JSON.parse(
    await readFile(resolve(root, 'data/country-codes.json'), 'utf8'),
  )

  const enriched: EnrichedSquad[] = squads.map((squad) => {
    const codeInfo = countryCodes[squad.country]
    if (!codeInfo) {
      throw new Error(
        `country-codes.json sem entrada para "${squad.country}" — adicione antes de rodar`,
      )
    }

    const players = squad.players.map<EnrichedPlayer>((p) => ({
      ...p,
      overall: computeOverall(p),
    }))

    const avg = Math.round((players.reduce((s, p) => s + p.overall, 0) / players.length) * 10) / 10

    const t = tactics[squad.country]
    const formation = t
      ? { primary: t.primary, alternative: t.alternative, source: 'curated' as const }
      : { primary: '4-3-3', alternative: '4-2-3-1', source: 'default' as const }

    return {
      ...squad,
      code: codeInfo.code,
      flag: codeInfo.flag,
      formation,
      players,
      averageOverall: avg,
    }
  })

  enriched.sort((a, b) => a.group.localeCompare(b.group) || a.country.localeCompare(b.country))

  const out = resolve(root, 'public/data/squads-enriched.json')
  await writeFile(out, JSON.stringify(enriched, null, 2))

  const top10 = [...enriched].sort((a, b) => b.averageOverall - a.averageOverall).slice(0, 10)
  console.log(`▸ wrote ${out}`)
  console.log(`▸ ${enriched.length} squads enriquecidas`)
  console.log(`▸ top 10 by averageOverall:`)
  for (const s of top10) {
    console.log(`  ${s.code}  ${s.country.padEnd(22)}  ${s.averageOverall.toFixed(1)}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
