/**
 * Modificadores de dificuldade por partida — narrativa do torneio.
 *
 * Dois eixos aditivos que somam num número [0, 0.10] aplicado como
 * multiplicador no overall efetivo do XI do user (em `simulate.ts:rates`).
 *
 * 1. Fase: estreia carrega nervosismo (+3%), KO escala leve (1→5%).
 * 2. Adversário: tier S (clássicos mundiais) +3%, tier A +2%, tier B +1%.
 *
 * Esse signal SUBSTITUIU a dependência do rubber-band na dificuldade do
 * draft — easy/medium/hard hoje só controla os skips da escalação, não
 * mexe mais na simulação.
 */

export type MatchPhase =
  | 'group-debut' // primeiro jogo do grupo (estreia, +3% pelo nervosismo)
  | 'group-other' // jogos 2 e 3 do grupo (sem bump)
  | 'R32'
  | 'R16'
  | 'QF'
  | 'SF'
  | 'F'

export const PHASE_MODIFIER: Record<MatchPhase, number> = {
  'group-debut': 0.03,
  'group-other': 0,
  R32: 0.01,
  R16: 0.02,
  QF: 0.03,
  SF: 0.04,
  F: 0.05,
}

export type OpponentTier = 'S' | 'A' | 'B' | 'C'

export const OPPONENT_TIER_MODIFIER: Record<OpponentTier, number> = {
  S: 0.03,
  A: 0.02,
  B: 0.01,
  C: 0,
}

/**
 * Curado por nome — mescla aura histórica (Copas/títulos) com programa
 * forte atual. Pode ser refinado com FIFA ranking se virar relevante.
 *
 * Default pra códigos não listados: 'C' (sem bump).
 */
const TIER_BY_CODE: Record<string, OpponentTier> = {
  // S — clássicos mundiais (5x ou mais Copas, ou aura histórica equivalente)
  BRA: 'S',
  ARG: 'S',
  GER: 'S',
  FRA: 'S',
  ESP: 'S',
  // A — programa forte (Copas + grande presença internacional consistente)
  ENG: 'A',
  NED: 'A',
  POR: 'A',
  URU: 'A',
  BEL: 'A',
  // B — sólidos modernos (Copas recentes ou ranking top 20-25)
  CRO: 'B',
  COL: 'B',
  MEX: 'B',
  USA: 'B',
  MAR: 'B',
  JPN: 'B',
}

export function opponentTier(code: string): OpponentTier {
  return TIER_BY_CODE[code.toUpperCase()] ?? 'C'
}

export function phaseModifier(phase: MatchPhase): number {
  return PHASE_MODIFIER[phase]
}

export function opponentModifier(code: string): number {
  return OPPONENT_TIER_MODIFIER[opponentTier(code)]
}

/**
 * Soma aditiva dos dois eixos. Cap superior natural: SF (+4%) + tier S
 * (+3%) = +7%, ou Final (+5%) + tier S = +8%. Estreia contra tier S = +6%.
 */
export function matchPressure(phase: MatchPhase, opponentCode: string): number {
  return phaseModifier(phase) + opponentModifier(opponentCode)
}

// ============================================================
// Player synergy — estrelas no XI bumpam o time todo.
//
// Mecânica oposta ao matchPressure: cada player do XI que se qualifica
// como estrela contribui com um bônus aditivo no overall do user.
// Stacking parcial: top 3 da equipe ordenados por tier → overall, com
// pesos 100% / 50% / 25% das tier bonuses. Demais não contam.
// ============================================================

export type SynergyTier = 1 | 2 | 3

/** Curado por nome — 4 icons que carregam o time independente do rating. */
const SYNERGY_TIER1_NAMES = new Set<string>([
  'Lionel Messi',
  'Kylian Mbappé',
  'Erling Haaland',
  'Cristiano Ronaldo',
])

const SYNERGY_TIER_BONUS: Record<SynergyTier, number> = {
  1: 0.04,
  2: 0.03,
  3: 0.01,
}

/** Pesos compostos: top star 100%, 2º 50%, 3º 25%. 4º+ ignorado. */
export const SYNERGY_STACK_WEIGHTS: readonly number[] = [1.0, 0.5, 0.25]

/**
 * Classifica um player por tier de sinergia (ou null se não é "estrela"):
 * - tier 1: nomes curados (icons) — Messi, Mbappé, Haaland, CR7
 * - tier 2: overall calibrado entre 91 e 94
 * - tier 3: overall calibrado entre 88 e 90
 * - 95+ não curado também cai em tier 1 (defesa contra futuras adições)
 */
export function synergyTier(name: string, overall: number): SynergyTier | null {
  if (SYNERGY_TIER1_NAMES.has(name)) return 1
  if (overall >= 95) return 1
  if (overall >= 91 && overall <= 94) return 2
  if (overall >= 88 && overall <= 90) return 3
  return null
}

export interface StarPick {
  name: string
  overall: number
  tier: SynergyTier
  /** Bônus base do tier (sem o peso de stacking). */
  bonus: number
}

export interface SynergyResult {
  /** Top 3 estrelas escolhidas (ordenadas por tier → overall → nome). */
  stars: StarPick[]
  /** Bônus total composto, depois do stacking. */
  bonus: number
}

/**
 * Calcula o bônus de sinergia do XI. Recebe players com `{ name, overall }`,
 * filtra os que se qualificam, ordena por tier (1 primeiro) → overall desc
 * → nome (estável), pega top 3, aplica pesos 100% / 50% / 25%.
 *
 * Bônus aditivo (no formato esperado por `simulate.ts:rates`): 0.0625 = 6.25%.
 */
export function playerSynergy(
  players: ReadonlyArray<{ name: string; overall: number }>,
): SynergyResult {
  const stars: StarPick[] = []
  for (const p of players) {
    const tier = synergyTier(p.name, p.overall)
    if (tier != null) {
      stars.push({ name: p.name, overall: p.overall, tier, bonus: SYNERGY_TIER_BONUS[tier] })
    }
  }
  stars.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    if (b.overall !== a.overall) return b.overall - a.overall
    return a.name.localeCompare(b.name)
  })
  const top = stars.slice(0, SYNERGY_STACK_WEIGHTS.length)
  let bonus = 0
  for (let i = 0; i < top.length; i++) {
    bonus += top[i].bonus * SYNERGY_STACK_WEIGHTS[i]
  }
  return { stars: top, bonus }
}
