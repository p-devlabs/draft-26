import { averageOverall, type DraftState } from './draft'
import { supabase, isSupabaseConfigured } from './supabase'

import type { KnockoutBracket, KORound } from './bracket'
import type { GroupStage } from './groups'

const LOCAL_RUN_ID_KEY = 'd26:runId'

export type FinishedRound = 'group' | KORound | 'CHAMPION'

export function getLocalRunId(): string | null {
  return localStorage.getItem(LOCAL_RUN_ID_KEY)
}

export function clearLocalRunId(): void {
  localStorage.removeItem(LOCAL_RUN_ID_KEY)
}

/**
 * Marca a run atual como pública (`is_public`) — chamado ao compartilhar, pra o
 * deep link /r/<id> abrir pra terceiros mesmo em meio de campanha. Fire-and-forget.
 */
export async function markRunShared(): Promise<void> {
  const id = getLocalRunId()
  if (!id || !isSupabaseConfigured) return
  try {
    const { error } = await supabase.from('runs').update({ is_public: true }).eq('id', id)
    if (error) console.warn('[runs] mark shared falhou:', error.message)
  } catch (err) {
    console.warn('[runs] mark shared jogou exceção:', err)
  }
}

/**
 * Garante sessão anônima no Supabase. Se anonymous sign-ins não estiver habilitado
 * no projeto, devolve null e a app segue só com localStorage.
 */
export async function ensureAnonUser(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) return session.user.id
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) {
      console.warn('[runs] anon sign-in falhou:', error.message)
      return null
    }
    return data.user?.id ?? null
  } catch (err) {
    console.warn('[runs] anon sign-in jogou exceção:', err)
    return null
  }
}

/**
 * Cria a row de run no Supabase. Persiste o id em localStorage pra updates subsequentes.
 * Fire-and-forget: se falhar, retorna null e a app segue normal (localStorage é fonte primária).
 */
export async function createRun(input: {
  draft: DraftState
  stage: GroupStage
}): Promise<string | null> {
  const userId = await ensureAnonUser()
  if (!userId) return null
  try {
    const { data, error } = await supabase
      .from('runs')
      .insert({
        user_id: userId,
        replaced_code: input.stage.replacedTeam.code,
        formation: input.draft.formationName,
        difficulty: input.draft.difficulty,
        average_overall: averageOverall(input.draft),
        draft_json: input.draft,
        stage_json: input.stage,
      })
      .select('id')
      .single()
    if (error) {
      console.warn('[runs] insert falhou:', error.message)
      return null
    }
    localStorage.setItem(LOCAL_RUN_ID_KEY, data.id)
    return data.id
  } catch (err) {
    console.warn('[runs] insert jogou exceção:', err)
    return null
  }
}

/**
 * Patch parcial na run atual. Tudo opcional — passa só o que mudou.
 * Se `finishedRound` vier preenchido, fecha a run (seta completed_at).
 */
export async function syncRun(patch: {
  stage?: GroupStage
  bracket?: KnockoutBracket
  finishedRound?: FinishedRound
}): Promise<void> {
  const id = getLocalRunId()
  if (!id || !isSupabaseConfigured) return
  const update: Record<string, unknown> = {}
  if (patch.stage) update.stage_json = patch.stage
  if (patch.bracket) {
    update.bracket_json = patch.bracket
    if (patch.bracket.champion) update.champion_code = patch.bracket.champion
  }
  if (patch.finishedRound) {
    update.finished_round = patch.finishedRound
    update.completed_at = new Date().toISOString()
  }
  if (Object.keys(update).length === 0) return
  try {
    const { error } = await supabase.from('runs').update(update).eq('id', id)
    if (error) console.warn('[runs] update falhou:', error.message)
  } catch (err) {
    console.warn('[runs] update jogou exceção:', err)
  }
}
