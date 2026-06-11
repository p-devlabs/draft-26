/**
 * Compatibilidade slot → posição principal do jogador.
 *
 * Matching 1:1 estrito: cada slot só aceita jogadores cuja primaryPosition
 * é exatamente a do slot. Exceções pras posições com 0 jogadores na base
 * (data/squads-enriched.json não traz LWB/RWB/CF como primary):
 *
 *   LWB → fallback LB
 *   RWB → fallback RB
 *   CF  → fallback ST
 *
 * As alternativas (altPositions[]) ficam de fora por enquanto — precisam
 * de curadoria antes de virar parte do match.
 */
import type { SlotPosition } from './formations'

const COMPAT: Record<SlotPosition, string[]> = {
  GK: ['GK'],
  CB: ['CB'],
  LB: ['LB'],
  RB: ['RB'],
  LWB: ['LWB', 'LB'],
  RWB: ['RWB', 'RB'],
  CDM: ['CDM'],
  CM: ['CM'],
  CAM: ['CAM'],
  LM: ['LM'],
  RM: ['RM'],
  LW: ['LW'],
  RW: ['RW'],
  CF: ['CF', 'ST'],
  ST: ['ST'],
}

export function isCompatible(
  slot: SlotPosition,
  primary: string | undefined,
  _alt: string[] | undefined,
): boolean {
  // Por ora só considera a posição principal — altPositions ainda precisa
  // de curadoria. Voltar aqui quando o critério das alternativas estiver definido.
  const allowed = COMPAT[slot]
  if (primary && allowed.includes(primary)) return true
  return false
}

/** Para filtrar jogadores que servem num slot. */
export function compatiblePlayers<
  T extends { primaryPosition?: string; altPositions?: string[] },
>(slot: SlotPosition, players: T[]): T[] {
  return players.filter((p) => isCompatible(slot, p.primaryPosition, p.altPositions))
}

export const SLOT_LABEL: Record<SlotPosition, string> = {
  GK: 'Goleiro',
  CB: 'Zagueiro',
  LB: 'Lateral esquerdo',
  RB: 'Lateral direito',
  LWB: 'Ala esquerdo',
  RWB: 'Ala direito',
  CDM: 'Volante',
  CM: 'Meia central',
  CAM: 'Meia atacante',
  LM: 'Meia esquerda',
  RM: 'Meia direita',
  LW: 'Ponta esquerda',
  RW: 'Ponta direita',
  CF: 'Falso 9',
  ST: 'Centroavante',
}
