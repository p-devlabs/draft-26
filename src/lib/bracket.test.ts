import { describe, expect, it } from '@jest/globals'

import { squads } from '../data/squads'

import {
  ROUND_ORDER,
  ROUND_SIZE,
  applyResult,
  createBracket,
  ensureRoundsSimulated,
  fullySimulate,
  isHalfMatch,
  nextUserMatch,
  setupBracket,
  simulatePenalties,
  userHalfOf,
  userPath,
  type BracketMatch,
  type KnockoutBracket,
} from './bracket'
import { createDraft, pickPlayer } from './draft'
import {
  USER_TEAM_CODE,
  createWorldCup,
  playCpuRound,
  playRound,
  setUserGroup,
  userGroup,
  type WorldCupGroups,
} from './groups'
import { seededRng } from './simulate'

function makeStrongDraft() {
  // XI 100% brasileiro → averageOverall alto.
  let draft = createDraft('4-3-3', 'equilibrado', 'easy')
  const brazil = squads.find((s) => s.code === 'BRA')!
  const used = new Set<string>()
  for (let i = 0; i < draft.slots.length; i++) {
    const slot = draft.slots[i]
    const player = brazil.players.find(
      (p) =>
        !used.has(p.name) &&
        (p.primaryPosition === slot.pos || (p.altPositions ?? []).includes(slot.pos)),
    )
    if (!player) continue
    used.add(player.name)
    draft = pickPlayer(draft, i, player, brazil)
  }
  return draft
}

/** Cria um worldCup já com as 3 rodadas simuladas em todos os 12 grupos. */
// seed 2: user classifica e seed 1 (passada pra setupBracket) deixa o lado
// oposto da R32 com alguns winners. Trocar seed exige re-validar essas
// pré-condições nos testes de setupBracket/userPath.
function makeFinishedWorldCup(seed = 2): WorldCupGroups {
  const draft = makeStrongDraft()
  const rng = seededRng(seed)
  let worldCup = createWorldCup(draft, rng)
  for (const round of [1, 2, 3] as const) {
    const ug = playRound(userGroup(worldCup), round, draft, rng)
    worldCup = setUserGroup(worldCup, ug)
    worldCup = playCpuRound(worldCup, round, rng)
  }
  return worldCup
}

describe('createBracket (a partir de qualifiers)', () => {
  it('cria 16 jogos em R32 + placeholders nas rodadas seguintes', () => {
    const bracket = createBracket(makeFinishedWorldCup())
    expect(bracket.matches.filter((m) => m.round === 'R32')).toHaveLength(16)
    expect(bracket.matches.filter((m) => m.round === 'R16')).toHaveLength(8)
    expect(bracket.matches.filter((m) => m.round === 'QF')).toHaveLength(4)
    expect(bracket.matches.filter((m) => m.round === 'SF')).toHaveLength(2)
    expect(bracket.matches.filter((m) => m.round === 'F')).toHaveLength(1)
  })

  it('preenche os 16 jogos da R32 com homeCode/awayCode válidos', () => {
    const bracket = createBracket(makeFinishedWorldCup())
    const r32 = bracket.matches.filter((m) => m.round === 'R32')
    for (const m of r32) {
      expect(m.homeCode).toBeDefined()
      expect(m.awayCode).toBeDefined()
      expect(bracket.teams[m.homeCode!]).toBeDefined()
      expect(bracket.teams[m.awayCode!]).toBeDefined()
    }
  })

  it('tem exatamente 32 times com seeds 1..32', () => {
    const bracket = createBracket(makeFinishedWorldCup())
    const all = Object.values(bracket.teams).sort((a, b) => a.seed - b.seed)
    expect(all).toHaveLength(32)
    expect(all[0].seed).toBe(1)
    expect(all[31].seed).toBe(32)
  })

  it('user XI brasileiro classifica e marca isUser=true', () => {
    const bracket = createBracket(makeFinishedWorldCup())
    const userTeam = bracket.teams[USER_TEAM_CODE]
    expect(userTeam).toBeDefined()
    expect(userTeam.isUser).toBe(true)
    expect(userTeam.seed).toBeGreaterThanOrEqual(1)
    expect(userTeam.seed).toBeLessThanOrEqual(32)
  })

  it('não inclui o time que o XI substituiu', () => {
    const worldCup = makeFinishedWorldCup()
    const userGroupStage = userGroup(worldCup)
    const replacedCode = userGroupStage.replacedTeam.code
    const bracket = createBracket(worldCup)
    expect(bracket.teams[replacedCode]).toBeUndefined()
  })
})

