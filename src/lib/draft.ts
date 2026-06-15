/**
 * Lógica do draft: sorteio de país com cooldown, escolha de jogador, estado do XI.
 */
import { squads, type Player, type Squad } from '../data/squads'

import {
  DIFFICULTY_SKIPS,
  FORMATIONS,
  type Difficulty,
  type Formation,
  type Style,
  type SlotPosition,
} from './formations'
import { compatiblePlayers } from './positions'

export const COUNTRY_COOLDOWN = 5

export interface DraftSlot {
  pos: SlotPosition
  x: number
  y: number
  player?: ChosenPlayer
  /**
   * Resultado do dado pra esse slot que ainda não virou pick. Sobrevive a
   * fechar/reabrir o drawer — o usuário vê o mesmo sorteio em vez de rodar
   * de novo. Limpa em pickPlayer ou em useSkip.
   */
  pendingSquadCode?: string
}

export interface ChosenPlayer {
  player: Player
  /** código do país de onde o jogador veio (necessário porque squads são separadas) */
  countryCode: string
  countryName: string
  countryFlag: string
}

export interface DraftState {
  formationName: string
  formation: Formation
  style: Style
  difficulty: Difficulty
  slots: DraftSlot[]
  /** códigos dos países sorteados na ordem cronológica (último = mais recente) */
  rolledCountries: string[]
  /** códigos dos países cujos jogadores já estão no XI (não pode ter dois do mesmo país) */
  pickedCountries: string[]
  /** quantos skips restantes (decrementa ao usar). */
  skipsRemaining: number
  /** total inicial de skips, pra mostrar X/Y no resumo. */
  skipsTotal: number
}

export function createDraft(
  formationName: string,
  style: Style,
  difficulty: Difficulty,
): DraftState {
  const formation = FORMATIONS[formationName]
  if (!formation) throw new Error(`formação desconhecida: ${formationName}`)
  const skips = DIFFICULTY_SKIPS[difficulty]
  return {
    formationName,
    formation,
    style,
    difficulty,
    slots: formation.slots.map((s) => ({ ...s })),
    rolledCountries: [],
    pickedCountries: [],
    skipsRemaining: skips,
    skipsTotal: skips,
  }
}

/** Decrementa o contador de skips. Retorna novo state. Lança se 0. */
export function useSkip(state: DraftState): DraftState {
  if (state.skipsRemaining <= 0) throw new Error('sem skips restantes')
  return { ...state, skipsRemaining: state.skipsRemaining - 1 }
}

/** Países que ainda podem ser sorteados (não em cooldown + não já escolhidos). */
export function eligibleCountries(state: DraftState): Squad[] {
  const cooldown = new Set(state.rolledCountries.slice(-COUNTRY_COOLDOWN))
  const picked = new Set(state.pickedCountries)
  return squads.filter((s) => !cooldown.has(s.code) && !picked.has(s.code))
}

export interface RollResult {
  squad: Squad
  /** jogadores daquela seleção compatíveis com a posição do slot */
  candidates: Player[]
}

export function rollForSlot(
  state: DraftState,
  slotIndex: number,
  rng: () => number = Math.random,
): RollResult {
  const slot = state.slots[slotIndex]
  if (!slot) throw new Error(`slot inválido: ${slotIndex}`)
  if (slot.player) throw new Error(`slot ${slotIndex} já tem jogador (${slot.player.player.name})`)

  const pool = eligibleCountries(state)
  if (pool.length === 0) throw new Error('nenhum país elegível para sorteio')

  const squad = pool[Math.floor(rng() * pool.length)]
  const candidates = compatiblePlayers(slot.pos, squad.players)

  return { squad, candidates }
}

/** Aplica o sorteio ao state. Retorna novo state imutável. */
export function applyRoll(state: DraftState, squadCode: string): DraftState {
  return {
    ...state,
    rolledCountries: [...state.rolledCountries, squadCode],
  }
}

/**
 * Sorteia até encontrar uma seleção com pelo menos um jogador compatível com o slot.
 * Cada tentativa que falha entra no cooldown.
 *
 * Retorna o novo state já com os rolls aplicados, a seleção final e os candidatos.
 */
export interface RollUntilResult {
  state: DraftState
  squad: Squad
  candidates: Player[]
  /** seleções tentadas antes da que deu certo (sem candidatos). */
  skipped: Squad[]
}

export function rollUntilCompatible(
  state: DraftState,
  slotIndex: number,
  rng: () => number = Math.random,
): RollUntilResult {
  const slot = state.slots[slotIndex]
  if (!slot) throw new Error(`slot inválido: ${slotIndex}`)
  if (slot.player) throw new Error(`slot ${slotIndex} já tem jogador`)

  let currentState = state
  const skipped: Squad[] = []
  const MAX_ATTEMPTS = 12

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const pool = eligibleCountries(currentState)
    if (pool.length === 0) throw new Error('nenhum país elegível para sortear')

    const squad = pool[Math.floor(rng() * pool.length)]
    const candidates = compatiblePlayers(slot.pos, squad.players)
    currentState = applyRoll(currentState, squad.code)

    if (candidates.length > 0) {
      // Marca o resultado no slot pra sobreviver fechar/reabrir o drawer.
      currentState = setPendingRoll(currentState, slotIndex, squad.code)
      return { state: currentState, squad, candidates, skipped }
    }
    skipped.push(squad)
  }

  throw new Error('limite de tentativas excedido sem achar seleção compatível')
}

/** Marca um sorteio pendente num slot. Limpa em pickPlayer ou clearPendingRoll. */
export function setPendingRoll(
  state: DraftState,
  slotIndex: number,
  squadCode: string,
): DraftState {
  const slots = state.slots.map((s, i) =>
    i === slotIndex ? { ...s, pendingSquadCode: squadCode } : s,
  )
  return { ...state, slots }
}

/** Limpa o sorteio pendente (usado quando o user pula). */
export function clearPendingRoll(state: DraftState, slotIndex: number): DraftState {
  const slots = state.slots.map((s, i) =>
    i === slotIndex ? { ...s, pendingSquadCode: undefined } : s,
  )
  return { ...state, slots }
}

/** Escolhe um jogador pra um slot. Marca o país como picked. */
export function pickPlayer(
  state: DraftState,
  slotIndex: number,
  player: Player,
  squad: Squad,
): DraftState {
  const slot = state.slots[slotIndex]
  if (!slot) throw new Error(`slot inválido: ${slotIndex}`)
  if (slot.player) throw new Error(`slot ${slotIndex} já preenchido`)

  const newSlots = state.slots.map((s, i) =>
    i === slotIndex
      ? {
          ...s,
          player: {
            player,
            countryCode: squad.code,
            countryName: squad.country,
            countryFlag: squad.flag,
          },
          pendingSquadCode: undefined,
        }
      : s,
  )

  return {
    ...state,
    slots: newSlots,
    pickedCountries: [...state.pickedCountries, squad.code],
  }
}

export function isComplete(state: DraftState): boolean {
  return state.slots.every((s) => s.player != null)
}

export function averageOverall(state: DraftState): number {
  const filled = state.slots.filter((s) => s.player)
  if (filled.length === 0) return 0
  const sum = filled.reduce((s, slot) => s + (slot.player?.player.overall ?? 0), 0)
  return Math.round((sum / filled.length) * 10) / 10
}

export function totalValueEur(state: DraftState): number {
  return state.slots.reduce((s, slot) => {
    const p = slot.player?.player
    if (!p) return s
    return s + (p.value_eur ?? p.value_eur_tm ?? 0)
  }, 0)
}
