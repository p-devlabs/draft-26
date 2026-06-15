import { describe, expect, it } from '@jest/globals'

import { seededRng, simulateMatch, type Team } from './simulate'

describe('seededRng (Mulberry32)', () => {
  it('produz a mesma sequência pra mesma seed', () => {
    const a = seededRng(42)
    const b = seededRng(42)
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produz sequências diferentes pra seeds diferentes', () => {
    const a = seededRng(42)
    const b = seededRng(43)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('valores no intervalo [0, 1)', () => {
    const rng = seededRng(1)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('simulateMatch — determinismo', () => {
  const home: Team = { code: 'BRA', averageOverall: 80.6 }
  const away: Team = { code: 'ARG', averageOverall: 81.1 }

  it('mesma seed + mesmos times = mesmo placar', () => {
    const r1 = simulateMatch(home, away, seededRng(123))
    const r2 = simulateMatch(home, away, seededRng(123))
    expect(r1).toEqual(r2)
  })

  it('seeds diferentes podem dar placares diferentes', () => {
    const placares = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const r = simulateMatch(home, away, seededRng(i))
      placares.add(`${r.homeGoals}-${r.awayGoals}`)
    }
    // 30 seeds → pelo menos uns 5 placares distintos
    expect(placares.size).toBeGreaterThan(4)
  })

  it('produz placares dentro do grid (0..8)', () => {
    for (let i = 0; i < 100; i++) {
      const r = simulateMatch(home, away, seededRng(i))
      expect(r.homeGoals).toBeGreaterThanOrEqual(0)
      expect(r.homeGoals).toBeLessThanOrEqual(8)
      expect(r.awayGoals).toBeGreaterThanOrEqual(0)
      expect(r.awayGoals).toBeLessThanOrEqual(8)
    }
  })

  it('rubber-band: chamada com mesma seed muda quando difficulty é passada', () => {
    // Pelo menos em alguma seed, ativar rubber-band deve mudar o resultado.
    // (Não é garantia pra TODA seed — o caminho do CDF pode coincidir.)
    const user: Team = { code: 'YOU', averageOverall: 70, isUser: true }
    const opp: Team = { code: 'FRA', averageOverall: 85 }
    let diffs = 0
    for (let i = 0; i < 50; i++) {
      const a = simulateMatch(user, opp, seededRng(i))
      const b = simulateMatch(user, opp, seededRng(i), { difficulty: 'hard' })
      if (a.homeGoals !== b.homeGoals || a.awayGoals !== b.awayGoals) diffs++
    }
    expect(diffs).toBeGreaterThan(0)
  })

  it('host advantage: ativar code USA vs neutro muda resultado em alguma seed', () => {
    let diffs = 0
    for (let i = 0; i < 50; i++) {
      const a = simulateMatch(
        { averageOverall: 74.7 }, // sem code
        { averageOverall: 80.6 },
        seededRng(i),
      )
      const b = simulateMatch(
        { code: 'USA', averageOverall: 74.7 },
        { averageOverall: 80.6 },
        seededRng(i),
      )
      if (a.homeGoals !== b.homeGoals || a.awayGoals !== b.awayGoals) diffs++
    }
    expect(diffs).toBeGreaterThan(0)
  })

  it('jogos verdadeiramente neutros (sem hosts) não ganham mando arbitrário', () => {
    // BRA (sem code de host) vs ARG (sem code de host) deve dar resultado
    // simétrico de espera — testado estatisticamente em simulate.stats.test.ts.
    // Aqui só checamos que o cálculo não explode.
    const r = simulateMatch(
      { code: 'BRA', averageOverall: 80.6 },
      { code: 'ARG', averageOverall: 81.1 },
      seededRng(99),
    )
    expect(r.homeGoals + r.awayGoals).toBeLessThanOrEqual(16)
  })
})
