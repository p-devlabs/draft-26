/**
 * Card lima do rewarded — visual unificado pros dois gatilhos do handoff
 * (`rewarded-skip` na Escalação, `rewarded-replay` no drawer Eliminado).
 *
 * Compõe o slot riscado lima + headline + CTA + badge de limite. Quem usa
 * passa o conteúdo; o card só cuida do visual + chamada de `onWatch`.
 *
 * `onWatch` é onde o caller dispara o ad real (placeholder = chama direto e
 * deixa o callback do "earned reward" rodar via setTimeout pequeno pra simular
 * o vídeo). Quando integrar AdMob/AdSense, troque o setTimeout pelo
 * `rewardedAd.show()` e mova o `onEarned` pro callback de "rewarded earned".
 */
import { useState } from 'react'
import type { ReactNode } from 'react'

interface Props {
  headline: ReactNode
  ctaLabel: string
  /** Badge inferior tipo "LIMITE · 1× POR SESSÃO". Omitir esconde. */
  limitBadge?: string
  /** Texto secundário "manter sorteio sem pular" — opcional. */
  fallbackLabel?: string
  onFallback?: () => void
  /** Callback "earned reward" — chamado quando o ad foi assistido até o fim. */
  onEarned: () => void
  /** Tempo do placeholder pra simular o vídeo (ms). Em produção, ignorado. */
  placeholderWatchMs?: number
}

export function RewardedCard({
  headline,
  ctaLabel,
  limitBadge,
  fallbackLabel,
  onFallback,
  onEarned,
  placeholderWatchMs = 1200,
}: Props) {
  const [watching, setWatching] = useState(false)

  const handleWatch = () => {
    if (watching) return
    setWatching(true)
    // Placeholder: pequena espera pra simular o vídeo, depois "earned".
    // Em produção: chamar `rewardedAd.show()` aqui e amarrar `onEarned` ao
    // callback de "rewarded earned" da rede.
    window.setTimeout(() => {
      setWatching(false)
      onEarned()
    }, placeholderWatchMs)
  }

  return (
    <div
      style={{
        border: '1.5px solid rgba(212,255,61,0.55)',
        borderRadius: 13,
        background:
          'repeating-linear-gradient(45deg, rgba(212,255,61,0.07) 0 9px, transparent 9px 18px)',
        padding: '15px 14px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 9,
        animation: watching ? undefined : 'd26-ad-pulse 2.6s infinite',
      }}
    >
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--color-d-lime)',
          background: 'rgba(212,255,61,0.14)',
          borderRadius: 5,
          padding: '3px 8px',
        }}
      >
        REWARDED VIDEO
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          fontFamily: 'Anton',
          fontSize: 17,
          color: 'var(--color-d-ink)',
        }}
      >
        {headline}
      </div>
      <button
        type="button"
        onClick={handleWatch}
        disabled={watching}
        style={{
          width: '100%',
          textAlign: 'center',
          background: 'var(--color-d-lime)',
          color: 'var(--color-d-bg)',
          fontFamily: 'Anton',
          fontSize: 15,
          letterSpacing: '0.02em',
          border: 'none',
          borderRadius: 9,
          padding: 11,
          cursor: watching ? 'wait' : 'pointer',
          opacity: watching ? 0.7 : 1,
        }}
      >
        {watching ? 'ASSISTINDO…' : ctaLabel}
      </button>
      {limitBadge && (
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--color-d-lime)',
            background: 'rgba(212,255,61,0.12)',
            borderRadius: 5,
            padding: '3px 9px',
          }}
        >
          {limitBadge}
        </span>
      )}
      {fallbackLabel && onFallback && (
        <button
          type="button"
          onClick={onFallback}
          style={{
            marginTop: 2,
            background: 'transparent',
            border: 'none',
            fontFamily: 'Space Mono',
            fontSize: 10,
            color: 'var(--color-d-mut)',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          {fallbackLabel}
        </button>
      )}
    </div>
  )
}
