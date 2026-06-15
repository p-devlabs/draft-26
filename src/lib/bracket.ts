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
import { simulateMatch, type MatchResult, type SimOptions, type Team } from './simulate'
import { narrateMatch, type MatchEvent } from './narrate'
import { USER_TEAM_CODE, computeQualifiers, type Qualifier, type WorldCupGroups } from './groups'
import { rosterForKnockout } from './rosters'

export type KORound = 'R32' | 'R16' | 'QF' | 'SF' | 'F'

export const ROUND_LABEL: Record<KORound, string> = {
  R32: '32-avos',
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
  opts?: SimOptions,
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
      (m) =>
        m.round === round &&
        (m.homeCode === next.userCode || m.awayCode === next.userCode),
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

/**
 * Desfaz a última derrota do user: limpa o jogo perdido + propaga a limpeza
 * por todos os jogos downstream que dependiam daquele winnerCode. Usado pelo
 * gatilho rewarded "rejogar último jogo" do drawer Eliminado.
 *
 * O adversário no jogo perdido continua lá (homeCode/awayCode preservados);
 * só o resultado é limpo, então o user joga DE NOVO contra o mesmo time.
 * Downstream da posição perdida fica desempilhado — `ensureRoundsSimulated`
 * vai parar quando ver esse pendente e voltar a avançar quando o user vencer.
 *
 * Idempotente: se não há derrota pra desfazer, retorna o bracket inalterado.
 */
export function rewindLastUserLoss(bracket: KnockoutBracket): KnockoutBracket {
  const lostMatch = [...bracket.matches]
    .reverse()
    .find(
      (m) =>
        m.winnerCode &&
        (m.homeCode === bracket.userCode || m.awayCode === bracket.userCode) &&
        m.winnerCode !== bracket.userCode,
    )
  if (!lostMatch) return bracket

  // Limpa a derrota mantendo homeCode/awayCode (mesmo adversário).
  let matches: BracketMatch[] = bracket.matches.map((m) =>
    m.id === lostMatch.id
      ? {
          ...m,
          result: undefined,
          extraTime: undefined,
          penalties: undefined,
          events: undefined,
          winnerCode: undefined,
        }
      : m,
  )

  // Cascata downstream: cada rodada seguinte tinha como feed o winnerCode
  // limpo acima. Apaga só o slot (home/away) que veio do match limpo —
  // o outro feed (da outra metade) continua valendo.
  let curRound: KORound = lostMatch.round
  let curPos = lostMatch.position
  while (true) {
    const next = nextRoundOf(curRound)
    if (!next) break
    const nextPos = Math.ceil(curPos / 2)
    const isHomeFeed = curPos % 2 === 1
    matches = matches.map((m) => {
      if (m.round !== next || m.position !== nextPos) return m
      return {
        ...m,
        ...(isHomeFeed ? { homeCode: null } : { awayCode: null }),
        result: undefined,
        extraTime: undefined,
        penalties: undefined,
        events: undefined,
        winnerCode: undefined,
      }
    })
    curRound = next
    curPos = nextPos
  }

  return { ...bracket, matches, champion: undefined }
}

// re-export pra conveniência
export { rosterForKnockout, narrateMatch }
export type { MatchEvent }
