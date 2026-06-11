/**
 * Compatibilidade entre posições granulares (estilo EA FC).
 *
 * COMPAT[slotPos] = posições do jogador que podem ocupar aquele slot.
 *
 * Princípio: bons jogadores costumam jogar em posições vizinhas. Vinicius
 * (LW) pode jogar de RW ou ST; Bellingham (CAM/CM) pode jogar de CDM ou ST
 * num esquema diferente. Goleiro só joga de goleiro.
 */
import type { SlotPosition } from './formations'

// Trio meio-campo central — qualquer um dos três joga em qualquer dos três.
const MID_CENTRAL = ['CDM', 'CM', 'CAM']

// Quarteto lados-meio: meias laterais e pontas casam entre si (ambos os lados).
// Vinicius vira ponta-direita, Mbappé vira ponta-esquerda — quem joga no flanco
// joga no outro num apertão.
const WIDE_MID_WING = ['LM', 'RM', 'LW', 'RW']

const COMPAT: Record<SlotPosition, string[]> = {
  GK: ['GK'],

  // Zagueiros aceitam laterais (zagueiro improvisado de lateral é raro,
  // mas lateral fechando como CB acontece o tempo todo).
  CB: ['CB', 'LB', 'RB'],

  // Laterais aceitam CB + alas. Lado errado também serve num pinch.
  LB: ['LB', 'RB', 'LWB', 'CB', 'LM'],
  RB: ['RB', 'LB', 'RWB', 'CB', 'RM'],
  LWB: ['LWB', 'LB', 'RWB', 'LM'],
  RWB: ['RWB', 'RB', 'LWB', 'RM'],

  // Meio central — qualquer um dos três
  CDM: MID_CENTRAL,
  CM: MID_CENTRAL,
  CAM: [...MID_CENTRAL, 'CF'],

  // Meias laterais e pontas — todos casam, com ou sem lado certo
  LM: [...WIDE_MID_WING, 'LB', 'LWB'],
  RM: [...WIDE_MID_WING, 'RB', 'RWB'],
  LW: [...WIDE_MID_WING, 'LF', 'RF', 'ST', 'CF'],
  RW: [...WIDE_MID_WING, 'LF', 'RF', 'ST', 'CF'],

  ST: ['ST', 'CF', 'LW', 'RW', 'LF', 'RF'],
  CF: ['CF', 'ST', 'CAM', 'LW', 'RW'],
}

export function isCompatible(
  slot: SlotPosition,
  primary: string | undefined,
  alt: string[] | undefined,
): boolean {
  const allowed = COMPAT[slot]
  if (primary && allowed.includes(primary)) return true
  if (alt && alt.some((p) => allowed.includes(p))) return true
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
