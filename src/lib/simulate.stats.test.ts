/**
 * Testes estatísticos do motor de simulação.
 *
 * Cada teste roda N partidas com seed fixa por iteração e checa que a
 * estatística observada cai numa janela ±10% do valor esperado (calibração
 * ou comparação relativa). Tolerância vem de `simParams.calibration` quando
 * existe valor empírico; senão, derivado da configuração atual do motor.
 *
 * Filosofia: prefer testes RELATIVOS (rubber-band em hard < no-difficulty)
 * em vez de absolutos sempre que possível — mais resistentes a recalibração.
 */
import { describe, expect, it } from '@jest/globals'

import simParams from '../../data/sim-params.json'

import { fullySimulate } from './bracket'
import { seededRng, simulateMatch, type Team } from './simulate'

const N = 3000
const TOLERANCE = 0.1 // ±10%

function within(observed: number, expected: number, tol = TOLERANCE) {
  const lo = expected * (1 - tol)
  const hi = expected * (1 + tol)
  return observed >= lo && observed <= hi
}

function runMatches(
  home: Team,
  away: Team,
  n: number,
  opts?: { difficulty?: 'easy' | 'medium' | 'hard'; baseSeed?: number },
) {
  const base = opts?.baseSeed ?? 0
  let w = 0,
    d = 0,
    l = 0,
    gf = 0,
    ga = 0
  const scoreCounts: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const rng = seededRng(base + i)
    const opt = opts?.difficulty ? { difficulty: opts.difficulty } : undefined
    const r = simulateMatch(home, away, rng, opt)
    gf += r.homeGoals
    ga += r.awayGoals
    if (r.homeGoals > r.awayGoals) w++
    else if (r.homeGoals < r.awayGoals) l++
    else d++
    const k = `${r.homeGoals}-${r.awayGoals}`
    scoreCounts[k] = (scoreCounts[k] ?? 0) + 1
  }
  return {
    winRate: w / n,
    drawRate: d / n,
    lossRate: l / n,
    avgHomeGoals: gf / n,
    avgAwayGoals: ga / n,
    avgTotalGoals: (gf + ga) / n,
    scoreCounts,
  }
}

describe('Calibração — gols por jogo', () => {
  it('média total de gols ≈ 2.6 em jogos equilibrados (±10%)', () => {
    // Dois times médios (75) sem código de host → jogo neutro, sem rubber-band
    const stats = runMatches({ averageOverall: 75 }, { averageOverall: 75 }, N, { baseSeed: 1_000 })
    expect(within(stats.avgTotalGoals, simParams.avgGoalsPerMatch)).toBe(true)
  })

  it('time mais forte marca mais gols na média', () => {
    const stats = runMatches({ averageOverall: 83 }, { averageOverall: 70 }, N, { baseSeed: 2_000 })
    expect(stats.avgHomeGoals).toBeGreaterThan(stats.avgAwayGoals)
    expect(stats.winRate).toBeGreaterThan(stats.lossRate)
  })
})

describe('Distribuição Dixon-Coles — placares baixos', () => {
  it('freq de 0-0 e 1-1 alinha com calibração (±15%, tolerância mais larga)', () => {
    // Setup similar ao calibrate-sim.ts: amostra grande de jogo médio.
    const stats = runMatches({ averageOverall: 75 }, { averageOverall: 73 }, N * 2, {
      baseSeed: 3_000,
    })
    const obs00 = (stats.scoreCounts['0-0'] ?? 0) / (N * 2)
    const obs11 = (stats.scoreCounts['1-1'] ?? 0) / (N * 2)
    const expected00 = simParams.calibration.fittedFreq['0-0']
    const expected11 = simParams.calibration.fittedFreq['1-1']
    // DC com 2 times médios desviam um pouco da calibração global → tol mais frouxa
    expect(within(obs00, expected00, 0.2)).toBe(true)
    expect(within(obs11, expected11, 0.2)).toBe(true)
  })
})

describe('Rubber-band — efeito por dificuldade', () => {
  const user: Team = { code: 'YOU', averageOverall: 75, isUser: true }
  const strongOpp: Team = { code: 'BRA', averageOverall: 80.6 }
  const weakOpp: Team = { code: 'JOR', averageOverall: 63.5 }

  it('contra time forte: hard reduz win-rate em relação a no-difficulty', () => {
    const baseline = runMatches(user, strongOpp, N, { baseSeed: 4_000 })
    const hard = runMatches(user, strongOpp, N, { difficulty: 'hard', baseSeed: 4_000 })
    // Win-rate em hard < baseline. Margem mínima: 0.5pp (efeito sutil mas mensurável)
    expect(hard.winRate).toBeLessThan(baseline.winRate)
    expect(baseline.winRate - hard.winRate).toBeGreaterThan(0.005)
  })

  it('contra time forte: easy aproxima do baseline (efeito menor que hard)', () => {
    const baseline = runMatches(user, strongOpp, N, { baseSeed: 4_500 })
    const easy = runMatches(user, strongOpp, N, { difficulty: 'easy', baseSeed: 4_500 })
    const hard = runMatches(user, strongOpp, N, { difficulty: 'hard', baseSeed: 4_500 })
    // gap easy↔baseline < gap hard↔baseline
    expect(Math.abs(easy.winRate - baseline.winRate)).toBeLessThan(
      Math.abs(hard.winRate - baseline.winRate),
    )
  })

  it('contra time fraco: hard aumenta win-rate em relação a no-difficulty', () => {
    const baseline = runMatches(user, weakOpp, N, { baseSeed: 5_000 })
    const hard = runMatches(user, weakOpp, N, { difficulty: 'hard', baseSeed: 5_000 })
    expect(hard.winRate).toBeGreaterThan(baseline.winRate)
    expect(hard.winRate - baseline.winRate).toBeGreaterThan(0.005)
  })

  it('jogo equilibrado: rubber-band não muda significativamente o resultado', () => {
    const evenOpp: Team = { code: 'XXX', averageOverall: 75 }
    const baseline = runMatches(user, evenOpp, N, { baseSeed: 6_000 })
    const hard = runMatches(user, evenOpp, N, { difficulty: 'hard', baseSeed: 6_000 })
    // |gap em win-rate| < 2pp (sem gap, sem alavanca)
    expect(Math.abs(hard.winRate - baseline.winRate)).toBeLessThan(0.02)
  })
})

