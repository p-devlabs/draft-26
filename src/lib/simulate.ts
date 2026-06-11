/**
 * Motor de simulação de partida — Poisson ponderada por overall.
 *
 * Modelo:
 *   - cada time tem uma "taxa de gols" λ derivada do seu overall vs o do adversário
 *   - λ vira média de uma Poisson; sorteamos gols inteiros
 *   - mando de campo dá +2 ao overall do mandante
 *   - taxa média de gols por jogo da Copa moderna é ~2.6
 *
 * Não é F1 do tactical realism — é só pra dar resultados plausíveis e variáveis.
 */

const AVG_GOALS_PER_MATCH = 2.6
const HOME_ADVANTAGE = 2 // overall a mais pro mandante

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

/** Sample de Poisson via Knuth (suficiente pra λ < 30). */
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

export function simulateMatch(
  home: Team,
  away: Team,
  rng: () => number = Math.random,
): MatchResult {
  const homeStr = home.averageOverall + HOME_ADVANTAGE
  const awayStr = away.averageOverall
  // peso exponencial pra que diferenças amplifiquem
  const homeWeight = Math.pow(homeStr / 50, 1.5)
  const awayWeight = Math.pow(awayStr / 50, 1.5)
  const total = homeWeight + awayWeight
  const homeRate = (homeWeight / total) * AVG_GOALS_PER_MATCH
  const awayRate = (awayWeight / total) * AVG_GOALS_PER_MATCH

  return {
    homeGoals: samplePoisson(homeRate, rng),
    awayGoals: samplePoisson(awayRate, rng),
  }
}
