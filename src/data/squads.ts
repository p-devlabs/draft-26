import enriched from '../../data/squads-enriched.json'

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

export type RatingSource = 'fifa' | 'fifa-fuzzy' | 'heuristic'

export interface Player {
  shirt: number | null
  position: Position
  positions?: string[] // posições granulares estilo FIFA: ['CB', 'LB'] ou ['ST', 'CF']
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

export interface Squad {
  group: string
  country: string
  code: string
  flag: string
  coach: string | null
  formation: { primary: string; alternative: string; source: 'curated' | 'default' }
  players: Player[]
  averageOverall: number
}

export const squads = enriched as Squad[]

export const squadsByCode: Map<string, Squad> = new Map(squads.map((s) => [s.code.toLowerCase(), s]))

export function findSquad(code: string): Squad | undefined {
  return squadsByCode.get(code.toLowerCase())
}

export const groupedSquads: { letter: string; squads: Squad[] }[] = (() => {
  const map = new Map<string, Squad[]>()
  for (const s of squads) {
    if (!map.has(s.group)) map.set(s.group, [])
    map.get(s.group)!.push(s)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, squads]) => ({
      letter,
      squads: squads.sort((a, b) => b.averageOverall - a.averageOverall),
    }))
})()

export const POSITION_LABEL: Record<Position, string> = {
  GK: 'Goleiro',
  DEF: 'Defesa',
  MID: 'Meio',
  FWD: 'Ataque',
}

export const POSITION_SHORT: Record<Position, string> = {
  GK: 'GOL',
  DEF: 'ZAG',
  MID: 'MEI',
  FWD: 'ATA',
}
