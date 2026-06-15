/**
 * Fase de grupos da Copa: o XI do usuário substitui a seleção mais fraca de
 * um dos 12 grupos (sorteado). Os 11 grupos restantes rodam em paralelo
 * com CPU vs CPU, em lockstep com o user (round 1 do user → round 1 dos CPU).
 *
 * Classificação pra mata-mata (Copa 2026 Article 13):
 *   - 1º colocado de cada grupo (12)
 *   - 2º colocado de cada grupo (12)
 *   - 8 melhores 3ºs colocados entre os 12 grupos
 *   - Total: 32 → R32
 */
import { groupedSquads, squads, type Player, type Squad } from '../data/squads'

import { averageOverall, type DraftState } from './draft'
import { narrateMatch, type MatchEvent, type NarrationRoster } from './narrate'
import { simulateMatch, type MatchResult, type Team } from './simulate'

export const USER_TEAM_CODE = 'YOU'

export interface GroupTeam {
  code: string
  name: string
  flag: string
  averageOverall: number
  isUser: boolean
}

export interface GroupMatch {
  round: 1 | 2 | 3
  homeCode: string
  awayCode: string
  result?: MatchResult
  events?: MatchEvent[]
}

export interface GroupStage {
  letter: string
  teams: GroupTeam[] // sempre 4
  matches: GroupMatch[] // sempre 6
  replacedTeam: { code: string; name: string; flag: string }
}

export interface Standing {
  team: GroupTeam
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  points: number
}

function teamFromSquad(s: Squad): GroupTeam {
  return {
    code: s.code,
    name: s.country,
    flag: s.flag,
    averageOverall: s.averageOverall,
    isUser: false,
  }
}

function teamFromDraft(draft: DraftState): GroupTeam {
  return {
    code: USER_TEAM_CODE,
    name: 'Seu XI',
    flag: '⚡',
    averageOverall: averageOverall(draft),
    isUser: true,
  }
}

/** Pareamento padrão pra grupo de 4: cada rodada tem 2 jogos. */
function pairings(): [number, number][][] {
  return [
    [
      [0, 1],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 3],
    ],
    [
      [0, 3],
      [1, 2],
    ],
  ]
}

/**
 * Cria o grupo do usuário: sorteia um grupo e substitui o time mais fraco
 * pelo XI montado.
 */
export function createGroupStage(draft: DraftState, rng: () => number = Math.random): GroupStage {
  const groupIndex = Math.floor(rng() * groupedSquads.length)
  return createUserGroupAt(draft, groupedSquads[groupIndex], rng)
}

/**
 * Sorteia QUAL time do grupo será substituído pelo XI. Peso decrescente
 * por força — o mais fraco tem 40% de chance, depois 30/20/10. Garante
 * variedade entre runs sem perder o sentido narrativo (você quase sempre
 * toma o lugar de uma das seleções mais frágeis, mas vez ou outra acaba
 * num grupo difícil substituindo um peixe maior).
 */
const REPLACE_WEIGHTS_BY_RANK = [4, 3, 2, 1] // sorted ASC pelo overall
function pickReplaceIndex(rng: () => number): number {
  const total = REPLACE_WEIGHTS_BY_RANK.reduce((a, b) => a + b, 0)
  const roll = rng() * total
  let cum = 0
  for (let i = 0; i < REPLACE_WEIGHTS_BY_RANK.length; i++) {
    cum += REPLACE_WEIGHTS_BY_RANK[i]
    if (roll < cum) return i
  }
  return 0
}