describe('userHalfOf e isHalfMatch', () => {
  function bracketWithUserAtPosition(pos: number): KnockoutBracket {
    return {
      matches: [
        {
          id: `R32-${pos}`,
          round: 'R32',
          position: pos,
          homeCode: USER_TEAM_CODE,
          awayCode: 'BRA',
        },
      ],
      teams: {},
      userCode: USER_TEAM_CODE,
    }
  }

  it('user em R32 1..8 está na top', () => {
    expect(userHalfOf(bracketWithUserAtPosition(1))).toBe('top')
    expect(userHalfOf(bracketWithUserAtPosition(8))).toBe('top')
  })

  it('user em R32 9..16 está na bottom', () => {
    expect(userHalfOf(bracketWithUserAtPosition(9))).toBe('bottom')
    expect(userHalfOf(bracketWithUserAtPosition(16))).toBe('bottom')
  })

  it('isHalfMatch: a final sempre conta como qualquer metade', () => {
    const finalMatch: BracketMatch = {
      id: 'F-1',
      round: 'F',
      position: 1,
      homeCode: 'A',
      awayCode: 'B',
    }
    expect(isHalfMatch(finalMatch, 'top')).toBe(true)
    expect(isHalfMatch(finalMatch, 'bottom')).toBe(true)
  })

  it('isHalfMatch: R32 posição ≤ 8 é top', () => {
    const m: BracketMatch = { id: 'R32-3', round: 'R32', position: 3, homeCode: 'A', awayCode: 'B' }
    expect(isHalfMatch(m, 'top')).toBe(true)
    expect(isHalfMatch(m, 'bottom')).toBe(false)
  })

  it('isHalfMatch: QF posição 3 é bottom (3 > 2 = ROUND_SIZE.QF/2)', () => {
    const m: BracketMatch = { id: 'QF-3', round: 'QF', position: 3, homeCode: 'A', awayCode: 'B' }
    expect(isHalfMatch(m, 'top')).toBe(false)
    expect(isHalfMatch(m, 'bottom')).toBe(true)
  })
})

describe('fullySimulate (knockout)', () => {
  it('sempre produz um vencedor (regulamentar, ET ou pênaltis)', () => {
    const home = { code: 'BRA', averageOverall: 80.6 }
    const away = { code: 'ARG', averageOverall: 81.1 }
    for (let i = 0; i < 50; i++) {
      const sim = fullySimulate(home, away, seededRng(i))
      expect(['home', 'away']).toContain(sim.winner)
    }
  })

  it('teams muito diferentes terminam no tempo normal a maioria das vezes', () => {
    const home = { code: 'BRA', averageOverall: 85 }
    const away = { code: 'XXX', averageOverall: 60 }
    let regulationDecided = 0
    const N = 100
    for (let i = 0; i < N; i++) {
      const sim = fullySimulate(home, away, seededRng(i))
      if (!sim.extraTime) regulationDecided++
    }
    expect(regulationDecided).toBeGreaterThan(N * 0.7)
  })
})

describe('ROUND_ORDER e ROUND_SIZE coerentes', () => {
  it('cada rodada tem metade do tamanho da anterior', () => {
    for (let i = 1; i < ROUND_ORDER.length; i++) {
      const prev = ROUND_SIZE[ROUND_ORDER[i - 1]]
      const curr = ROUND_SIZE[ROUND_ORDER[i]]
      expect(curr).toBe(prev / 2)
    }
  })
})

