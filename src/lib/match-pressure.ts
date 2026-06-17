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
