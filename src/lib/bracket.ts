/**
 * Mata-mata: bracket de 32 com seeds pelos classificados da fase de grupos.
 *
 * Composição dos 32 (regra Copa 2026): 12 1ºs + 12 2ºs + 8 melhores 3ºs.
 * Ranking pra seed dentro do bracket: posição no grupo (1 > 2 > 3) → pts
 * → saldo → gols pró → averageOverall (proxy FIFA ranking).
 *
 * Pareamento snake NCAA-style garante que seeds 1 e 2 só se encontram na
 * final.
 */
import { USER_TEAM_CODE, computeQualifiers, type Qualifier, type WorldCupGroups } from './groups'
import { narrateMatch, type MatchEvent, type NarrationRoster } from './narrate'
import { rosterForKnockout } from './rosters'
import { simulateMatch, type MatchResult, type SimOptions, type Team } from './simulate'

import type { Player } from '../data/squads'

export type KORound = 'R32' | 'R16' | 'QF' | 'SF' | 'F'

export const ROUND_LABEL: Record<KORound, string> = {
  R32: '16-avos',
  R16: 'Oitavas',
  QF: 'Quartas',
  SF: 'Semifinal',
  F: 'Final',
}

export const ROUND_ORDER: KORound[] = ['R32', 'R16', 'QF', 'SF', 'F']

export const ROUND_SIZE: Record<KORound, number> = {
  R32: 16,
  R16: 8,
  QF: 4,
  SF: 2,
  F: 1,
}

/**
 * Pareamento NCAA pra bracket de 32. Cada par (a, b) jogado em ordem.
 * Vencedor da posição i da R32 enfrenta vencedor de i+1 na R16, etc.
 */
const SEED_ORDER_32 = [
  1, 32, 16, 17, 8, 25, 9, 24, 4, 29, 13, 20, 5, 28, 12, 21, 2, 31, 15, 18, 7, 26, 10, 23, 3, 30,
  14, 19, 6, 27, 11, 22,
]

export interface KnockoutTeam {
  code: string
  name: string
  flag: string
  averageOverall: number
  seed: number
  isUser: boolean
}

/** Uma cobrança individual no shootout. */
export interface PenaltyKick {
  team: 'home' | 'away'
  scored: boolean
  /** Nome do batedor — opcional, populado quando rosters foram passados pra shootout. */
  kicker?: string
  /** Camisa do batedor (se conhecida). */
  kickerShirt?: number | null
  /** Posição original do jogador (GK/DEF/MID/FWD) — útil pra estatística. */
  kickerBucket?: 'GK' | 'DEF' | 'MID' | 'FWD'
}

export interface Penalties {
  homeScored: number
  awayScored: number
  /** Cobranças em ordem cronológica. Alternadas home/away por round; em sudden death continua alternando. */
  sequence: PenaltyKick[]
}

export interface BracketMatch {
  id: string
  round: KORound
  /** posição no bracket dentro da rodada (1..ROUND_SIZE[round]) */
  position: number
  homeCode: string | null
  awayCode: string | null
  /** placar do tempo regulamentar */
  result?: MatchResult
  events?: MatchEvent[]
  /** se houve prorrogação, placar adicional (pode ser 0-0) */
  extraTime?: MatchResult
  /** se ainda empatado, decisão por pênaltis */
  penalties?: Penalties
  winnerCode?: string
}

export interface KnockoutBracket {
  matches: BracketMatch[]
  teams: Record<string, KnockoutTeam>
  userCode: string
  champion?: string
}

/**
 * Cria o bracket a partir dos 32 classificados da Copa 2026 (1ºs, 2ºs e
 * 8 melhores 3ºs). Ranking pra seed: posição no grupo (1 > 2 > 3) → pts
 * → saldo → gols pró → averageOverall. Snake NCAA-style nos pares da R32.
 */
