/**
 * Motor de simulação de partida — Dixon-Coles (1997) sobre Poisson ponderada.
 *
 * Modelo:
 *   - cada time tem taxa de gols λ derivada do seu overall vs o do adversário
 *   - λ_home e λ_away geram um PMF conjunto Poisson independente
 *   - aplica o ajuste τ(x,y,λ,μ,ρ) de Dixon-Coles nos placares 0-0, 0-1, 1-0, 1-1
 *     pra corrigir a correlação que Poisson independente ignora
 *   - amostragem via grid 0..8 × 0..8 + inverse CDF (placares acima de 8 têm prob ~0)
 *   - mando dá +HOME_ADVANTAGE ao overall do mandante
 *
 * Parâmetros (ρ, mando, gols/jogo) vêm de `data/sim-params.json`, fitados em
 * scripts/calibrate-sim.ts contra ~5800 jogos competitivos de seleção pós-2018
 * (martj42/international_results). Pra recalibrar: `pnpm calibrate:sim`.
 *
 * Referência: Dixon &amp; Coles (1997), "Modelling Association Football Scores...".
 */
import simParams from '../../data/sim-params.json'

const AVG_GOALS_PER_MATCH = simParams.avgGoalsPerMatch
const HOME_ADVANTAGE = simParams.homeAdvantage
const DC_RHO = simParams.rho

const MAX_GOALS = 8 // teto do grid de amostragem; P(x ≥ 8 | λ ≤ 3) ≈ 0

export interface Team {
  averageOverall: number
}

export interface MatchResult {
  homeGoals: number
  awayGoals: number
}

/** RNG seedeável (Mulberry32). Padrão é Math.random. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** P(X = k) para X ~ Poisson(λ). */
function poissonPmf(k: number, lambda: number): number {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}

/**
 * Fator τ de Dixon-Coles. Multiplica P(x, y) Poisson independente nas 4 caixas
 * baixas. Fora delas, τ = 1 e o modelo coincide com Poisson independente.
 */
function dixonColesTau(x: number, y: number, lambda: number, mu: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lambda * mu * rho
  if (x === 0 && y === 1) return 1 + lambda * rho
  if (x === 1 && y === 0) return 1 + mu * rho
  if (x === 1 && y === 1) return 1 - rho
  return 1
}

/** Converte overall do par (mandante, visitante) em (λ, μ) da Poisson. */
function rates(home: Team, away: Team): { lambda: number; mu: number } {
  const homeStr = home.averageOverall + HOME_ADVANTAGE
  const awayStr = away.averageOverall
  const homeWeight = Math.pow(homeStr / 50, 1.5)
  const awayWeight = Math.pow(awayStr / 50, 1.5)
  const total = homeWeight + awayWeight
  return {
    lambda: (homeWeight / total) * AVG_GOALS_PER_MATCH,
    mu: (awayWeight / total) * AVG_GOALS_PER_MATCH,
  }
}

export function simulateMatch(
  home: Team,
  away: Team,
  rng: () => number = Math.random,
): MatchResult {
  const { lambda, mu } = rates(home, away)

  // PMFs marginais (uma vez cada k)
  const homePmf: number[] = new Array(MAX_GOALS + 1)
  const awayPmf: number[] = new Array(MAX_GOALS + 1)
  for (let k = 0; k <= MAX_GOALS; k++) {
    homePmf[k] = poissonPmf(k, lambda)
    awayPmf[k] = poissonPmf(k, mu)
  }

  // Grid conjunto com ajuste Dixon-Coles + soma pra normalizar (cobre o "vazamento"
  // de massa pra x > MAX_GOALS e a renormalização após o τ).
  let total = 0
  const probs: number[] = new Array((MAX_GOALS + 1) * (MAX_GOALS + 1))
  for (let x = 0; x <= MAX_GOALS; x++) {
    for (let y = 0; y <= MAX_GOALS; y++) {
      const p = homePmf[x] * awayPmf[y] * dixonColesTau(x, y, lambda, mu, DC_RHO)
      probs[x * (MAX_GOALS + 1) + y] = p
      total += p
    }
  }

  // Inverse CDF
  const r = rng() * total
  let cum = 0
  for (let x = 0; x <= MAX_GOALS; x++) {
    for (let y = 0; y <= MAX_GOALS; y++) {
      cum += probs[x * (MAX_GOALS + 1) + y]
      if (r <= cum) return { homeGoals: x, awayGoals: y }
    }
  }
  // Salvaguarda numérica (massa restante por floating point)
  return { homeGoals: 0, awayGoals: 0 }
}
