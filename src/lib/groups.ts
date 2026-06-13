/**
 * Fase de grupos da Copa: o XI do usuário substitui a seleção mais fraca de
 * um dos 12 grupos (sorteado). Aí simula os 6 jogos do grupo em 3 rodadas
 * com pareamento clássico FIFA.
 */
import { groupedSquads, squads, type Player, type Squad } from '../data/squads'
import { averageOverall, type DraftState } from './draft'
import { simulateMatch, type MatchResult, type Team } from './simulate'
import { narrateMatch, type MatchEvent, type NarrationRoster } from './narrate'

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
function pairings(): Array<[number, number]>[] {
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
  const chosenGroup = groupedSquads[groupIndex]
  // ordena por força, o mais fraco é substituído
  const sorted = [...chosenGroup.squads].sort((a, b) => a.averageOverall - b.averageOverall)
  const weakest = sorted[0]
  const survivors = sorted.slice(1).map(teamFromSquad)
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
    replacedTeam: { code: weakest.code, name: weakest.country, flag: weakest.flag },
  }
}

export function findTeam(stage: GroupStage, code: string): GroupTeam | undefined {
  return stage.teams.find((t) => t.code === code)
}

export function userMatches(stage: GroupStage): GroupMatch[] {
  return stage.matches.filter(
    (m) => m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE,
  )
}

export function parallelMatches(stage: GroupStage): GroupMatch[] {
  return stage.matches.filter(
    (m) => m.homeCode !== USER_TEAM_CODE && m.awayCode !== USER_TEAM_CODE,
  )
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
export function rosterFor(
  code: string,
  stage: GroupStage,
  draft: DraftState,
): NarrationRoster {
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
    squad.players
      .filter((p) => p.position === pos)
      .sort((a, b) => b.overall - a.overall)
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
