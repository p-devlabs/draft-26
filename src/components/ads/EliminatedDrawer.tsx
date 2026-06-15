/**
 * Bottom-sheet que abre quando o user é eliminado no mata-mata. Materializa
 * o gatilho A2 do handoff (rewarded `rewarded-replay`).
 *
 * Renderiza:
 *   - Headline "ELIMINADO" + sub-info da rodada/forma da derrota
 *   - Se `canShowReplayReward`: card lima com `▶ REJOGAR O ÚLTIMO JOGO`
 *   - Sempre: link secundário "NOVO XI →" (recomeça a campanha)
 *   - Botão ✕ pra fechar e ficar na tela de bracket (path strip já mostra o L)
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RewardedCard } from './RewardedCard'
import { useAds } from './AdsProvider'
import { clearBracket, clearDraft, clearWorldCup } from '../../lib/persistence'
import { clearLocalRunId } from '../../lib/runs'

interface Props {
  /** Label da rodada onde caiu (ex: "OITAVAS"). */
  roundLabel: string
  /** Sub-info: "perdeu 2-3", "nos pênaltis", etc. */
  detail?: string
  /** Callback de "rejogar último jogo" — caller faz o rewind do bracket. */
  onReplay: () => void
}

export function EliminatedDrawer({ roundLabel, detail, onReplay }: Props) {
  const ads = useAds()
  const navigate = useNavigate()
  const [open, setOpen] = useState(true)
  // Evita reabrir o drawer toda vez que o React re-renderiza após o user fechar.
  const dismissedRef = useRef(false)

  // Se o replay foi concedido em outra montagem (state persistido), nem mostra
  // o drawer no remount — o user já usou a chance.
  useEffect(() => {
    if (ads.run.replayChanceUsed && !dismissedRef.current) {
      setOpen(false)
    }
  }, [ads.run.replayChanceUsed])

  if (!open) return null

  const handleClose = () => {
    dismissedRef.current = true
    setOpen(false)
  }

  const handleReplay = () => {
    ads.grantReplayReward()
    onReplay()
    handleClose()
  }

  const handleNewXi = () => {
    // Reset total: limpa bracket, world cup, draft, run remoto, e o limite de
    // replay (run nova).
    clearBracket()
    clearWorldCup()
    clearDraft()
    clearLocalRunId()
    ads.resetRun()
    navigate('/draft', { replace: true })
  }

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6,7,5,0.78)',
          backdropFilter: 'blur(4px)',
          zIndex: 40,
          animation: 'd26-fade-in .25s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 41,
          display: 'flex',
          justifyContent: 'center',
          animation: 'd26-sheet-up .3s cubic-bezier(.2,.9,.3,1)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'var(--color-d-surface)',
            border: '1px solid var(--color-d-line)',
            borderTop: '2px solid var(--color-d-red)',
            borderBottom: 'none',
            borderRadius: '22px 22px 0 0',
            padding: '18px 22px 22px',
            boxShadow: '0 -30px 60px -20px rgba(0,0,0,0.65)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              width: 38,
              height: 4,
              borderRadius: 3,
              background: 'var(--color-d-line)',
              margin: '0 auto 16px',
            }}
          />
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div
              style={{
                fontFamily: 'Space Mono',
                fontSize: 9,
                letterSpacing: '0.16em',
                color: 'var(--color-d-red)',
                marginBottom: 5,
              }}
            >
              FIM DE LINHA
            </div>
            <div
              style={{
                fontFamily: 'Anton',
                fontSize: 30,
                lineHeight: 0.9,
                color: 'var(--color-d-ink)',
              }}
            >
              ELIMINADO
            </div>
            <div
              style={{
                fontFamily: 'Space Mono',
                fontSize: 10,
                color: 'var(--color-d-mut)',
                marginTop: 7,
              }}
            >
              {roundLabel.toUpperCase()}
              {detail ? ` · ${detail.toUpperCase()}` : ''}
            </div>
          </div>

          {ads.canShowReplayReward && (
            <div style={{ marginBottom: 10 }}>
              <RewardedCard
                headline={<>▶ REJOGAR O ÚLTIMO JOGO</>}
                ctaLabel="▶ REJOGAR O ÚLTIMO JOGO"
                limitBadge="1 CHANCE POR RUN"
                onEarned={handleReplay}
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleNewXi}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              border: '1px solid var(--color-d-line)',
              background: 'transparent',
              borderRadius: 9,
              padding: 11,
              fontFamily: 'Space Mono',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--color-d-mut)',
              cursor: 'pointer',
            }}
          >
            NOVO XI →
          </button>

          <button
            type="button"
            onClick={handleClose}
            style={{
              display: 'block',
              margin: '12px auto 0',
              background: 'transparent',
              border: 'none',
              fontFamily: 'Space Mono',
              fontSize: 10,
              color: 'var(--color-d-mut)',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            ficar no chaveamento
          </button>
        </div>
      </div>
    </>
  )
}
