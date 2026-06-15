/**
 * Harness pra rodar uma campanha completa programaticamente — usado pelo
 * teste E2E de distorções (e2e/distortions.spec.ts) e por scripts ad-hoc.
 *
 * Faz o draft (random), monta o WorldCup, joga os 3 jogos do grupo + os
 * jogos do mata-mata até a final ou eliminação, e retorna um `RunResult`
 * estruturado pra análise estatística.
 *
 * Tudo é determinístico por `seed` quando passado, o que permite reproduzir
 * runs estranhas.
 */
import {
  applyResult,
  createBracket,
  ensureRoundsSimulated,
  fullySimulate,
  nextUserMatch,
  ROUND_LABEL,
  type KORound,
} from './bracket'
import {
  createDraft,
  pickPlayer,
  rollUntilCompatible,
  averageOverall,
  type DraftState,
} from './draft'
import {
  createWorldCup,
  playCpuRound,
  playRound,
  setUserGroup,
  standings,
  userFate,
  userGroup as getUserGroup,
  USER_TEAM_CODE,
  type WorldCupGroups,
} from './groups'
import { seededRng } from './simulate'

// ────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────

export interface PlayerSummary {
  name: string
  country: string
  countryCode: string
  primary: string
  overall: number
  position: string
}

export interface XISummary {
  formation: string
  overall: number
  players: PlayerSummary[]
}

export interface GroupMatchSummary {
  round: 1 | 2 | 3
  opp: string
  oppCode: string
  oppOverall: number
  userGoals: number
  oppGoals: number
  result: 'W' | 'D' | 'L'
  margin: number // gols pró − contra
}

export interface KnockoutMatchSummary {
  round: KORound
  opp: string
  oppCode: string
  oppOverall: number
  userGoals: number
  oppGoals: number
  /** Placar do tempo regulamentar. */
  /** Soma incluindo prorrogação se houve. */
  extraTime?: { userGoals: number; oppGoals: number }
  penalties?: { userScored: number; oppScored: number }
  result: 'W' | 'L'
  margin: number
}

export type FinalPhase =
  | 'GROUP_3RD_OUT'
  | 'GROUP_4TH'
  | 'R32'
  | 'R16'
  | 'QF'
  | 'SF'
  | 'RUNNER_UP'
  | 'CHAMPION'

export interface GroupStageSummary {
  letter: string
  /** 1, 2, 3 ou 4. */
  position: 1 | 2 | 3 | 4
  points: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  fate: ReturnType<typeof userFate>['kind']
  /** Time substituído pelo XI naquele grupo. */
  replaced: { code: string; name: string }
  matches: GroupMatchSummary[]
}

export interface RunResult {
  seed: number
  xi: XISummary
  groupStage: GroupStageSummary
  qualified: boolean
  knockout: {
    matches: KnockoutMatchSummary[]
    finalPhase: FinalPhase
    eliminatedBy?: { code: string; name: string; round: KORound }
  }
  /** Maior vitória (margem) e pior derrota (margem) em qualquer fase. */
  biggestWin: { margin: number; opp: string; phase: string; score: string } | null
  worstLoss: { margin: number; opp: string; phase: string; score: string } | null
}

// ────────────────────────────────────────────────────────────────────────
// Random fill XI — mimicka o draft real (sorteia país via cooldown, escolhe
// jogador random entre os compatíveis)
// ────────────────────────────────────────────────────────────────────────

function randomFillXI(initial: DraftState, rng: () => number): DraftState {
  let draft = initial
  for (let i = 0; i < draft.slots.length; i++) {
    if (draft.slots[i].player) continue
    const result = rollUntilCompatible(draft, i, rng)
    draft = result.state
    const player = result.candidates[Math.floor(rng() * result.candidates.length)]
    draft = pickPlayer(draft, i, player, result.squad)
  }
  return draft
}

// ────────────────────────────────────────────────────────────────────────
// Simulação completa
// ────────────────────────────────────────────────────────────────────────

const FORMATIONS = ['4-3-3', '4-2-3-1', '4-4-2', '3-4-3'] as const

/**
 * Roda uma campanha inteira: draft → grupos → mata-mata. Tudo determinístico
 * por seed. `options.formation` opcional, senão escolhe aleatório.
 */
