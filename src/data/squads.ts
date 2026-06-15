// O JSON `squads-enriched.json` (~570 KB) NÃO é mais bundled. Ele vive em
// `public/data/squads-enriched.json` e é carregado via `fetch()` no boot
// (ver `<SquadsGate>` em `src/main.tsx`).
//
// Por que esse hack de "bindings mutáveis populados depois"? Pra não quebrar
// os 50+ consumidores que importam `squads`, `groupedSquads`, `squadsByCode`
// e `findSquad` como se fossem síncronos. O gate garante que `loadSquads()`
// resolveu antes de qualquer rota renderizar, então ninguém vê o estado vazio.

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'

export type RatingSource = 'fifa' | 'fifa-fuzzy' | 'tm' | 'club-tier' | 'heuristic'

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

// ────────────────────────────────────────────────────────────────────────
// Estado mutável — populado por `loadSquads()` antes das rotas renderizarem.
// ────────────────────────────────────────────────────────────────────────

/** Array das 48 seleções. Vazio até `loadSquads()` resolver. */
export const squads: Squad[] = []

/** Index code→squad. Vazio até `loadSquads()` resolver. */
export const squadsByCode = new Map<string, Squad>()

/** Grupos da Copa agrupados por letra. Vazio até `loadSquads()` resolver. */
export const groupedSquads: { letter: string; squads: Squad[] }[] = []

export function findSquad(code: string): Squad | undefined {
  return squadsByCode.get(code.toLowerCase())
}

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

// ────────────────────────────────────────────────────────────────────────
// Loader — chamado UMA VEZ pelo gate no boot. Em Node (tests) lê do disco.
// ────────────────────────────────────────────────────────────────────────

const SQUADS_URL = '/data/squads-enriched.json'

let loadPromise: Promise<Squad[]> | null = null

/**
 * Carrega o JSON enriquecido das squads e popula os bindings mutáveis acima.
 * Idempotente: chamadas subsequentes retornam a mesma promise resolvida.
 */
export function loadSquads(): Promise<Squad[]> {
  if (loadPromise) return loadPromise
  loadPromise = fetchSquads().then((data) => {
    hydrate(data)
    return squads
  })
  return loadPromise
}

/**
 * Reseta o cache do loader. Útil em testes — não usar em runtime.
 */
export function __resetSquadsForTests(): void {
  loadPromise = null
  squads.length = 0
  squadsByCode.clear()
  groupedSquads.length = 0
}

/**
 * Hidrata os bindings mutáveis com o array carregado. Pra testes Node
 * (vitest setup) que importam o JSON síncrono do filesystem, e pro fetch
 * em runtime.
 */
export function hydrateSquads(data: Squad[]): void {
  if (loadPromise) return // já hidratado
  hydrate(data)
  loadPromise = Promise.resolve(squads)
}

function hydrate(data: Squad[]): void {
  squads.length = 0
  squads.push(...data)
  squadsByCode.clear()
  for (const s of squads) squadsByCode.set(s.code.toLowerCase(), s)
  groupedSquads.length = 0
  const map = new Map<string, Squad[]>()
  for (const s of squads) {
    if (!map.has(s.group)) map.set(s.group, [])
    map.get(s.group)!.push(s)
  }
  const grouped = [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, list]) => ({
      letter,
      squads: list.sort((a, b) => b.averageOverall - a.averageOverall),
    }))
  groupedSquads.push(...grouped)
}

async function fetchSquads(): Promise<Squad[]> {
  // Browser-only. Em testes Node, o vitest setup (`src/lib/test-setup.ts`)
  // chama `hydrateSquads()` diretamente do filesystem antes desta função ser
  // alcançada.
  const res = await fetch(SQUADS_URL, { cache: 'force-cache' })
  if (!res.ok) {
    throw new Error(`Falha ao carregar squads (${res.status}): ${SQUADS_URL}`)
  }
  return (await res.json()) as Squad[]
}
