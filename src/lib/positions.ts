/**
 * Compatibilidade slot → posições do jogador (primary + alternativas).
 *
 * Um jogador serve num slot se sua primaryPosition OU qualquer altPosition
 * está em COMPAT[slot]. Curadoria das alt vem do enrich:fifa (EA FC 26),
 * enrich:alt-positions (TM sub_position + heurística) e data/position-overrides.json.
 *
 * Bridges padrão (slot → posições aceitas além de si mesmo):
 *   LWB → LB        (poucos LWB primários na base)
 *   RWB → RB        (idem)
 *   CF  → ST        (poucos CF primários na base)
 *   LB  → LWB       (LB moderno joga ala)
 *   RB  → RWB
 *   LW  → LM        (ponta também cobre meia-esquerda)
 *   RW  → RM
 *   LM  → LW        (e vice-versa)
 *   RM  → RW
 *
 * Já o cruzamento CM/CDM/CAM vem do dado, não do bridge — evita transformar
 * todo volante em camisa 10.
 */
import type { SlotPosition } from './formations'

const COMPAT: Record<SlotPosition, string[]> = {
  GK: ['GK'],
  CB: ['CB'],
  LB: ['LB', 'LWB'],
  RB: ['RB', 'RWB'],
  LWB: ['LWB', 'LB'],
  RWB: ['RWB', 'RB'],
  CDM: ['CDM'],
  CM: ['CM'],
  CAM: ['CAM'],
  LM: ['LM', 'LW'],
  RM: ['RM', 'RW'],
  LW: ['LW', 'LM'],
  RW: ['RW', 'RM'],
  CF: ['CF', 'ST'],
  ST: ['ST'],
}

export function isCompatible(
  slot: SlotPosition,
  primary: string | undefined,
  alt: string[] | undefined,
): boolean {
  const allowed = COMPAT[slot]
  if (primary && allowed.includes(primary)) return true
  if (alt?.some((p) => allowed.includes(p))) return true
  return false
}

/** Para filtrar jogadores que servem num slot. */
export function compatiblePlayers<T extends { primaryPosition?: string; altPositions?: string[] }>(
  slot: SlotPosition,
  players: T[],
): T[] {
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