export function simulateFullCup(
  seed: number,
  options: { formation?: string; difficulty?: 'easy' | 'medium' | 'hard' } = {},
): RunResult {
  const rng = seededRng(seed)
  const formation = options.formation ?? FORMATIONS[Math.floor(rng() * FORMATIONS.length)]
  const difficulty = options.difficulty ?? 'medium'

  // 1. Draft random
  const initial = createDraft(formation, 'equilibrado', difficulty)
  const draft = randomFillXI(initial, rng)

  const xi: XISummary = {
    formation,
    overall: averageOverall(draft),
    players: draft.slots.map((s) => ({
      name: s.player!.player.name,
      country: s.player!.countryName,
      countryCode: s.player!.countryCode,
      primary: s.player!.player.primaryPosition ?? s.player!.player.position,
      overall: s.player!.player.overall,
      position: s.pos,
    })),
  }

  // 2. World Cup (12 grupos)
  let worldCup = createWorldCup(draft, rng)

  // 3. 3 rodadas em lockstep (user + CPU)
  for (const round of [1, 2, 3] as const) {
    const ug = playRound(getUserGroup(worldCup), round, draft, rng)
    worldCup = setUserGroup(worldCup, ug)
    worldCup = playCpuRound(worldCup, round, rng)
  }

  // 4. Grupo do user — summary
  const groupStage = summarizeGroupStage(worldCup)
  const qualified = groupStage.fate.startsWith('qualified')

  // 5. Knockout (se classificou)
  let knockoutMatches: KnockoutMatchSummary[] = []
  let finalPhase: FinalPhase
  let eliminatedBy: RunResult['knockout']['eliminatedBy']

  if (!qualified) {
    finalPhase = groupStage.position === 3 ? 'GROUP_3RD_OUT' : 'GROUP_4TH'
  } else {
    const result = playKnockoutToEnd(worldCup, rng, difficulty)
    knockoutMatches = result.matches
    finalPhase = result.finalPhase
    eliminatedBy = result.eliminatedBy
  }

  // 6. Maior vitória / pior derrota em qualquer fase
  const { biggestWin, worstLoss } = computeExtremes(groupStage, knockoutMatches)

  return {
    seed,
    xi,
    groupStage,
    qualified,
    knockout: { matches: knockoutMatches, finalPhase, eliminatedBy },
    biggestWin,
    worstLoss,
  }
}

function summarizeGroupStage(worldCup: WorldCupGroups): GroupStageSummary {
  const ug = getUserGroup(worldCup)
  const std = standings(ug)
  const userStanding = std.find((s) => s.team.code === USER_TEAM_CODE)!
  const pos = (std.findIndex((s) => s.team.code === USER_TEAM_CODE) + 1) as 1 | 2 | 3 | 4
  const fate = userFate(worldCup)

  const matches: GroupMatchSummary[] = ug.matches
    .filter((m) => m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE)
    .filter((m): m is typeof m & { result: NonNullable<typeof m.result> } => m.result != null)
    .map((m) => {
      const userIsHome = m.homeCode === USER_TEAM_CODE
      const userGoals = userIsHome ? m.result.homeGoals : m.result.awayGoals
      const oppGoals = userIsHome ? m.result.awayGoals : m.result.homeGoals
      const oppCode = userIsHome ? m.awayCode : m.homeCode
      const oppTeam = ug.teams.find((t) => t.code === oppCode)!
      const result: 'W' | 'D' | 'L' = userGoals > oppGoals ? 'W' : userGoals < oppGoals ? 'L' : 'D'
      return {
        round: m.round,
        opp: oppTeam.name,
        oppCode,
        oppOverall: oppTeam.averageOverall,
        userGoals,
        oppGoals,
        result,
        margin: userGoals - oppGoals,
      }
    })

  return {
    letter: ug.letter,
    position: pos,
    points: userStanding.points,
    wins: userStanding.wins,
    draws: userStanding.draws,
    losses: userStanding.losses,
    goalsFor: userStanding.goalsFor,
    goalsAgainst: userStanding.goalsAgainst,
    fate: fate.kind,
    replaced: { code: ug.replacedTeam.code, name: ug.replacedTeam.name },
    matches,
  }
}

