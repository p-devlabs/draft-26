import { describe, expect, it } from 'vitest'
import {
  ROUND_ORDER,
  ROUND_SIZE,
  applyResult,
  createBracket,
  ensureRoundsSimulated,
  fullySimulate,
  isHalfMatch,
  nextUserMatch,
  rewindLastUserLoss,
  setupBracket,
  userHalfOf,
  userPath,
  type BracketMatch,
  type KnockoutBracket,
} from './bracket'
import { createDraft, pickPlayer } from './draft'
import { squads } from '../data/squads'
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
        (p.primaryPosition === slot.pos ||
          (p.altPositions ?? []).includes(slot.pos)),
    )
    if (!player) continue
    used.add(player.name)
    draft = pickPlayer(draft, i, player, brazil)
  }
  return draft
}

/** Cria um worldCup já com as 3 rodadas simuladas em todos os 12 grupos. */
// seed 1: user classifica e seed 7 (passada pra setupBracket) deixa o lado
// oposto da R32 com alguns winners. Trocar seed exige re-validar essas
// pré-condições nos testes de setupBracket/userPath.
function makeFinishedWorldCup(seed = 1): WorldCupGroups {
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
    } as KnockoutBracket
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
  it('R32 do user existe sem vencedor, lado oposto já tem alguns winners', () => {
    const bracket = setupBracket(makeFinishedWorldCup(), seededRng(7))
    const userR32 = nextUserMatch(bracket)
    expect(userR32).not.toBeNull()
    expect(userR32!.round).toBe('R32')
    expect(userR32!.winnerCode).toBeUndefined()
    const otherSide = bracket.matches.filter(
      (m) =>
        m.round === 'R32' &&
        m.homeCode !== USER_TEAM_CODE &&
        m.awayCode !== USER_TEAM_CODE,
    )
    const decidedCount = otherSide.filter((m) => m.winnerCode).length
    expect(decidedCount).toBeGreaterThan(0)
  })
})

describe('userPath', () => {
  it('lista os jogos do user em ordem cronológica', () => {
    const bracket = setupBracket(makeFinishedWorldCup(), seededRng(7))
    const path = userPath(bracket)
    expect(path.length).toBeGreaterThanOrEqual(1)
    expect(path[0].round).toBe('R32')
  })
})

describe('rewindLastUserLoss', () => {
  it('reseta a derrota e a cascata downstream, mantendo o adversário no jogo', () => {
    const bracket = setupBracket(makeFinishedWorldCup(), seededRng(7))
    const userR32 = nextUserMatch(bracket)!
    const oppCode = userR32.homeCode === USER_TEAM_CODE ? userR32.awayCode! : userR32.homeCode!
    // Force loss: adversário vence 0–2.
    const lost = applyResult(bracket, userR32.id, {
      result: {
        homeGoals: userR32.homeCode === USER_TEAM_CODE ? 0 : 2,
        awayGoals: userR32.awayCode === USER_TEAM_CODE ? 0 : 2,
      },
      winnerCode: oppCode,
    })
    // Roda a cascata — o adversário avança e o lado do user é simulado até a final.
    const finished = ensureRoundsSimulated(lost, seededRng(11))
    expect(nextUserMatch(finished)).toBeNull()
    // Algum dos jogos do adversário downstream foi decidido pra valer o teste.
    const opponentDownstream = finished.matches.find(
      (m) =>
        ROUND_ORDER.indexOf(m.round) > ROUND_ORDER.indexOf('R32') &&
        (m.homeCode === oppCode || m.awayCode === oppCode),
    )
    expect(opponentDownstream).toBeDefined()

    const rewound = rewindLastUserLoss(finished)

    // A derrota foi limpa.
    const userMatchAfter = rewound.matches.find((m) => m.id === userR32.id)!
    expect(userMatchAfter.winnerCode).toBeUndefined()
    expect(userMatchAfter.result).toBeUndefined()
    // Mesmo adversário continua no jogo (homeCode/awayCode preservados).
    expect(userMatchAfter.homeCode).toBe(userR32.homeCode)
    expect(userMatchAfter.awayCode).toBe(userR32.awayCode)
    // Próximo jogo do user voltou a apontar pro userR32.
    expect(nextUserMatch(rewound)?.id).toBe(userR32.id)
    // Cascata: o jogo downstream do adversário foi resetado.
    const cleanedDownstream = rewound.matches.find((m) => m.id === opponentDownstream!.id)!
    expect(cleanedDownstream.winnerCode).toBeUndefined()
    expect(cleanedDownstream.result).toBeUndefined()
    expect(rewound.champion).toBeUndefined()
  })

  it('retorna o bracket inalterado se não há derrota pra desfazer', () => {
    const bracket = setupBracket(makeFinishedWorldCup(), seededRng(7))
    const same = rewindLastUserLoss(bracket)
    expect(same).toBe(bracket)
  })
})
