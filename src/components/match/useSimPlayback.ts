import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { loadMatchSpeed, saveMatchSpeed } from '../../lib/persistence'
import type { OutcomeKind } from './OutcomeDrawer'

// ---------- Tipos públicos ----------

export type Speed = 'slow' | 'normal' | 'fast'

export const SPEED_DURATION: Record<Speed, number> = {
  slow: 60,
  normal: 30,
  fast: 12,
}

export const SPEED_LABEL: Record<Speed, string> = { slow: '1×', normal: '2×', fast: '4×' }

export const SPEED_ORDER: Speed[] = ['slow', 'normal', 'fast']

export const TICK_MS = 60

/**
 * Intervalo entre cobranças do shootout, por velocidade. Cobranças saem
 * "uma a uma" — mais lento que minuto de jogo pra dar tempo de ler quem
 * bateu e o resultado.
 */
export const PENALTY_KICK_MS: Record<Speed, number> = {
  slow: 1500,
  normal: 850,
  fast: 380,
}

interface UseSimPlaybackOpts {
  /** Quando o relógio deve rodar. Caller passa false enquanto dados carregam. */
  enabled: boolean
  /** Minuto-alvo onde o tick para. 90 em grupos; 90 ou 120 em mata-mata. */
  totalMinutes: number
  /**
   * Notificação de mudança de velocidade pra tracking custom do caller.
   * Estabilizada por ref — não precisa de useCallback.
   */
  onSpeedChange: (from: Speed, to: Speed) => void
}

export interface SimPlayback {
  virtualMinute: number
  wholeMinute: number
  playing: boolean
  speed: Speed
  outcome: OutcomeKind | null
  /** Ref pro minuto atual — pra ler dentro de callbacks sem virar dep. */
  virtualMinuteRef: MutableRefObject<number>
  setVirtualMinute: (m: number | ((prev: number) => number)) => void
  setPlaying: (p: boolean | ((prev: boolean) => boolean)) => void
  setOutcome: (o: OutcomeKind | null) => void
  /** Wrapper de setSpeed: persiste no localStorage + dispara onSpeedChange. */
  setSpeed: (s: Speed) => void
  /** Handlers estáveis prontos pra passar pro RightColumn. */
  onToggle: () => void
  onCloseOutcome: () => void
  onShowOutcome: (o: OutcomeKind) => void
}

/**
 * Playback compartilhado pelo Group/KnockoutMatchRunner — owna o relógio
 * virtual, a velocidade, o estado de "tocando" e o outcome drawer. Tick
 * usa setInterval com aceleração proporcional a (totalMinutes / 90), igual
 * ao comportamento original dos dois runners.
 *
 * O caller mantém os refs específicos da rodada (persisted/started/skipped)
 * e compõe `onRestart`/`onSkipToEnd` próprios usando os setters expostos —
 * grupos e mata-mata divergem nos detalhes (knockout tem shootout).
 */
export function useSimPlayback({ enabled, totalMinutes, onSpeedChange }: UseSimPlaybackOpts): SimPlayback {
  const [virtualMinute, setVirtualMinute] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, _setSpeed] = useState<Speed>(() => loadMatchSpeed())
  const [outcome, setOutcome] = useState<OutcomeKind | null>(null)

  const virtualMinuteRef = useRef(0)
  virtualMinuteRef.current = virtualMinute

  // Estabiliza onSpeedChange via ref — caller não precisa memoizar pra
  // manter `setSpeed` com identidade estável.
  const onSpeedChangeRef = useRef(onSpeedChange)
  onSpeedChangeRef.current = onSpeedChange

  const setSpeed = useCallback((s: Speed) => {
    _setSpeed((prev) => {
      if (s !== prev) onSpeedChangeRef.current(prev, s)
      saveMatchSpeed(s)
      return s
    })
  }, [])

  // Tick: avança virtualMinute proporcionalmente à velocidade. Para quando
  // atinge totalMinutes ou quando enabled/playing/speed mudam (cleanup +
  // re-init pegam o novo ritmo). Interval auto-limpa ao reach do total.
  useEffect(() => {
    if (!enabled || !playing) return
    const duration = SPEED_DURATION[speed] * (totalMinutes / 90)
    const ratePerTick = (totalMinutes / (duration * 1000)) * TICK_MS
    const id = window.setInterval(() => {
      setVirtualMinute((m) => {
        const next = m + ratePerTick
        if (next >= totalMinutes) {
          window.clearInterval(id)
          return totalMinutes
        }
        return next
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [enabled, playing, speed, totalMinutes])

  const onToggle = useCallback(() => setPlaying((p) => !p), [])
  const onCloseOutcome = useCallback(() => setOutcome(null), [])
  const onShowOutcome = useCallback((o: OutcomeKind) => setOutcome(o), [])

  const wholeMinute = Math.floor(virtualMinute)

  return {
    virtualMinute,
    wholeMinute,
    playing,
    speed,
    outcome,
    virtualMinuteRef,
    setVirtualMinute,
    setPlaying,
    setOutcome,
    setSpeed,
    onToggle,
    onCloseOutcome,
    onShowOutcome,
  }
}