function createUserGroupAt(
  draft: DraftState,
  chosenGroup: { letter: string; squads: Squad[] },
  rng: () => number,
): GroupStage {
  // ordena por força, escolhe quem sai via random ponderado (peso maior pros
  // mais fracos). O mais forte raramente é substituído, mas vez ou outra rola.
  const sorted = [...chosenGroup.squads].sort((a, b) => a.averageOverall - b.averageOverall)
  const replaceIdx = pickReplaceIndex(rng)
  const replaced = sorted[replaceIdx]
  const survivors = sorted.filter((_, i) => i !== replaceIdx).map(teamFromSquad)
  const userTeam = teamFromDraft(draft)

  // user time entra na posição 0 pro chaveamento (mando alternado é detalhe)
  const teams: GroupTeam[] = [userTeam, ...survivors]

  const matches: GroupMatch[] = []
  pairings().forEach((round, rIdx) => {
    for (const [h, a] of round) {
      matches.push({
        round: (rIdx + 1) as 1 | 2 | 3,
        homeCode: teams[h].code,
        awayCode: teams[a].code,
      })
    }
  })

  return {
    letter: chosenGroup.letter,
    teams,
    matches,
    replacedTeam: { code: replaced.code, name: replaced.country, flag: replaced.flag },
  }
}

// ────────────────────────────────────────────────────────────────────────
// World Cup completo — 12 grupos
// ────────────────────────────────────────────────────────────────────────

/**
 * Estado de toda a fase de grupos: o grupo do user + os 11 grupos CPU.
 * Sempre length 12, ordenados A..L. O grupo do user é identificado pela letra.
 */
export interface WorldCupGroups {
  userLetter: string
  groups: GroupStage[]
}

/**
 * Cria um grupo CPU-only (sem substituição do XI). Os 4 times do grupo
 * disputam as 6 partidas. Pareamento idêntico ao do grupo do user.
 */
function createCpuGroup(g: { letter: string; squads: Squad[] }): GroupStage {
  const teams = g.squads.map(teamFromSquad)
  const matches: GroupMatch[] = []
  pairings().forEach((round, rIdx) => {
    for (const [h, a] of round) {
      matches.push({
        round: (rIdx + 1) as 1 | 2 | 3,
        homeCode: teams[h].code,
        awayCode: teams[a].code,
      })
    }
  })
  return {
    letter: g.letter,
    teams,
    matches,
    // CPU groups não substituem ninguém. Placeholder vazio.
    replacedTeam: { code: '', name: '', flag: '' },
  }
}

/**
 * Cria os 12 grupos do mundial: 11 CPU + 1 com o user. A letra do grupo do
 * user é sorteada via `rng`. Os 11 grupos restantes ainda não têm resultados.
 */
export function createWorldCup(draft: DraftState, rng: () => number = Math.random): WorldCupGroups {
  const groupIndex = Math.floor(rng() * groupedSquads.length)
  const userLetter = groupedSquads[groupIndex].letter
  const groups: GroupStage[] = groupedSquads.map((g) =>
    g.letter === userLetter ? createUserGroupAt(draft, g, rng) : createCpuGroup(g),
  )
  return { userLetter, groups }
}

/** Acha o grupo do user dentro do worldCup. */
export function userGroup(worldCup: WorldCupGroups): GroupStage {
  const g = worldCup.groups.find((g) => g.letter === worldCup.userLetter)
  if (!g) throw new Error(`grupo do user (${worldCup.userLetter}) sumiu do worldCup`)
  return g
}

/**
 * Simula a rodada dada em TODOS os grupos CPU. O grupo do user é simulado
 * separadamente via `playRound` pra preservar a narração e dificuldade do XI.
 * Idempotente — partidas já jogadas não são re-simuladas.
 */
export function playCpuRound(
  worldCup: WorldCupGroups,
  round: 1 | 2 | 3,
  rng: () => number = Math.random,
): WorldCupGroups {
  const groups = worldCup.groups.map((g) => {
    if (g.letter === worldCup.userLetter) return g
    return simulateCpuGroupRound(g, round, rng)
  })
  return { ...worldCup, groups }
}

function simulateCpuGroupRound(stage: GroupStage, round: 1 | 2 | 3, rng: () => number): GroupStage {
  const teamByCode = new Map(stage.teams.map((t) => [t.code, t as Team]))
  const newMatches = stage.matches.map((m) => {
    if (m.round !== round || m.result) return m
    const home = teamByCode.get(m.homeCode)!
    const away = teamByCode.get(m.awayCode)!
    // CPU vs CPU: sem rubber-band, sem narração (não exibida).
    const result = simulateMatch(home, away, rng)
    return { ...m, result }
  })
  return { ...stage, matches: newMatches }
}