export function createBracket(worldCup: WorldCupGroups): KnockoutBracket {
  const qualifiers = computeQualifiers(worldCup)
  if (qualifiers.length !== 32) {
    throw new Error(`esperado 32 classificados, recebi ${qualifiers.length}`)
  }

  const ranked = [...qualifiers].sort(compareQualifiersForSeeding)

  const teams: Record<string, KnockoutTeam> = {}
  ranked.forEach((q, idx) => {
    teams[q.teamCode] = {
      code: q.teamCode,
      name: q.team.name,
      flag: q.team.flag,
      averageOverall: q.team.averageOverall,
      seed: idx + 1,
      isUser: q.teamCode === USER_TEAM_CODE,
    }
  })

  const matches: BracketMatch[] = []
  const seedToCode = ranked.map((q) => q.teamCode)
  for (let i = 0; i < 16; i++) {
    const homeSeed = SEED_ORDER_32[i * 2]
    const awaySeed = SEED_ORDER_32[i * 2 + 1]
    matches.push({
      id: `R32-${i + 1}`,
      round: 'R32',
      position: i + 1,
      homeCode: seedToCode[homeSeed - 1],
      awayCode: seedToCode[awaySeed - 1],
    })
  }

  // R16, QF, SF, F: placeholders preenchidos no advance
  for (const round of ['R16', 'QF', 'SF', 'F'] as const) {
    for (let i = 0; i < ROUND_SIZE[round]; i++) {
      matches.push({
        id: `${round}-${i + 1}`,
        round,
        position: i + 1,
        homeCode: null,
        awayCode: null,
      })
    }
  }

  return { matches, teams, userCode: USER_TEAM_CODE }
}

/**
 * Ranking de seed: 1ºs primeiro, depois 2ºs, depois 3ºs. Dentro de cada
 * faixa, ordena por pts, saldo, gols pró, averageOverall (proxy FIFA).
 */
function compareQualifiersForSeeding(a: Qualifier, b: Qualifier): number {
  if (a.groupPosition !== b.groupPosition) return a.groupPosition - b.groupPosition
  if (b.standing.points !== a.standing.points) return b.standing.points - a.standing.points
  const aGd = a.standing.goalsFor - a.standing.goalsAgainst
  const bGd = b.standing.goalsFor - b.standing.goalsAgainst
  if (bGd !== aGd) return bGd - aGd
  if (b.standing.goalsFor !== a.standing.goalsFor) return b.standing.goalsFor - a.standing.goalsFor
  return b.team.averageOverall - a.team.averageOverall
}

/** Encontra o match do user na rodada atual (ainda não jogado). */
export function nextUserMatch(bracket: KnockoutBracket): BracketMatch | null {
  for (const m of bracket.matches) {
    if (m.winnerCode) continue
    if (m.homeCode === bracket.userCode || m.awayCode === bracket.userCode) return m
  }
  return null
}

export type Half = 'top' | 'bottom'

/** Identifica em que metade do bracket o user está (top: R32 1-8, bottom: 9-16). */
export function userHalfOf(bracket: KnockoutBracket): Half {
  const userR32 = bracket.matches.find(
    (m) =>
      m.round === 'R32' && (m.homeCode === bracket.userCode || m.awayCode === bracket.userCode),
  )
  if (!userR32) return 'top'
  return userR32.position <= 8 ? 'top' : 'bottom'
}

/** Match está na metade `half`? */
export function isHalfMatch(match: BracketMatch, half: Half): boolean {
  if (match.round === 'F') return true
  const total = ROUND_SIZE[match.round]
  const inTop = match.position <= total / 2
  return half === 'top' ? inTop : !inTop
}

/** Tira o último adversário do user (o que o eliminou). */
export function userEliminator(bracket: KnockoutBracket): BracketMatch | null {
  const lostMatch = [...bracket.matches]
    .reverse()
    .find(
      (m) =>
        m.winnerCode &&
        (m.homeCode === bracket.userCode || m.awayCode === bracket.userCode) &&
        m.winnerCode !== bracket.userCode,
    )
  return lostMatch ?? null
}