function playKnockoutToEnd(
  worldCup: WorldCupGroups,
  rng: () => number,
  difficulty: 'easy' | 'medium' | 'hard',
): {
  matches: KnockoutMatchSummary[]
  finalPhase: FinalPhase
  eliminatedBy?: RunResult['knockout']['eliminatedBy']
} {
  let bracket = ensureRoundsSimulated(createBracket(worldCup), rng)
  const matches: KnockoutMatchSummary[] = []
  let finalPhase: FinalPhase = 'R32'
  let eliminatedBy: RunResult['knockout']['eliminatedBy']

  while (true) {
    const next = nextUserMatch(bracket)
    if (!next?.homeCode || !next.awayCode) break

    const home = bracket.teams[next.homeCode]
    const away = bracket.teams[next.awayCode]
    const sim = fullySimulate(home, away, rng, { difficulty })

    const userIsHome = next.homeCode === USER_TEAM_CODE
    const userGoals = userIsHome ? sim.result.homeGoals : sim.result.awayGoals
    const oppGoals = userIsHome ? sim.result.awayGoals : sim.result.homeGoals
    const oppCode = userIsHome ? next.awayCode : next.homeCode
    const opp = bracket.teams[oppCode]
    const userWon = sim.winner === (userIsHome ? 'home' : 'away')

    let etSummary: KnockoutMatchSummary['extraTime']
    let pkSummary: KnockoutMatchSummary['penalties']
    if (sim.extraTime) {
      const ugEt = userIsHome ? sim.extraTime.homeGoals : sim.extraTime.awayGoals
      const ogEt = userIsHome ? sim.extraTime.awayGoals : sim.extraTime.homeGoals
      etSummary = { userGoals: userGoals + ugEt, oppGoals: oppGoals + ogEt }
    }
    if (sim.penalties) {
      pkSummary = {
        userScored: userIsHome ? sim.penalties.homeScored : sim.penalties.awayScored,
        oppScored: userIsHome ? sim.penalties.awayScored : sim.penalties.homeScored,
      }
    }

    const finalUserG = etSummary?.userGoals ?? userGoals
    const finalOppG = etSummary?.oppGoals ?? oppGoals

    matches.push({
      round: next.round,
      opp: opp.name,
      oppCode,
      oppOverall: opp.averageOverall,
      userGoals,
      oppGoals,
      extraTime: etSummary,
      penalties: pkSummary,
      result: userWon ? 'W' : 'L',
      margin: finalUserG - finalOppG,
    })

    bracket = applyResult(bracket, next.id, {
      result: sim.result,
      extraTime: sim.extraTime,
      penalties: sim.penalties,
      winnerCode: userWon ? USER_TEAM_CODE : oppCode,
    })

    if (!userWon) {
      // Final perdida vira RUNNER_UP; outras rodadas mantêm o nome da rodada.
      finalPhase = next.round === 'F' ? 'RUNNER_UP' : next.round
      eliminatedBy = { code: oppCode, name: opp.name, round: next.round }
      break
    }
    if (next.round === 'F') {
      finalPhase = 'CHAMPION'
      break
    }
    bracket = ensureRoundsSimulated(bracket, rng)
  }

  return { matches, finalPhase, eliminatedBy }
}

function computeExtremes(
  group: GroupStageSummary,
  knockout: KnockoutMatchSummary[],
): { biggestWin: RunResult['biggestWin']; worstLoss: RunResult['worstLoss'] } {
  let biggestWin: RunResult['biggestWin'] = null
  let worstLoss: RunResult['worstLoss'] = null

  const consider = (margin: number, opp: string, phase: string, score: string) => {
    if (margin > 0 && (!biggestWin || margin > biggestWin.margin)) {
      biggestWin = { margin, opp, phase, score }
    }
    if (margin < 0 && (!worstLoss || margin < worstLoss.margin)) {
      worstLoss = { margin, opp, phase, score }
    }
  }

  for (const m of group.matches) {
    consider(m.margin, m.opp, `Grupo · jogo ${m.round}`, `${m.userGoals}-${m.oppGoals}`)
  }
  for (const m of knockout) {
    const finalUg = m.extraTime?.userGoals ?? m.userGoals
    const finalOg = m.extraTime?.oppGoals ?? m.oppGoals
    consider(m.margin, m.opp, ROUND_LABEL[m.round], `${finalUg}-${finalOg}`)
  }

  return { biggestWin, worstLoss }
}

// Helper exposto pro page.evaluate, pra que o Playwright não precise saber
// dos detalhes internos.
export function runDistortionBatch(count: number, baseSeed = 0): RunResult[] {
  const results: RunResult[] = []
  for (let i = 0; i < count; i++) {
    results.push(simulateFullCup(baseSeed + i))
  }
  return results
}
