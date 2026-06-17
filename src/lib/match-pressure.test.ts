/**
 * Match pressure — modificadores aditivos de fase + tier do adversário.
 */
import {
  matchPressure,
  opponentTier,
  opponentModifier,
  phaseModifier,
  type MatchPhase,
  type OpponentTier,
} from './match-pressure'

describe('phaseModifier', () => {
  const cases: Array<[MatchPhase, number]> = [
    ['group-debut', 0.03],
    ['group-other', 0],
    ['R32', 0.01],
    ['R16', 0.02],
    ['QF', 0.03],
    ['SF', 0.04],
    ['F', 0.05],
  ]
  it.each(cases)('%s → %s', (phase, expected) => {
    expect(phaseModifier(phase)).toBe(expected)
  })
})

describe('opponentTier', () => {
  const cases: Array<[string, OpponentTier]> = [
    ['BRA', 'S'],
    ['ARG', 'S'],
    ['ESP', 'S'],
    ['ENG', 'A'],
    ['NED', 'A'],
    ['CRO', 'B'],
    ['JPN', 'B'],
    ['IRQ', 'C'],
    ['CUW', 'C'],
    ['HAI', 'C'],
  ]
  it.each(cases)('%s → tier %s', (code, tier) => {
    expect(opponentTier(code)).toBe(tier)
  })

  it('é case-insensitive (códigos em minúsculo)', () => {
    expect(opponentTier('bra')).toBe('S')
    expect(opponentTier('eng')).toBe('A')
  })

  it('código desconhecido cai em tier C (default)', () => {
    expect(opponentTier('ZZZ')).toBe('C')
  })
})

describe('opponentModifier', () => {
  it('tier S = 0.03', () => {
    expect(opponentModifier('BRA')).toBe(0.03)
  })
  it('tier C = 0', () => {
    expect(opponentModifier('IRQ')).toBe(0)
  })
})

describe('matchPressure (soma aditiva)', () => {
  it('estreia contra Brasil = 0.06 (3% nervosismo + 3% clássico)', () => {
    expect(matchPressure('group-debut', 'BRA')).toBeCloseTo(0.06, 5)
  })

  it('SF contra Argentina = 0.07 (4% fase + 3% clássico)', () => {
    expect(matchPressure('SF', 'ARG')).toBeCloseTo(0.07, 5)
  })

  it('final contra França = 0.08 (5% final + 3% clássico)', () => {
    expect(matchPressure('F', 'FRA')).toBeCloseTo(0.08, 5)
  })

  it('R32 contra Iraq = 0.01 (1% fase + 0% tier C)', () => {
    expect(matchPressure('R32', 'IRQ')).toBeCloseTo(0.01, 5)
  })

  it('grupo jogo 2 contra Curaçao = 0', () => {
    expect(matchPressure('group-other', 'CUW')).toBe(0)
  })

  it('teto natural — final contra tier S = 0.08, sem cap explícito', () => {
    // Não tem clamp/cap embutido — o caller pode introduzir se quiser
    // (ex: dificuldade hard amplificar tudo). Hoje, 0.08 é o máximo natural.
    const max = Math.max(matchPressure('F', 'BRA'), matchPressure('F', 'ARG'))
    expect(max).toBe(0.08)
  })
})