/** Lista dos jogos do user em ordem cronológica. */
export function userPath(bracket: KnockoutBracket): BracketMatch[] {
  return bracket.matches.filter(
    (m) => m.homeCode === bracket.userCode || m.awayCode === bracket.userCode,
  )
}

/** Rodada atual do user (ou null se já saiu/acabou). */
export function userCurrentRound(bracket: KnockoutBracket): KORound | null {
  const next = nextUserMatch(bracket)
  return next?.round ?? null
}

export function findMatch(bracket: KnockoutBracket, id: string): BracketMatch | undefined {
  return bracket.matches.find((m) => m.id === id)
}

/** Simula 1 jogo completo (incluindo prorrogação e pênaltis se preciso). */
export function fullySimulate(
  home: Team,
  away: Team,
  rng: () => number = Math.random,
  opts?: SimOptions & {
    /** Roster do mandante (pra nomear batedores no shootout). Opcional. */
    homeRoster?: NarrationRoster
    /** Roster do visitante. Opcional. */
    awayRoster?: NarrationRoster
  },
): {
  result: MatchResult
  extraTime?: MatchResult
  penalties?: Penalties
  winner: 'home' | 'away'
} {
  const result = simulateMatch(home, away, rng, opts)
  if (result.homeGoals !== result.awayGoals) {
    return { result, winner: result.homeGoals > result.awayGoals ? 'home' : 'away' }
  }
  // Prorrogação: tratamos como "mini-jogo" com menos gols (~0.6 esperados).
  // Rubber-band não aplica na ET pra manter o tempo extra como "moeda mais
  // justa" — a assimetria já entrou no tempo normal.
  const et = simulateExtraTime(home, away, rng)
  if (et.homeGoals !== et.awayGoals) {
    return {
      result,
      extraTime: et,
      winner: et.homeGoals > et.awayGoals ? 'home' : 'away',
    }
  }
  // Pênaltis
  const pks = simulatePenalties(home, away, rng, {
    homeRoster: opts?.homeRoster,
    awayRoster: opts?.awayRoster,
  })
  return {
    result,
    extraTime: et,
    penalties: pks,
    winner: pks.homeScored > pks.awayScored ? 'home' : 'away',
  }
}

function simulateExtraTime(home: Team, away: Team, rng: () => number): MatchResult {
  // ~0.7 gols esperados, mesmas proporções
  const homeRate = 0.7 * (home.averageOverall / (home.averageOverall + away.averageOverall))
  const awayRate = 0.7 * (away.averageOverall / (home.averageOverall + away.averageOverall))
  const hG = samplePoisson(homeRate, rng)
  const aG = samplePoisson(awayRate, rng)
  return { homeGoals: hG, awayGoals: aG }
}

function samplePoisson(lambda: number, rng: () => number): number {
  const L = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= rng()
  } while (p > L)
  return k - 1
}

/**
 * Ordem de batedores pra um time. Outfielders por overall desc (FWD/MID
 * batem antes de DEF), goleiro como último recurso.
 */
function penaltyOrder(roster?: NarrationRoster): Player[] {
  if (!roster) return []
  const outfield = [...roster.attackers, ...roster.midfielders, ...roster.defenders].sort(
    (a, b) => b.overall - a.overall,
  )
  const gk = roster.goalkeeper ? [roster.goalkeeper] : []
  return [...outfield, ...gk]
}

function bucketOf(
  roster: NarrationRoster | undefined,
  player: Player,
): PenaltyKick['kickerBucket'] {
  if (!roster) return undefined
  if (roster.goalkeeper?.name === player.name) return 'GK'
  if (roster.attackers.some((p) => p.name === player.name)) return 'FWD'
  if (roster.midfielders.some((p) => p.name === player.name)) return 'MID'
  if (roster.defenders.some((p) => p.name === player.name)) return 'DEF'
  return undefined
}