describe('setupBracket', () => {
  it('R32 do user existe sem vencedor e nenhum outro R32 foi simulado', () => {
    // Regressão: antes o setup já simulava todos os outros R32 upfront
    // e "spoilava" os confrontos antes da partida do user. Agora a CPU
    // da rodada pendente só roda DEPOIS do user jogar.
    const bracket = setupBracket(makeFinishedWorldCup(), seededRng(1))
    const userR32 = nextUserMatch(bracket)
    expect(userR32).not.toBeNull()
    expect(userR32!.round).toBe('R32')
    expect(userR32!.winnerCode).toBeUndefined()
    const otherR32 = bracket.matches.filter(
      (m) => m.round === 'R32' && m.homeCode !== USER_TEAM_CODE && m.awayCode !== USER_TEAM_CODE,
    )
    const decidedCount = otherR32.filter((m) => m.winnerCode).length
    expect(decidedCount).toBe(0)
  })

  it('depois do user jogar R32, ensureRoundsSimulated preenche os outros R32', () => {
    // O outro lado da regressão: o pipeline pós-jogo precisa preencher
    // os jogos da CPU da rodada do user. Sem isso, /bracket ficaria preso.
    let bracket = setupBracket(makeFinishedWorldCup(), seededRng(1))
    const userR32 = nextUserMatch(bracket)!
    // Simula o user vencendo (homeCode arbitrário — não importa quem ganha).
    bracket = applyResult(bracket, userR32.id, {
      result: { homeGoals: 2, awayGoals: 1 },
      winnerCode: userR32.homeCode!,
    })
    bracket = ensureRoundsSimulated(bracket, seededRng(2))
    const otherR32 = bracket.matches.filter(
      (m) => m.round === 'R32' && m.homeCode !== USER_TEAM_CODE && m.awayCode !== USER_TEAM_CODE,
    )
    expect(otherR32.every((m) => m.winnerCode)).toBe(true)
  })
})

describe('userPath', () => {
  it('lista os jogos do user em ordem cronológica', () => {
    const bracket = setupBracket(makeFinishedWorldCup(), seededRng(1))
    const path = userPath(bracket)
    expect(path.length).toBeGreaterThanOrEqual(1)
    expect(path[0].round).toBe('R32')
  })
})