/** Atualiza o grupo do user dentro do worldCup (após playRound). */
export function setUserGroup(worldCup: WorldCupGroups, updated: GroupStage): WorldCupGroups {
  return {
    ...worldCup,
    groups: worldCup.groups.map((g) => (g.letter === worldCup.userLetter ? updated : g)),
  }
}

// ────────────────────────────────────────────────────────────────────────
// Classificação pra mata-mata (Copa 2026)
// ────────────────────────────────────────────────────────────────────────

/** Entrada por time qualificado pro mata-mata. */
export interface Qualifier {
  teamCode: string
  team: GroupTeam
  groupLetter: string
  /** 1, 2 ou 3 — 4º colocado nunca classifica. */
  groupPosition: 1 | 2 | 3
  standing: Standing
}

/**
 * Aplica a regra Copa 2026 e retorna os 32 classificados:
 *   - 1º de cada grupo (12)
 *   - 2º de cada grupo (12)
 *   - 8 melhores 3ºs colocados entre os 12 grupos
 *
 * Ranking dos 3ºs: pts → saldo geral → gols pró → averageOverall (proxy FIFA).
 * Lança se algum grupo ainda não tem standings completos.
 */
export function computeQualifiers(worldCup: WorldCupGroups): Qualifier[] {
  const result: Qualifier[] = []
  const thirds: Qualifier[] = []

  for (const g of worldCup.groups) {
    const std = standings(g)
    // 1º e 2º entram direto
    for (const pos of [1, 2] as const) {
      const s = std[pos - 1]
      result.push({
        teamCode: s.team.code,
        team: s.team,
        groupLetter: g.letter,
        groupPosition: pos,
        standing: s,
      })
    }
    // 3º vai pra triagem
    if (std[2]) {
      thirds.push({
        teamCode: std[2].team.code,
        team: std[2].team,
        groupLetter: g.letter,
        groupPosition: 3,
        standing: std[2],
      })
    }
  }

  thirds.sort(compareThirds)
  result.push(...thirds.slice(0, 8))
  return result
}

/** Mesma ordem de tiebreakers da standings(), só que entre grupos. */
function compareThirds(a: Qualifier, b: Qualifier): number {
  if (b.standing.points !== a.standing.points) return b.standing.points - a.standing.points
  const aGd = a.standing.goalsFor - a.standing.goalsAgainst
  const bGd = b.standing.goalsFor - b.standing.goalsAgainst
  if (bGd !== aGd) return bGd - aGd
  if (b.standing.goalsFor !== a.standing.goalsFor) return b.standing.goalsFor - a.standing.goalsFor
  return b.team.averageOverall - a.team.averageOverall
}

/** O user passou de fase? */
export function userQualifies(worldCup: WorldCupGroups): boolean {
  return computeQualifiers(worldCup).some((q) => q.teamCode === USER_TEAM_CODE)
}

/** Posição final do user no grupo dele (1, 2, 3 ou 4). */
export function userGroupPosition(worldCup: WorldCupGroups): 1 | 2 | 3 | 4 {
  const std = standings(userGroup(worldCup))
  const idx = std.findIndex((s) => s.team.code === USER_TEAM_CODE)
  if (idx < 0) throw new Error('user não está no próprio grupo (bug)')
  return (idx + 1) as 1 | 2 | 3 | 4
}

/**
 * Detalhamento do destino do user: classificado como 1º/2º/3º (entre os 8
 * melhores), ou eliminado como 3º fora dos 8 ou 4º. Útil pras mensagens.
 */
export type UserFate =
  | { kind: 'qualified-1st' }
  | { kind: 'qualified-2nd' }
  | { kind: 'qualified-3rd-rank'; rank: number } // 1..8 entre os 12 3ºs
  | { kind: 'eliminated-3rd-rank'; rank: number } // 9..12
  | { kind: 'eliminated-4th' }

