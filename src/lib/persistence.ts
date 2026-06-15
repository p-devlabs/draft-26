/**
 * Persistência leve em localStorage pra carregar draft entre rotas e
 * sobreviver a refresh durante uma partida.
 */
import { FORMATIONS, type Formation } from './formations'

import type { KnockoutBracket } from './bracket'
import type { DraftState } from './draft'
import type { WorldCupGroups } from './groups'

const KEY_DRAFT = 'd26:draft'
// Versão antiga (d26:stage) guardava só GroupStage. Bumped pra worldcup quando
// a fase virou 12 grupos. Saves antigos ficam órfãos — load retorna null e o
// usuário recomeça a fase de grupos.
const KEY_WORLDCUP = 'd26:worldcup'
const KEY_BRACKET = 'd26:bracket'
const KEY_SPEED = 'd26:speed'

type StoredSpeed = 'slow' | 'normal' | 'fast'

function safeRead<T>(key: string): T | null {
  try {
    const v = window.localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}

function safeWrite(key: string, val: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(val))
  } catch {
    /* ignore — quota etc */
  }
}

export function saveDraft(draft: DraftState): void {
  // não persiste o objeto Formation (deriva), só o nome
  const { formation: _omit, ...rest } = draft
  void _omit
  safeWrite(KEY_DRAFT, rest)
}

export function loadDraft(): DraftState | null {
  const raw = safeRead<Omit<DraftState, 'formation'>>(KEY_DRAFT)
  if (!raw) return null
  const formation: Formation | undefined = FORMATIONS[raw.formationName]
  if (!formation) return null
  return { ...raw, formation }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(KEY_DRAFT)
  } catch {
    /* ignore */
  }
}

export function saveWorldCup(draft: DraftState, worldCup: WorldCupGroups): void {
  saveDraft(draft)
  safeWrite(KEY_WORLDCUP, worldCup)
}

export function loadWorldCup(): { draft: DraftState; worldCup: WorldCupGroups } | null {
  const draft = loadDraft()
  const worldCup = safeRead<WorldCupGroups>(KEY_WORLDCUP)
  if (!draft || !worldCup) return null
  return { draft, worldCup }
}

/**
 * Limpa o estado da fase de grupos e o bracket (que é downstream).
 * NÃO mexe no draft — quem quer reset completo do XI deve chamar `clearDraft()`
 * separadamente. Esse split evita o bug clássico de chamar saveDraft seguido
 * de clearWorldCup e perder o draft recém-gravado.
 */
export function clearWorldCup(): void {
  clearBracket()
  try {
    window.localStorage.removeItem(KEY_WORLDCUP)
  } catch {
    /* ignore */
  }
}

export function saveBracket(bracket: KnockoutBracket): void {
  safeWrite(KEY_BRACKET, bracket)
}

export function loadBracket(): KnockoutBracket | null {
  return safeRead<KnockoutBracket>(KEY_BRACKET)
}

export function clearBracket(): void {
  try {
    window.localStorage.removeItem(KEY_BRACKET)
  } catch {
    /* ignore */
  }
}

export function loadMatchSpeed(): StoredSpeed {
  const v = safeRead<StoredSpeed>(KEY_SPEED)
  if (v === 'slow' || v === 'normal' || v === 'fast') return v
  return 'normal'
}

export function saveMatchSpeed(s: StoredSpeed): void {
  safeWrite(KEY_SPEED, s)
}