/**
 * Simula a disputa por pênaltis. Quando rosters são passados em `opts`,
 * popula `kicker` em cada cobrança usando a ordem de batedores do time
 * (overall desc, outfielders antes do GK). Sem rosters, só retorna o
 * placar e a sequência scored/missed — compatível com chamadas legadas
 * (sim-harness, simulateNonUserRound, etc).
 */
export function simulatePenalties(
  home: Team,
  away: Team,
  rng: () => number = Math.random,
  opts?: { homeRoster?: NarrationRoster; awayRoster?: NarrationRoster },
): Penalties {
  // Cada chute: probabilidade de gol = 0.5 + ajuste por overall (0.65 base pra elite)
  const homeProb = 0.55 + (home.averageOverall - 75) * 0.01
  const awayProb = 0.55 + (away.averageOverall - 75) * 0.01
  const clamp = (p: number) => Math.max(0.3, Math.min(0.9, p))
  const hP = clamp(homeProb)
  const aP = clamp(awayProb)

  const homeTakers = penaltyOrder(opts?.homeRoster)
  const awayTakers = penaltyOrder(opts?.awayRoster)

  const sequence: PenaltyKick[] = []
  let hs = 0
  let as_ = 0
  let hIdx = 0
  let aIdx = 0

  const buildKick = (team: 'home' | 'away'): PenaltyKick => {
    const roster = team === 'home' ? opts?.homeRoster : opts?.awayRoster
    const takers = team === 'home' ? homeTakers : awayTakers
    const prob = team === 'home' ? hP : aP
    const scored = rng() < prob
    // Em sudden death (após esgotar a lista) volta pro topo da fila — o
    // melhor batedor cobra de novo. Padrão FIFA exige que todos cobrem
    // antes de qualquer um repetir, mas a chance de sudden death passar
    // de 11 cobranças por lado é minúscula.
    const kickerIdx = team === 'home' ? hIdx : aIdx
    if (team === 'home') {
      if (scored) hs++
      hIdx++
    } else {
      if (scored) as_++
      aIdx++
    }
    if (takers.length === 0) return { team, scored }
    const taker = takers[kickerIdx % takers.length]
    return {
      team,
      scored,
      kicker: taker.name,
      kickerShirt: taker.shirt ?? null,
      kickerBucket: bucketOf(roster, taker),
    }
  }

  /**
   * Regra FIFA: a disputa encerra assim que o time perdedor não conseguir
   * mais empatar com as cobranças restantes — mesmo no meio de uma rodada.
   * Ex.: 3-0 após 3 cobranças cada (rest. 2-2) já decide, ninguém bate a 4ª.
   */
  const isDecided = (): boolean => {
    const hRem = Math.max(0, 5 - hIdx)
    const aRem = Math.max(0, 5 - aIdx)
    return hs > as_ + aRem || as_ > hs + hRem
  }

  // Regulamento: até 5 rodadas, terminando cedo quando decidido.
  let decided = false
  for (let round = 0; round < 5; round++) {
    sequence.push(buildKick('home'))
    if (isDecided()) {
      decided = true
      break
    }
    sequence.push(buildKick('away'))
    if (isDecided()) {
      decided = true
      break
    }
  }

  // Sudden death: cobra em pares completos (sem encerrar no meio do par)
  // até alguém vencer uma rodada. Cap de 20 pares extras é seguro pra
  // qualquer cenário plausível.
  if (!decided) {
    let safety = 20
    while (hs === as_ && safety-- > 0) {
      sequence.push(buildKick('home'))
      sequence.push(buildKick('away'))
    }
  }

  return { homeScored: hs, awayScored: as_, sequence }
}

/**
 * Simula todos os matches da rodada atual EXCETO o do user.
 * Usado pra avançar a metade do user sem deixar pendências.
 */
