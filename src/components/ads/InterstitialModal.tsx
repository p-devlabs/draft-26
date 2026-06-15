/**
 * Interstitial placeholder full-screen. Mostra a caixa riscada âmbar do mapa
 * de ads + countdown de skip. Quando integrar uma rede real, este componente
 * é o ponto de troca — receba o `slotId` e dispare `interstitialAd.show()`
 * em vez de renderizar o placeholder.
 */
import { useEffect, useState } from 'react'
import type { AdSlotId } from '../../lib/ads'

interface Props {
  slotId: AdSlotId
  /** Tempo até liberar o ✕ (ms). */
  skipAfterMs: number
  onClose: () => void
}

export function InterstitialModal({ slotId, skipAfterMs, onClose }: Props) {
  // Contador regressivo até liberar o skip.
  const [remaining, setRemaining] = useState(Math.ceil(skipAfterMs / 1000))

  useEffect(() => {
    if (remaining <= 0) return
    const id = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [remaining])

  const canSkip = remaining <= 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Anúncio (interstitial)"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(6,7,5,0.92)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'd26-fade-in .2s ease',
      }}
    >
      <div
        style={{
          width: 'min(360px, 92vw)',
          maxHeight: '92vh',
          background: '#0a0b09',
          border: '1px solid #2a2e26',
          borderRadius: 22,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Topo: label + ✕ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '11px 14px',
            borderBottom: '1px solid #2a2e26',
          }}
        >
          <span
            style={{
              fontFamily: 'Space Mono',
              fontSize: 9,
              letterSpacing: '0.14em',
              color: '#888c80',
            }}
          >
            ANÚNCIO · {slotId.toUpperCase()}
          </span>
          <button
            type="button"
            onClick={canSkip ? onClose : undefined}
            disabled={!canSkip}
            aria-label={canSkip ? 'Fechar anúncio' : `Aguarde ${remaining}s`}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '1px solid #2a2e26',
              background: 'transparent',
              color: canSkip ? '#f3f4ec' : '#5e6157',
              fontFamily: 'Space Mono',
              fontSize: canSkip ? 14 : 11,
              cursor: canSkip ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {canSkip ? '✕' : remaining}
          </button>
        </div>
        {/* Slot riscado âmbar (placeholder) */}
        <div
          style={{
            flex: 1,
            margin: '12px',
            minHeight: 360,
            border: '1.5px solid rgba(255,138,59,0.5)',
            borderRadius: 14,
            background:
              'repeating-linear-gradient(45deg, rgba(255,138,59,0.07) 0 11px, transparent 11px 22px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 11,
            textAlign: 'center',
            padding: 20,
          }}
        >
          <span
            style={{
              fontFamily: 'Space Mono',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: '#ff8a3b',
              background: 'rgba(255,138,59,0.14)',
              borderRadius: 5,
              padding: '4px 9px',
            }}
          >
            INTERSTITIAL
          </span>
          <span
            style={{
              fontFamily: 'Anton',
              fontSize: 24,
              color: '#c9cdbf',
              lineHeight: 1,
            }}
          >
            FULL-SCREEN
            <br />
            320×480+
          </span>
          <span
            style={{
              fontFamily: 'Space Mono',
              fontSize: 10,
              color: '#5e6157',
              marginTop: 6,
            }}
          >
            {canSkip ? 'skip liberado' : `skip em ${remaining}s`}
          </span>
        </div>
      </div>
    </div>
  )
}
