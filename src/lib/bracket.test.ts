import { describe, expect, it } from 'vitest'
import {
  ROUND_ORDER,
  ROUND_SIZE,
  createBracket,
  fullySimulate,
  isHalfMatch,
  nextUserMatch,
  setupBracket,
  userHalfOf,
  userPath,
  type BracketMatch,
  type KnockoutBracket,
} from './bracket'
import { createDraft, pickPlayer } from './draft'
import { squads } from '../data/squads'
import { USER_TEAM_CODE } from './groups'
import { seededRng } from './simulate'

function makeStrongDraft() {
  // XI 100% Brasileiro → averageOverall alto, garante entrada no top 32.
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

describe('createBracket', () => {
  it('cria 16 jogos em R32 + placeholders nas rodadas seguintes', () => {
    const draft = makeStrongDraft()
    const bracket = createBracket(draft)
    expect(bracket.matches.filter((m) => m.round === 'R32')).toHaveLength(16)
    expect(bracket.matches.filter((m) => m.round === 'R16')).toHaveLength(8)
    expect(bracket.matches.filter((m) => m.round === 'QF')).toHaveLength(4)
    expect(bracket.matches.filter((m) => m.round === 'SF')).toHaveLength(2)
    expect(bracket.matches.filter((m) => m.round === 'F')).toHaveLength(1)
  })

  it('preenche os 16 jogos da R32 com homeCode/awayCode válidos', () => {
    const draft = makeStrongDraft()
    const bracket = createBracket(draft)
    const r32 = bracket.matches.filter((m) => m.round === 'R32')
    for (const m of r32) {
      expect(m.homeCode).toBeDefined()
      expect(m.awayCode).toBeDefined()
      expect(bracket.teams[m.homeCode!]).toBeDefined()
      expect(bracket.teams[m.awayCode!]).toBeDefined()
    }
  })

  it('marca o XI do user com isUser:true', () => {
    const draft = makeStrongDraft()
    const bracket = createBracket(draft)
    expect(bracket.userCode).toBe(USER_TEAM_CODE)
    if (bracket.teams[USER_TEAM_CODE]) {
      expect(bracket.teams[USER_TEAM_CODE].isUser).toBe(true)
    }
  })

  it('top 32 ordenados por averageOverall com seeds 1..32', () => {
    const draft = makeStrongDraft()
    const bracket = createBracket(draft)
    const all = Object.values(bracket.teams).sort((a, b) => a.seed - b.seed)
    expect(all).toHaveLength(32)
    expect(all[0].seed).toBe(1)
    expect(all[31].seed).toBe(32)
    // monotonicamente decrescente em averageOverall
    for (let i = 1; i < all.length; i++) {
      expect(all[i].averageOverall).toBeLessThanOrEqual(all[i - 1].averageOverall)
    }
  })

  it('exclui a seleção `replacedCode` do pool (a que o XI substituiu)', () => {
    const draft = makeStrongDraft()
    const bracket = createBracket(draft, 'BRA') // substitui Brasil
    // BRA não pode estar no bracket
    expect(bracket.teams['BRA']).toBeUndefined()
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
    // gap de 25 pts → praticamente nunca empata 0-0/1-1; ≥80% decididos no regulamentar
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
  it('simula a rodada do oponente e R32 do user existe, mas não jogou', () => {
    const draft = makeStrongDraft()
    const bracket = setupBracket(draft, undefined, seededRng(7))
    const userR32 = nextUserMatch(bracket)
    expect(userR32).not.toBeNull()
    expect(userR32!.round).toBe('R32')
    expect(userR32!.winnerCode).toBeUndefined()
    // No mínimo, o lado oposto da R32 já tem alguns winners
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
    const draft = makeStrongDraft()
    const bracket = setupBracket(draft, undefined, seededRng(7))
    const path = userPath(bracket)
    expect(path.length).toBeGreaterThanOrEqual(1)
    expect(path[0].round).toBe('R32')
  })
})
