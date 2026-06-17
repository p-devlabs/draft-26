/**
 * Match pressure — modificadores aditivos de fase + tier do adversário.
 */
import {
  matchPressure,
  opponentTier,
  opponentModifier,
  phaseModifier,
  playerSynergy,
  synergyTier,
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

// ============================================================
// Player synergy
// ============================================================

describe('synergyTier', () => {
  it('Messi/Mbappé/Haaland/CR7 são tier 1 (curados)', () => {
    expect(synergyTier('Lionel Messi', 86)).toBe(1)
    expect(synergyTier('Kylian Mbappé', 91)).toBe(1)
    expect(synergyTier('Erling Haaland', 90)).toBe(1)
    expect(synergyTier('Cristiano Ronaldo', 85)).toBe(1)
  })

  it('overall 95+ não-curado também cai em tier 1 (defesa de futuras adições)', () => {
    expect(synergyTier('Future Megastar', 95)).toBe(1)
    expect(synergyTier('Future Megastar', 99)).toBe(1)
  })

  it('overall 91-94 = tier 2', () => {
    expect(synergyTier('Anyone', 91)).toBe(2)
    expect(synergyTier('Anyone', 94)).toBe(2)
  })

  it('overall 88-90 = tier 3', () => {
    expect(synergyTier('Anyone', 88)).toBe(3)
    expect(synergyTier('Anyone', 90)).toBe(3)
  })

  it('overall < 88 não é estrela', () => {
    expect(synergyTier('Anyone', 87)).toBeNull()
    expect(synergyTier('Anyone', 70)).toBeNull()
  })

  it('Messi mesmo com overall baixo é tier 1 (curado vence rating)', () => {
    expect(synergyTier('Lionel Messi', 70)).toBe(1)
  })
})

describe('playerSynergy', () => {
  it('XI sem estrela = bônus 0', () => {
    const players = Array.from({ length: 11 }, (_, i) => ({
      name: `P${i}`,
      overall: 75 + (i % 10),
    }))
    expect(playerSynergy(players).bonus).toBe(0)
  })

  it('só Messi = +4% (100% do tier 1)', () => {
    const xi = [{ name: 'Lionel Messi', overall: 95 }]
    expect(playerSynergy(xi).bonus).toBeCloseTo(0.04, 5)
  })

  it('só Kane (tier 2) = +3%', () => {
    const xi = [{ name: 'Harry Kane', overall: 91 }]
    expect(playerSynergy(xi).bonus).toBeCloseTo(0.03, 5)
  })

  it('Messi + Kane = +4% + 1.5% = 5.5% (stack: 100% + 50%)', () => {
    const xi = [
      { name: 'Lionel Messi', overall: 95 },
      { name: 'Harry Kane', overall: 91 },
    ]
    expect(playerSynergy(xi).bonus).toBeCloseTo(0.055, 5)
  })

  it('Messi + Kane + Valverde (T1+T2+T2) = 4 + 1.5 + 0.75 = 6.25%', () => {
    const xi = [
      { name: 'Lionel Messi', overall: 95 },
      { name: 'Harry Kane', overall: 91 },
      { name: 'Federico Valverde', overall: 92 },
    ]
    expect(playerSynergy(xi).bonus).toBeCloseTo(0.0625, 5)
  })

  it('4ª estrela não conta (cap em top 3)', () => {
    const xi = [
      { name: 'Lionel Messi', overall: 95 },
      { name: 'Harry Kane', overall: 91 },
      { name: 'Federico Valverde', overall: 92 },
      { name: 'Saka', overall: 90 }, // tier 3, deveria ser ignorado
    ]
    // Sem Saka: 0.0625. Com Saka: ainda 0.0625 (top 3 já lotado).
    expect(playerSynergy(xi).bonus).toBeCloseTo(0.0625, 5)
  })

  it('ordena por tier primeiro: T2 com overall 94 perde pra T1 com overall 95', () => {
    const xi = [
      { name: 'Best T2', overall: 94 },
      { name: 'Lionel Messi', overall: 95 },
    ]
    // Messi 100% (4%) + Best T2 50% (1.5%) = 5.5%
    const res = playerSynergy(xi)
    expect(res.bonus).toBeCloseTo(0.055, 5)
    expect(res.stars[0].name).toBe('Lionel Messi')
    expect(res.stars[1].name).toBe('Best T2')
  })

  it('dentro do mesmo tier: ordena por overall desc', () => {
    const xi = [
      { name: 'Lower', overall: 91 },
      { name: 'Higher', overall: 94 },
    ]
    expect(playerSynergy(xi).stars[0].name).toBe('Higher')
    expect(playerSynergy(xi).stars[1].name).toBe('Lower')
  })

  it('GK conta — Alisson 91 = tier 2', () => {
    const xi = [{ name: 'Alisson', overall: 91 }]
    expect(playerSynergy(xi).bonus).toBeCloseTo(0.03, 5)
  })

  it('teto natural: 3 tier 1 + 1 tier 1 ignorado = 7% (4 + 2 + 1)', () => {
    const xi = [
      { name: 'Lionel Messi', overall: 95 },
      { name: 'Kylian Mbappé', overall: 95 },
      { name: 'Erling Haaland', overall: 95 },
      { name: 'Cristiano Ronaldo', overall: 94 },
    ]
    // Os 3 primeiros tier 1 entram com 100/50/25%. Quarto ignorado.
    expect(playerSynergy(xi).bonus).toBeCloseTo(0.07, 5)
  })
})