export function simulateNonUserRound(
  bracket: KnockoutBracket,
  round: KORound,
  rng: () => number = Math.random,
): KnockoutBracket {
  // Jogos sem o user — modelo puro calibrado, sem rubber-band.
  const teamByCode = new Map(Object.entries(bracket.teams).map(([code, t]) => [code, t as Team]))
  let next = bracket

  for (const m of bracket.matches) {
    if (m.round !== round) continue
    if (m.winnerCode) continue
    if (m.homeCode === bracket.userCode || m.awayCode === bracket.userCode) continue
    if (!m.homeCode || !m.awayCode) continue

    const home = teamByCode.get(m.homeCode)!
    const away = teamByCode.get(m.awayCode)!
    const sim = fullySimulate(home, away, rng)
    const winnerCode = sim.winner === 'home' ? m.homeCode : m.awayCode
    next = applyResult(next, m.id, {
      result: sim.result,
      extraTime: sim.extraTime,
      penalties: sim.penalties,
      winnerCode,
    })
  }
  return next
}

/**
 * Setup completo: cria o bracket + simula só o que cabe na rodada atual do
 * usuário (R32 inicialmente). O resto avança round a round via
 * `ensureRoundsSimulated` conforme o user joga.
 */
export function setupBracket(
  worldCup: WorldCupGroups,
  rng: () => number = Math.random,
): KnockoutBracket {
  return ensureRoundsSimulated(createBracket(worldCup), rng)
}

/**
 * Avança a simulação dos jogos não-user de rodada em rodada — uma por vez,
 * só até onde o user ainda não jogou. Se o user já caiu (não tem jogo nessa
 * rodada), continua simulando tudo até a final.
 *
 * Para na primeira rodada onde o user tem jogo pendente. Idempotente —
 * pode ser chamado quantas vezes quiser, só simula o que falta.
 */
export function ensureRoundsSimulated(
  bracket: KnockoutBracket,
  rng: () => number = Math.random,
): KnockoutBracket {
  let next = bracket
  for (const round of ROUND_ORDER) {
    next = simulateNonUserRound(next, round, rng)
    const userMatch = next.matches.find(
      (m) => m.round === round && (m.homeCode === next.userCode || m.awayCode === next.userCode),
    )
    // Se o user tem jogo pendente nessa rodada, para — espera ele jogar.
    if (userMatch && !userMatch.winnerCode) break
  }
  return next
}

/** Aplica um resultado a um match e propaga o vencedor pra próxima rodada. */
export function applyResult(
  bracket: KnockoutBracket,
  matchId: string,
  patch: Pick<BracketMatch, 'result' | 'extraTime' | 'penalties' | 'winnerCode' | 'events'>,
): KnockoutBracket {
  const matches = bracket.matches.map((m) => (m.id === matchId ? { ...m, ...patch } : m))
  const match = matches.find((m) => m.id === matchId)!
  const winner = match.winnerCode

  if (winner) {
    const nextRound = nextRoundOf(match.round)
    if (nextRound) {
      const nextPos = Math.ceil(match.position / 2)
      const target = matches.find((m) => m.round === nextRound && m.position === nextPos)
      if (target) {
        // home se a posição original era ímpar; away se par
        if (match.position % 2 === 1) target.homeCode = winner
        else target.awayCode = winner
      }
    }
  }

  // Verifica se já temos campeão
  const finalMatch = matches.find((m) => m.round === 'F')
  const champion = finalMatch?.winnerCode

  return { ...bracket, matches, champion }
}

function nextRoundOf(r: KORound): KORound | null {
  const idx = ROUND_ORDER.indexOf(r)
  return idx >= 0 && idx < ROUND_ORDER.length - 1 ? ROUND_ORDER[idx + 1] : null
}

// re-export pra conveniência
export { rosterForKnockout, narrateMatch }
export type { MatchEvent }