describe('simulatePenalties — early termination (FIFA)', () => {
  // RNG fake estrito: cada bool força UMA cobrança (true = gol, false = perdeu).
  // Joga se o código pedir mais rng() que o esperado — pega regressão silenciosa.
  // simulatePenalties: scored = rng() < prob. prob clampado em [0.3, 0.9], então
  // 0 sempre converte e 0.99 sempre erra.
  function fakeRngFor(scores: boolean[]): () => number {
    let i = 0
    return () => {
      if (i >= scores.length) {
        throw new Error(`fakeRng esgotado na chamada #${i + 1} — terminação prematura esperada?`)
      }
      const s = scores[i++]
      return s ? 0 : 0.99
    }
  }

  const homeStr = { code: 'H', averageOverall: 80 }
  const awayStr = { code: 'A', averageOverall: 80 }

  it('user scenario: 3-1 na rodada 4, encerra após A R4 sem chegar na rodada 5', () => {
    // R1: H gol, A gol → 1-1
    // R2: H gol, A perde → 2-1
    // R3: H perde, A perde → 2-1
    // R4: H gol (3-1), A perde (3-1). Após A R4: hShot=4, aShot=4, hRem=1, aRem=1.
    //     as_+aRem = 1+1 = 2 < hs=3 → DECIDIDO.
    const seq = [true, true, true, false, false, false, true, false]
    const pks = simulatePenalties(homeStr, awayStr, fakeRngFor(seq))
    expect(pks.homeScored).toBe(3)
    expect(pks.awayScored).toBe(1)
    expect(pks.sequence).toHaveLength(8)
  })

  it('3-0 após 3 rodadas — encerra após A R3 (não vai pra rodada 4)', () => {
    // R1 H gol, A perde → 1-0
    // R2 H gol, A perde → 2-0
    // R3 H gol (3-0), A perde (3-0). Após A R3: hShot=3, aShot=3, aRem=2.
    //   as_+aRem=2 < hs=3 → DECIDIDO.
    const seq = [true, false, true, false, true, false]
    const pks = simulatePenalties(homeStr, awayStr, fakeRngFor(seq))
    expect(pks.homeScored).toBe(3)
    expect(pks.awayScored).toBe(0)
    expect(pks.sequence).toHaveLength(6)
  })

  it('encerra DEPOIS da H R4 quando ela faz 4-1 (A nem chuta a R4)', () => {
    // R1: 1-1 (não decide com aRem=4)
    // R2: 2-1 (H gol, A erra) — não decide
    // R3: 3-1 (H gol, A erra) — após A R3: aRem=2, 3 > 1+2=3? Não estrito. Continua.
    // R4 H: gol → 4-1. Após H R4: hShot=4, aShot=3, aRem=2.
    //   as_+aRem = 1+2 = 3 < hs=4 → DECIDIDO antes de A R4.
    const seq = [true, true, true, false, true, false, true]
    const pks = simulatePenalties(homeStr, awayStr, fakeRngFor(seq))
    expect(pks.homeScored).toBe(4)
    expect(pks.awayScored).toBe(1)
    expect(pks.sequence).toHaveLength(7)
    expect(pks.sequence[6].team).toBe('home')
  })

  it('NÃO encerra cedo quando dá pra empatar — vai até completar 5 rodadas', () => {
    // R1: 1-1, R2: 2-1, R3: 2-1, R4: 2-1, R5: 2-1
    const seq = [true, true, true, false, false, false, false, false, false, false]
    const pks = simulatePenalties(homeStr, awayStr, fakeRngFor(seq))
    expect(pks.homeScored).toBe(2)
    expect(pks.awayScored).toBe(1)
    expect(pks.sequence).toHaveLength(10)
  })

  it('completa 5 rodadas e decide em 3-4 sem entrar em sudden death', () => {
    // R1 1-1, R2 2-2, R3 2-3 (H errou), R4 3-3, R5 H erra, A gol → 3-4
    const seq = [true, true, true, true, false, true, true, false, false, true]
    const pks = simulatePenalties(homeStr, awayStr, fakeRngFor(seq))
    expect(pks.homeScored).toBe(3)
    expect(pks.awayScored).toBe(4)
    expect(pks.sequence).toHaveLength(10)
  })

  it('entra em morte súbita quando empata em 5 rodadas — H gol, A erra no par 1', () => {
    // 5-5 reg, SD R1: H gol (6-5), A erra (6-5) → decide
    const seq = [true, true, true, true, true, true, true, true, true, true, true, false]
    const pks = simulatePenalties(homeStr, awayStr, fakeRngFor(seq))
    expect(pks.homeScored).toBe(6)
    expect(pks.awayScored).toBe(5)
    expect(pks.sequence).toHaveLength(12)
  })

  it('SD não encerra no meio do par — H erra, A precisa bater pra decidir', () => {
    // 5-5 reg, SD R1: H erra (5-5), A gol (5-6) → decide
    const seq = [true, true, true, true, true, true, true, true, true, true, false, true]
    const pks = simulatePenalties(homeStr, awayStr, fakeRngFor(seq))
    expect(pks.homeScored).toBe(5)
    expect(pks.awayScored).toBe(6)
    expect(pks.sequence).toHaveLength(12)
  })

  it('SD com par empatado (gol-gol) continua pra próximo par', () => {
    // 5-5 reg, SD R1: 1-1, SD R2: H gol, A erra → 7-6
    const seq = [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true, // SD R1: 6-6
      true,
      false, // SD R2: 7-6 → decide
    ]
    const pks = simulatePenalties(homeStr, awayStr, fakeRngFor(seq))
    expect(pks.homeScored).toBe(7)
    expect(pks.awayScored).toBe(6)
    expect(pks.sequence).toHaveLength(14)
  })
})