export function userFate(worldCup: WorldCupGroups): UserFate {
  const pos = userGroupPosition(worldCup)
  if (pos === 1) return { kind: 'qualified-1st' }
  if (pos === 2) return { kind: 'qualified-2nd' }
  if (pos === 4) return { kind: 'eliminated-4th' }
  // pos === 3: precisa saber o rank entre os 3ºs.
  const thirds: Qualifier[] = []
  for (const g of worldCup.groups) {
    const std = standings(g)
    if (std[2]) {
      thirds.push({
        teamCode: std[2].team.code,
        team: std[2].team,
        groupLetter: g.letter,
        groupPosition: 3,
        standing: std[2],
      })
    }
  }
  thirds.sort(compareThirds)
  const userIdx = thirds.findIndex((q) => q.teamCode === USER_TEAM_CODE)
  if (userIdx < 0) throw new Error('user 3º mas não apareceu na lista de 3ºs (bug)')
  const rank = userIdx + 1
  if (rank <= 8) return { kind: 'qualified-3rd-rank', rank }
  return { kind: 'eliminated-3rd-rank', rank }
}

// ────────────────────────────────────────────────────────────────────────
// Helpers existentes (mantidos)
// ────────────────────────────────────────────────────────────────────────

export function findTeam(stage: GroupStage, code: string): GroupTeam | undefined {
  return stage.teams.find((t) => t.code === code)
}

export function userMatches(stage: GroupStage): GroupMatch[] {
  return stage.matches.filter((m) => m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE)
}

export function parallelMatches(stage: GroupStage): GroupMatch[] {
  return stage.matches.filter((m) => m.homeCode !== USER_TEAM_CODE && m.awayCode !== USER_TEAM_CODE)
}

/** Simula todos os jogos de uma rodada e gera narração. Retorna novo state imutável. */
export function playRound(
  stage: GroupStage,
  round: 1 | 2 | 3,
  draft: DraftState,
  rng: () => number = Math.random,
): GroupStage {
  const teamByCode = new Map(stage.teams.map((t) => [t.code, t as Team]))
  const newMatches = stage.matches.map((m) => {
    if (m.round !== round || m.result) return m
    const home = teamByCode.get(m.homeCode)!
    const away = teamByCode.get(m.awayCode)!
    const result = simulateMatch(home, away, rng, { difficulty: draft.difficulty })
    const homeRoster = rosterFor(m.homeCode, stage, draft)
    const awayRoster = rosterFor(m.awayCode, stage, draft)
    const events = narrateMatch({ home: homeRoster, away: awayRoster, result }, rng)
    return { ...m, result, events }
  })
  return { ...stage, matches: newMatches }
}

/** Constrói o roster pra narração: 1 GK + alguns ZAG/MEI/ATA. */
export function rosterFor(code: string, stage: GroupStage, draft: DraftState): NarrationRoster {
  const team = stage.teams.find((t) => t.code === code)!
  if (code === USER_TEAM_CODE) {
    const players = draft.slots.map((s) => s.player!.player).filter(Boolean)
    return {
      code,
      name: team.name,
      flag: team.flag,
      goalkeeper: players.find((p) => p.position === 'GK') ?? null,
      defenders: players.filter((p) => p.position === 'DEF'),
      midfielders: players.filter((p) => p.position === 'MID'),
      attackers: players.filter((p) => p.position === 'FWD'),
    }
  }
  const squad = squads.find((s) => s.code === code)!
  const byPos = (pos: Player['position']) =>
    squad.players.filter((p) => p.position === pos).sort((a, b) => b.overall - a.overall)
  return {
    code,
    name: team.name,
    flag: team.flag,
    goalkeeper: byPos('GK')[0] ?? null,
    defenders: byPos('DEF').slice(0, 4),
    midfielders: byPos('MID').slice(0, 4),
    attackers: byPos('FWD').slice(0, 3),
  }
}

/** Próxima rodada que ainda não foi jogada, ou null se acabou. */
export function nextRound(stage: GroupStage): 1 | 2 | 3 | null {
  for (const r of [1, 2, 3] as const) {
    const matchesOfRound = stage.matches.filter((m) => m.round === r)
    if (matchesOfRound.some((m) => !m.result)) return r
  }
  return null
}

interface MiniRow {
  pts: number
  gf: number
  ga: number
}

