import enriched from '../../data/squads-enriched.json'

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

export type RatingSource = 'fifa' | 'fifa-fuzzy' | 'heuristic'

export interface Player {
  shirt: number | null
  /** Bucket grosso vindo da Wikipedia: GK / DEF / MID / FWD */
  position: Position
  /** Posição principal granular estilo FIFA: 'GK', 'CB', 'LW', 'ST' */
  primaryPosition?: string
  /** Posições alternativas, ordenadas por relevância */
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
  /** Valor de mercado segundo EA FC 26 */
  value_eur?: number | null
  /** Valor de mercado atual no Transfermarkt */
  value_eur_tm?: number | null
  /** Pico histórico de valor no Transfermarkt */
  value_eur_tm_peak?: number | null
  ratingSource?: RatingSource
}

/** Valor de mercado consolidado — usa EA FC com fallback pro TM atual. */
export function playerValue(p: Player): number | null {
  return p.value_eur ?? p.value_eur_tm ?? null
}

/** Helper: todas as posições do jogador (principal + alternativas) */
export function allPositions(p: Player): string[] {
  return [p.primaryPosition, ...(p.altPositions ?? [])].filter(Boolean) as string[]
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
