/**
 * Mata-mata: bracket de 32 com seeds por averageOverall.
 *
 * O XI do usuário entra como um "time" extra e ocupa o lugar do 32º
 * cabeça-de-chave se entrar no top 32.
 *
 * Pareamento snake (NCAA-style) garante que seeds 1 e 2 só se encontram
 * na final.
 */
import { squads } from '../data/squads'
import { averageOverall, type DraftState } from './draft'
import { simulateMatch, type MatchResult, type Team } from './simulate'
import { narrateMatch, type MatchEvent } from './narrate'
import { USER_TEAM_CODE } from './groups'
import { rosterForKnockout } from './rosters'

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

export type Penalties = {
  homeScored: number
  awayScored: number
  /** sequência de tentativas: '⚽' = gol, '❌' = perdeu */
  sequence: { team: 'home' | 'away'; scored: boolean }[]
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

/** Cria o bracket: top 32 por averageOverall, com user como uma "seleção". */
export function createBracket(draft: DraftState, replacedCode?: string): KnockoutBracket {
  const userOverall = averageOverall(draft)
  const userAsSquad: { code: string; country: string; flag: string; averageOverall: number } = {
    code: USER_TEAM_CODE,
    country: 'Seu XI',
    flag: '⚡',
    averageOverall: userOverall,
  }

  // Pool: 48 seleções (exceto a que o XI substituiu na fase de grupos)
  const pool: Array<{ code: string; country: string; flag: string; averageOverall: number }> = [
    userAsSquad,
    ...squads
      .filter((s) => s.code !== replacedCode)
      .map((s) => ({
        code: s.code,
        country: s.country,
        flag: s.flag,
        averageOverall: s.averageOverall,
      })),
  ]

  const top32 = [...pool].sort((a, b) => b.averageOverall - a.averageOverall).slice(0, 32)

  const teams: Record<string, KnockoutTeam> = {}
  top32.forEach((t, idx) => {
    teams[t.code] = {
      code: t.code,
      name: t.country,
      flag: t.flag,
      averageOverall: t.averageOverall,
      seed: idx + 1,
      isUser: t.code === USER_TEAM_CODE,
    }
  })

  const matches: BracketMatch[] = []

  // R32: pares (SEED_ORDER_32[2k], SEED_ORDER_32[2k+1])
  const seedToCode = top32.map((t) => t.code)
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

  // R16, QF, SF, F: placeholders sem times definidos (preenchidos no advance)
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
): {
  result: MatchResult
  extraTime?: MatchResult
  penalties?: Penalties
  winner: 'home' | 'away'
} {
  const result = simulateMatch(home, away, rng)
  if (result.homeGoals !== result.awayGoals) {
    return { result, winner: result.homeGoals > result.awayGoals ? 'home' : 'away' }
  }
  // Prorrogação: tratamos como "mini-jogo" com menos gols (~0.6 esperados)
  const et = simulateExtraTime(home, away, rng)
  if (et.homeGoals !== et.awayGoals) {
    return {
      result,
      extraTime: et,
      winner: et.homeGoals > et.awayGoals ? 'home' : 'away',
    }
  }
  // Pênaltis
  const pks = shootout(home, away, rng)
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

function shootout(home: Team, away: Team, rng: () => number): Penalties {
  // Cada chute: probabilidade de gol = 0.5 + ajuste por overall (0.65 base pra elite)
  const homeProb = 0.55 + (home.averageOverall - 75) * 0.01
  const awayProb = 0.55 + (away.averageOverall - 75) * 0.01
  const clamp = (p: number) => Math.max(0.3, Math.min(0.9, p))
  const hP = clamp(homeProb)
  const aP = clamp(awayProb)

  const sequence: Penalties['sequence'] = []
  let hs = 0
  let as_ = 0

  // Cinco rodadas, depois alternado até alguém abrir vantagem
  for (let i = 0; i < 5; i++) {
    const hScored = rng() < hP
    sequence.push({ team: 'home', scored: hScored })
    if (hScored) hs++
    const aScored = rng() < aP
    sequence.push({ team: 'away', scored: aScored })
    if (aScored) as_++
  }

  // Empate após 5: alternado até alguém ganhar a rodada
  let safety = 20
  while (hs === as_ && safety-- > 0) {
    const hScored = rng() < hP
    sequence.push({ team: 'home', scored: hScored })
    if (hScored) hs++
    const aScored = rng() < aP
    sequence.push({ team: 'away', scored: aScored })
    if (aScored) as_++
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
 * Simula TODO o lado oposto do bracket de uma vez (R32 → SF), produzindo
 * o finalista que vai esperar o XI na decisão.
 *
 * Chamado uma vez quando a chave é criada — o usuário entra no mata-mata
 * já sabendo quem espera na final se chegar lá.
 */
export function simulateOtherHalfToFinal(
  bracket: KnockoutBracket,
  userHalf: Half,
  rng: () => number = Math.random,
): KnockoutBracket {
  let next = bracket
  for (const round of ['R32', 'R16', 'QF', 'SF'] as KORound[]) {
    const matches = next.matches.filter((m) => m.round === round)
    for (const m of matches) {
      if (m.winnerCode) continue
      if (isHalfMatch(m, userHalf)) continue
      if (!m.homeCode || !m.awayCode) continue
      const home = next.teams[m.homeCode]
      const away = next.teams[m.awayCode]
      const sim = fullySimulate(home, away, rng)
      const winnerCode = sim.winner === 'home' ? m.homeCode : m.awayCode
      next = applyResult(next, m.id, {
        result: sim.result,
        extraTime: sim.extraTime,
        penalties: sim.penalties,
        winnerCode,
      })
    }
  }
  return next
}

/**
 * Setup completo: cria o bracket + simula o lado oposto até o finalista.
 * É o que MataMata.tsx deve usar no primeiro acesso.
 */
export function setupBracket(
  draft: DraftState,
  replacedCode?: string,
  rng: () => number = Math.random,
): KnockoutBracket {
  const initial = createBracket(draft, replacedCode)
  const half = userHalfOf(initial)
  return simulateOtherHalfToFinal(initial, half, rng)
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