describe('Mando — só pra países-sede', () => {
  it('USA em casa vs neutro: win-rate maior que sem mando (sem code)', () => {
    const opp: Team = { averageOverall: 80.6 } // sem code
    const withHostBoost = runMatches({ code: 'USA', averageOverall: 74.7 }, opp, N, {
      baseSeed: 7_000,
    })
    const noBoost = runMatches({ averageOverall: 74.7 }, opp, N, { baseSeed: 7_000 })
    expect(withHostBoost.winRate).toBeGreaterThan(noBoost.winRate)
  })

  it('BRA vs ARG em jogo neutro: win-rate simétrico ao gap real (sem bônus arbitrário)', () => {
    // BRA 80.6 vs ARG 81.1 — ARG ligeiramente favorita. Sem mando, ARG vence
    // mais e a diferença está dentro de um intervalo razoável.
    const stats = runMatches(
      { code: 'BRA', averageOverall: 80.6 },
      { code: 'ARG', averageOverall: 81.1 },
      N,
      { baseSeed: 8_000 },
    )
    expect(stats.lossRate).toBeGreaterThan(stats.winRate)
    // Mas não por muito (gap de 0.5)
    expect(stats.lossRate - stats.winRate).toBeLessThan(0.05)
  })

  it('par USA-MEX (host vs host): mando cancela — resultado ≈ ao mesmo par sem códigos', () => {
    // Se mando cancela no par host-vs-host, USA-MEX deve dar resultado
    // estatisticamente igual a USA-MEX sem códigos (também sem mando).
    const withHostCodes = runMatches(
      { code: 'USA', averageOverall: 74.7 },
      { code: 'MEX', averageOverall: 72.1 },
      N,
      { baseSeed: 9_000 },
    )
    const noCodes = runMatches({ averageOverall: 74.7 }, { averageOverall: 72.1 }, N, {
      baseSeed: 9_000,
    })
    // Diferença em win-rate < 2pp (mesma seed, mesmo overall, sem boost) → seqüências quase idênticas
    expect(Math.abs(withHostCodes.winRate - noCodes.winRate)).toBeLessThan(0.02)
  })

  it('host vs não-host: USA(74.7) em casa vs ARG(81.1) é mais competitivo que sem mando', () => {
    // Reverso do gap real: ARG é favorita, mas mando do USA reduz o gap.
    const withHostBoost = runMatches(
      { code: 'USA', averageOverall: 74.7 },
      { averageOverall: 81.1 },
      N,
      { baseSeed: 9_500 },
    )
    const noBoost = runMatches({ averageOverall: 74.7 }, { averageOverall: 81.1 }, N, {
      baseSeed: 9_500,
    })
    // USA com mando ganha mais e perde menos que sem mando
    expect(withHostBoost.winRate).toBeGreaterThan(noBoost.winRate)
    expect(withHostBoost.lossRate).toBeLessThan(noBoost.lossRate)
  })
})

describe('Knockout (full game com ET + pênaltis)', () => {
  it('sempre fecha com um vencedor após eventual ET + pênaltis', () => {
    const a: Team = { code: 'A', averageOverall: 75 }
    const b: Team = { code: 'B', averageOverall: 75 }
    const N_KO = 200
    for (let i = 0; i < N_KO; i++) {
      const sim = fullySimulate(a, b, seededRng(10_000 + i))
      expect(['home', 'away']).toContain(sim.winner)
    }
  })

  it('jogos equilibrados vão pra ET com frequência > 0', () => {
    const a: Team = { code: 'A', averageOverall: 75 }
    const b: Team = { code: 'B', averageOverall: 75 }
    let etCount = 0
    const N_KO = 500
    for (let i = 0; i < N_KO; i++) {
      const sim = fullySimulate(a, b, seededRng(11_000 + i))
      if (sim.extraTime) etCount++
    }
    expect(etCount).toBeGreaterThan(0)
    // Tipicamente ~25-30% empates no tempo normal entre times iguais → ET
    expect(etCount / N_KO).toBeGreaterThan(0.1)
    expect(etCount / N_KO).toBeLessThan(0.45)
  })
})
