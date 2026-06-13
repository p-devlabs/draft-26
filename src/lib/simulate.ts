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
 * Rubber-band (opcional, ativado quando `opts.difficulty` é passado):
 *   Quando um dos times tem `isUser:true`, o overall efetivo dele é puxado
 *   pra longe do adversário: `effective = user - intensity * (opp - user)`.
 *   Assim adversários mais fortes ficam ainda mais fortes ANTES de virar λ,
 *   e adversários fracos ficam mais fracos — só nos jogos do usuário.
 *   `intensity = rubberBand.base * rubberBand.byDifficulty[difficulty]`.
 *   Jogos CPU vs CPU continuam usando o modelo puro calibrado.
 *
 * Referência: Dixon &amp; Coles (1997), "Modelling Association Football Scores...".
 */
import simParams from '../../data/sim-params.json'
import type { Difficulty } from './formations'

const AVG_GOALS_PER_MATCH = simParams.avgGoalsPerMatch
const HOME_ADVANTAGE = simParams.homeAdvantage
const DC_RHO = simParams.rho
const RUBBER_BAND = simParams.rubberBand as {
  base: number
  byDifficulty: Record<Difficulty, number>
}

/**
 * Países-sede da Copa 2026 — só eles recebem mando de campo. A label "home"
 * no chaveamento é arbitrária; pra todos os outros pares o jogo é tratado
 * como neutro (sem bônus). USA/MEX vs USA/MEX cancela (improvável: só na
 * final no formato 2026, e dependeria do bracket caindo assim).
 */
const HOST_NATIONS = new Set(['USA', 'MEX', 'CAN'])

const MAX_GOALS = 8 // teto do grid de amostragem; P(x ≥ 8 | λ ≤ 3) ≈ 0

export interface Team {
  averageOverall: number
  /** Código do país (ex: 'BRA', 'USA') — usado pra detectar país-sede. */
  code?: string
  /** Marca o XI do usuário pra aplicar o rubber-band assimétrico. */
  isUser?: boolean
}

export interface MatchResult {
  homeGoals: number
  awayGoals: number
}

export interface SimOptions {
  /**
   * Dificuldade do draft do usuário. Quando presente E um dos times é o XI
   * (isUser:true), aplica o rubber-band. Quando omitida, sim segue o modelo
   * calibrado puro (sem assimetria).
   */
  difficulty?: Difficulty
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

/**
 * Aplica o rubber-band ao overall do XI do user, baseado no gap com o adversário.
 * Gap positivo (oponente mais forte) puxa o user PRA BAIXO; negativo, pra cima.
 */
function rubberBandOverall(
  userOverall: number,
  opponentOverall: number,
  difficulty: Difficulty,
): number {
  const intensity = RUBBER_BAND.base * RUBBER_BAND.byDifficulty[difficulty]
  const gap = opponentOverall - userOverall
  return userOverall - intensity * gap
}

/** Converte overall do par (mandante, visitante) em (λ, μ) da Poisson. */
function rates(home: Team, away: Team, opts?: SimOptions): { lambda: number; mu: number } {
  // Rubber-band: só ativa quando difficulty foi passada E um dos times é o user.
  // Ajuste é simétrico em direção (puxa pra longe do adversário) mas só atinge
  // o lado do user — o adversário fica intacto.
  let homeBase = home.averageOverall
  let awayBase = away.averageOverall
  if (opts?.difficulty) {
    if (home.isUser) homeBase = rubberBandOverall(homeBase, awayBase, opts.difficulty)
    if (away.isUser) awayBase = rubberBandOverall(awayBase, homeBase, opts.difficulty)
  }
  // Mando: só pra países-sede. Pares neutros não recebem bônus. Quando os
  // dois são hosts (caso de borda), o bônus cancela e o jogo vira neutro.
  const homeHosts = home.code ? HOST_NATIONS.has(home.code) : false
  const awayHosts = away.code ? HOST_NATIONS.has(away.code) : false
  const homeBoost = homeHosts && !awayHosts ? HOME_ADVANTAGE : 0
  const awayBoost = awayHosts && !homeHosts ? HOME_ADVANTAGE : 0
  const homeStr = homeBase + homeBoost
  const awayStr = awayBase + awayBoost
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
  opts?: SimOptions,
): MatchResult {
  const { lambda, mu } = rates(home, away, opts)

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
