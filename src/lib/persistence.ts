/**
 * Persistência leve em localStorage pra carregar draft entre rotas e
 * sobreviver a refresh durante uma partida.
 */
import { FORMATIONS, type Formation } from './formations'
import type { DraftState } from './draft'
import type { GroupStage } from './groups'
import type { KnockoutBracket } from './bracket'

const KEY_DRAFT = 'd26:draft'
const KEY_STAGE = 'd26:stage'
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

export function saveStage(draft: DraftState, stage: GroupStage): void {
  saveDraft(draft)
  safeWrite(KEY_STAGE, stage)
}

export function loadStage(): { draft: DraftState; stage: GroupStage } | null {
  const draft = loadDraft()
  const stage = safeRead<GroupStage>(KEY_STAGE)
  if (!draft || !stage) return null
  return { draft, stage }
}

/**
 * Limpa só o stage da fase de grupos e o bracket (que é downstream).
 * NÃO mexe no draft — quem quer reset completo do XI deve chamar `clearDraft()`
 * separadamente. Esse split evita o bug clássico de chamar saveDraft seguido
 * de clearStage e perder o draft recém-gravado.
 */
export function clearStage(): void {
  clearBracket()
  try {
    window.localStorage.removeItem(KEY_STAGE)
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