/** Stats do mini-grupo: só jogos entre `codes`. Pontos contam só esses jogos. */
function miniTable(codes: Set<string>, matches: GroupMatch[]): Map<string, MiniRow> {
  const map = new Map<string, MiniRow>()
  for (const c of codes) map.set(c, { pts: 0, gf: 0, ga: 0 })

  for (const m of matches) {
    if (!m.result) continue
    if (!codes.has(m.homeCode) || !codes.has(m.awayCode)) continue
    const h = map.get(m.homeCode)!
    const a = map.get(m.awayCode)!
    h.gf += m.result.homeGoals
    h.ga += m.result.awayGoals
    a.gf += m.result.awayGoals
    a.ga += m.result.homeGoals
    if (m.result.homeGoals > m.result.awayGoals) h.pts += 3
    else if (m.result.homeGoals < m.result.awayGoals) a.pts += 3
    else {
      h.pts++
      a.pts++
    }
  }
  return map
}

/**
 * Tiebreaker oficial Copa 2026 (Article 13, ordem):
 *   1. Pontos no confronto direto (mini-tabela)
 *   2. Saldo de gols no confronto direto
 *   3. Gols pró no confronto direto
 *   4. Saldo de gols em todos os jogos do grupo
 *   5. Gols pró em todos os jogos do grupo
 *   6. Fair play (não temos dado)
 *   7. FIFA ranking (proxy: averageOverall)
 */
export function standings(stage: GroupStage): Standing[] {
  const map = new Map<string, Standing>()
  for (const t of stage.teams) {
    map.set(t.code, {
      team: t,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    })
  }

  for (const m of stage.matches) {
    if (!m.result) continue
    const home = map.get(m.homeCode)!
    const away = map.get(m.awayCode)!
    home.played++
    away.played++
    home.goalsFor += m.result.homeGoals
    home.goalsAgainst += m.result.awayGoals
    away.goalsFor += m.result.awayGoals
    away.goalsAgainst += m.result.homeGoals
    if (m.result.homeGoals > m.result.awayGoals) {
      home.wins++
      home.points += 3
      away.losses++
    } else if (m.result.homeGoals < m.result.awayGoals) {
      away.wins++
      away.points += 3
      home.losses++
    } else {
      home.draws++
      home.points++
      away.draws++
      away.points++
    }
  }

  const all = [...map.values()]

  // 1. Agrupa por pontos.
  const buckets = new Map<number, Standing[]>()
  for (const s of all) {
    if (!buckets.has(s.points)) buckets.set(s.points, [])
    buckets.get(s.points)!.push(s)
  }

  // 2. Resolve cada bucket internamente.
  const sortedBuckets = [...buckets.entries()].sort((a, b) => b[0] - a[0])
  const result: Standing[] = []

  for (const [, bucket] of sortedBuckets) {
    if (bucket.length === 1) {
      result.push(bucket[0])
      continue
    }
    // Múltiplos times empatados em pontos → mini-tabela do confronto direto
    const codes = new Set(bucket.map((s) => s.team.code))
    const mini = miniTable(codes, stage.matches)

    const sorted = [...bucket].sort((a, b) => {
      const am = mini.get(a.team.code)!
      const bm = mini.get(b.team.code)!
      // 1. pts no confronto direto
      if (bm.pts !== am.pts) return bm.pts - am.pts
      // 2. saldo no confronto direto
      const amSg = am.gf - am.ga
      const bmSg = bm.gf - bm.ga
      if (bmSg !== amSg) return bmSg - amSg
      // 3. gols pró no confronto direto
      if (bm.gf !== am.gf) return bm.gf - am.gf
      // 4. saldo geral
      const aSg = a.goalsFor - a.goalsAgainst
      const bSg = b.goalsFor - b.goalsAgainst
      if (bSg !== aSg) return bSg - aSg
      // 5. gols pró geral
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
      // 6. fair play — não temos
      // 7. proxy de FIFA ranking via averageOverall (estável + faz sentido)
      return b.team.averageOverall - a.team.averageOverall
    })
    result.push(...sorted)
  }

  return result
}
