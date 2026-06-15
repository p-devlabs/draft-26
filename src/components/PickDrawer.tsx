import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { compatiblePlayers, SLOT_LABEL } from '../lib/positions'
import {
  clearPendingRoll,
  COUNTRY_COOLDOWN,
  rollUntilCompatible,
  useSkip,
  type DraftState,
} from '../lib/draft'
import { nationGradient } from '../lib/nation-colors'
import { findSquad, squads, type Player, type Squad } from '../data/squads'
import { track } from '../lib/track'

/**
 * Tempo total da animação do caça-níquel antes do carimbo. O `support.js`
 * original do design usava 1.3s; mantemos próximo (~1.05s) pra não atrasar
 * o flow de auto-roll que já existia.
 */
const SLOT_MACHINE_MS = 1050
const TICK_MS = 85

interface PickDrawerProps {
  open: boolean
  state: DraftState
  slotIndex: number | null
  onClose: () => void
  onPick: (player: Player, squad: Squad) => void
  onStateChange: (state: DraftState) => void
}

type Phase =
  | { kind: 'roll' }
  | { kind: 'rolling' }
  | { kind: 'result'; squad: Squad; candidates: Player[]; skipped: number }

export function PickDrawer({
  open,
  state,
  slotIndex,
  onClose,
  onPick,
  onStateChange,
}: PickDrawerProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'rolling' })

  // Ao abrir:
  //   - se o slot já tem pendingSquadCode (sorteio antigo, drawer foi fechado
  //     sem pick) → mostra de novo o mesmo resultado, sem animação
  //   - senão → auto-roll com a animação de ~1s
  useEffect(() => {
    if (!open || slotIndex == null) return
    const slot = state.slots[slotIndex]

    if (slot?.pendingSquadCode) {
      const squad = findSquad(slot.pendingSquadCode)
      if (squad) {
        const candidates = compatiblePlayers(slot.pos, squad.players)
        if (candidates.length > 0) {
          setPhase({ kind: 'result', squad, candidates, skipped: 0 })
          return
        }
      }
    }

    setPhase({ kind: 'rolling' })
    const id = window.setTimeout(() => {
      try {
        const result = rollUntilCompatible(state, slotIndex)
        onStateChange(result.state)
        setPhase({
          kind: 'result',
          squad: result.squad,
          candidates: result.candidates,
          skipped: result.skipped.length,
        })
        void track('country_rolled', {
          countryCode: result.squad.code,
          slotPos: slot.pos,
          skippedBefore: result.skipped.length,
          source: 'auto',
        })
      } catch (err) {
        console.error(err)
        setPhase({ kind: 'roll' })
      }
    }, SLOT_MACHINE_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slotIndex])

  if (!open || slotIndex == null) return null

  const slot = state.slots[slotIndex]
  const slotLabel = SLOT_LABEL[slot.pos].toUpperCase()
  const canSkip = state.skipsRemaining > 0

  // Re-roll manual (fallback do estado 'roll' ou disparado pelo skip).
  const rollFrom = (fromState: DraftState) => {
    setPhase({ kind: 'rolling' })
    window.setTimeout(() => {
      try {
        const result = rollUntilCompatible(fromState, slotIndex)
        onStateChange(result.state)
        setPhase({
          kind: 'result',
          squad: result.squad,
          candidates: result.candidates,
          skipped: result.skipped.length,
        })
        void track('country_rolled', {
          countryCode: result.squad.code,
          slotPos: slot.pos,
          skippedBefore: result.skipped.length,
          source: 'manual',
        })
      } catch (err) {
        console.error(err)
        onStateChange(fromState)
        setPhase({ kind: 'roll' })
      }
    }, SLOT_MACHINE_MS)
  }

  const handlePick = (player: Player) => {
    if (phase.kind !== 'result') return
    void track('player_picked', {
      playerName: player.name,
      countryCode: phase.squad.code,
      slotPos: slot.pos,
      overall: player.overall,
      candidatesCount: phase.candidates.length,
    })
    onPick(player, phase.squad)
  }

  const handleSkip = () => {
    if (!canSkip || phase.kind !== 'result') return
    // Pula gasta um skip e descarta o sorteio pendente antes de rodar de novo.
    rollFrom(clearPendingRoll(useSkip(state), slotIndex))
  }

  const handleClose = () => {
    // Fechar sem escolher NÃO gasta skip — o sorteio fica gravado no slot
    // (pendingSquadCode) e a próxima abertura mostra as mesmas opções.
    onClose()
  }

  const recent = state.rolledCountries.slice(-5)
  const recentStr = recent.length > 0 ? recent.join(' · ') : 'NENHUMA'

  return (
    <>
      <div
        onClick={handleClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6,7,5,0.72)',
          backdropFilter: 'blur(3px)',
          zIndex: 30,
          animation: 'd26-fade-in .2s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 31,
          display: 'flex',
          justifyContent: 'center',
          animation: 'd26-sheet-up .3s cubic-bezier(.2,.9,.3,1)',
          pointerEvents: 'none',
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Sorteio de jogador para ${slotLabel}`}
          className="az-sheet"
          style={{
            width: '100%',
            maxWidth: 560,
            background: 'var(--color-d-surface)',
            border: '1px solid var(--color-d-line)',
            borderBottom: 'none',
            borderRadius: '22px 22px 0 0',
            padding: '22px 26px 30px',
            boxShadow: '0 -30px 60px -20px rgba(0,0,0,0.6)',
            maxHeight: '92vh',
            overflowY: 'auto',
            pointerEvents: 'auto',
          }}
        >
          <Header label={slotLabel} onClose={handleClose} />
          {phase.kind === 'roll' && (
            <RollState slotLabel={slotLabel} recentStr={recentStr} onRoll={() => rollFrom(state)} />
          )}
          {phase.kind === 'rolling' && <RollingState state={state} slotIndex={slotIndex} />}
          {phase.kind === 'result' && (
            <ResultState
              squad={phase.squad}
              candidates={phase.candidates}
              skipped={phase.skipped}
              skipsRemaining={state.skipsRemaining}
              activeLabel={slotLabel}
              onPick={handlePick}
              onSkip={handleSkip}
            />
          )}
        </div>
      </div>
    </>
  )
}

function Header({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
      }}
    >
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 11,
          letterSpacing: '0.14em',
          color: 'var(--color-d-lime)',
        }}
      >
        SORTEIO · {label}
      </div>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: 'var(--color-d-surface2)',
          border: '1px solid var(--color-d-line)',
          color: 'var(--color-d-mut)',
          borderRadius: 8,
          width: 30,
          height: 30,
          fontSize: 15,
          cursor: 'pointer',
          flex: '0 0 auto',
        }}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  )
}

function RollState({
  slotLabel,
  recentStr,
  onRoll,
}: {
  slotLabel: string
  recentStr: string
  onRoll: () => void
}) {
  const dot = (justify?: 'end' | 'center'): CSSProperties => {
    const s: CSSProperties = { width: 8, height: 8, borderRadius: '50%', background: 'var(--color-d-lime)' }
    if (justify === 'end') s.justifySelf = 'end'
    if (justify === 'center') s.justifySelf = 'center'
    return s
  }
  return (
    <div style={{ textAlign: 'center', padding: '18px 0 8px' }}>
      <div
        style={{
          width: 84,
          height: 84,
          margin: '0 auto 20px',
          borderRadius: 18,
          background: 'var(--color-d-surface2)',
          border: '1px solid var(--color-d-line)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          padding: 18,
        }}
      >
        <span style={dot()} />
        <span />
        <span style={dot('end')} />
        <span />
        <span style={dot('center')} />
        <span />
        <span style={dot()} />
        <span />
        <span style={dot('end')} />
      </div>
      <div
        style={{
          fontSize: 15,
          color: 'var(--color-d-mut)',
          maxWidth: 340,
          margin: '0 auto 22px',
        }}
      >
        Role o dado pra sortear uma seleção e ver seus jogadores de{' '}
        <b style={{ color: 'var(--color-d-ink)' }}>{slotLabel}</b>.
      </div>
      <button
        type="button"
        onClick={onRoll}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: 'var(--color-d-lime)',
          color: 'var(--color-d-bg)',
          border: 'none',
          borderRadius: 13,
          padding: 18,
          fontFamily: 'Anton',
          fontSize: 22,
          letterSpacing: '0.02em',
          cursor: 'pointer',
          animation: 'd26-pulse 2.4s infinite',
        }}
      >
        <span style={{ fontSize: 22 }}>⚄</span> ROLAR O DADO
      </button>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 10,
          color: 'var(--color-d-mut)',
          marginTop: 16,
          letterSpacing: '0.06em',
        }}
      >
        EM COOLDOWN (5 SORTEIOS): <span style={{ color: 'var(--color-d-ink)' }}>{recentStr}</span>
      </div>
    </div>
  )
}

/**
 * Caça-níquel: durante o `rolling`, a área do drawer cicla as seleções
 * elegíveis (fora do cooldown e que têm jogador compatível com o slot).
 * Cada tick (~85ms) troca o gradiente + código grande na faixa. O resultado
 * final vem do `rollUntilCompatible` no parent; aqui é só teatro.
 */
function RollingState({ state, slotIndex }: { state: DraftState; slotIndex: number }) {
  const slot = state.slots[slotIndex]
  const pool = useMemo<Squad[]>(() => {
    const cooldown = new Set(state.rolledCountries.slice(-COUNTRY_COOLDOWN))
    const picked = new Set(state.pickedCountries)
    const elig = squads.filter(
      (sq) =>
        !cooldown.has(sq.code) &&
        !picked.has(sq.code) &&
        compatiblePlayers(slot.pos, sq.players).length > 0,
    )
    // Fallback raríssimo: se cooldown + picked esvaziar o pool, ignora o
    // cooldown só pra ter algo cíclico na tela.
    if (elig.length > 0) return elig
    return squads.filter(
      (sq) => !picked.has(sq.code) && compatiblePlayers(slot.pos, sq.players).length > 0,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.pos, slotIndex])

  const [idx, setIdx] = useState(() => Math.floor(Math.random() * Math.max(1, pool.length)))
  const idxRef = useRef(idx)
  idxRef.current = idx

  useEffect(() => {
    if (pool.length <= 1) return
    const id = window.setInterval(() => {
      // Sorteia um vizinho diferente do atual pra evitar repetição cosmética.
      const cur = idxRef.current
      let next = Math.floor(Math.random() * pool.length)
      if (next === cur) next = (cur + 1) % pool.length
      setIdx(next)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [pool])

  const cur = pool[idx % Math.max(1, pool.length)] as Squad | undefined

  return (
    <div style={{ padding: '14px 0 16px' }}>
      <div
        style={{
          position: 'relative',
          height: 130,
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid var(--color-d-line)',
          marginBottom: 16,
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.05)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: cur ? nationGradient(cur.code) : 'var(--color-d-surface2)',
          }}
        >
          <span
            style={{
              fontFamily: 'Anton',
              fontSize: 66,
              lineHeight: 0.8,
              color: '#fff',
              textShadow: '0 3px 14px rgba(0,0,0,0.4)',
              letterSpacing: '0.02em',
            }}
          >
            {cur?.code.toUpperCase() ?? '···'}
          </span>
        </div>
        {/* Scrim com o nome do país */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 36,
            background: 'linear-gradient(180deg, transparent, rgba(10,11,9,0.92))',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 8,
          }}
        >
          <span
            style={{
              fontFamily: 'Space Mono',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: '#fff',
            }}
          >
            {cur?.country.toUpperCase() ?? 'SORTEANDO'}
          </span>
        </div>
        {/* Sombras laterais reforçam a metáfora de slot-machine */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'linear-gradient(90deg, rgba(10,11,9,0.45), transparent 18%, transparent 82%, rgba(10,11,9,0.45))',
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: 'var(--color-d-lime)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
            padding: 8,
            animation: 'd26-spin .65s linear infinite',
            flex: '0 0 auto',
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-d-bg)' }}
            />
          ))}
        </div>
        <div
          style={{
            fontFamily: 'Anton',
            fontSize: 22,
            color: 'var(--color-d-lime)',
            letterSpacing: '0.08em',
          }}
        >
          SORTEANDO…
        </div>
      </div>
    </div>
  )
}

function ResultState({
  squad,
  candidates,
  skipped,
  skipsRemaining,
  activeLabel,
  onPick,
  onSkip,
}: {
  squad: Squad
  candidates: Player[]
  skipped: number
  skipsRemaining: number
  activeLabel: string
  onPick: (p: Player) => void
  onSkip: () => void
}) {
  const code = squad.code.toUpperCase()
  const canSkip = skipsRemaining > 0
  // Sem ranking — primeira ordem por posição primária (caso o fallback
  // LWB→LB / RWB→RB / CF→ST traga uma mistura), depois alfabética por nome.
  const sorted = [...candidates].sort((a, b) => {
    const pa = a.primaryPosition ?? ''
    const pb = b.primaryPosition ?? ''
    if (pa !== pb) return pa.localeCompare(pb)
    return a.name.localeCompare(b.name, 'pt-BR')
  })
  return (
    <div style={{ animation: 'd26-fade-in .3s ease' }}>
      {/* Carimbo: faixa cheia no gradiente da seleção sorteada, com o código
          gigante carimbando (stampIn) e o nome subindo logo atrás (revealUp). */}
      <div
        style={{
          position: 'relative',
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.16)',
          margin: '6px 0 14px',
          boxShadow: '0 14px 36px -20px rgba(0,0,0,0.7)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '15px 18px',
            background: nationGradient(code),
          }}
        >
          <div
            style={{
              fontFamily: 'Anton',
              fontSize: 50,
              lineHeight: 0.78,
              color: '#fff',
              textShadow: '0 2px 12px rgba(0,0,0,0.35)',
              animation: 'd26-stamp-in .42s cubic-bezier(.2,.9,.3,1)',
              flex: '0 0 auto',
            }}
          >
            {code}
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              animation: 'd26-reveal-up .4s ease .08s both',
            }}
          >
            <div
              style={{
                fontFamily: 'Space Mono',
                fontSize: 10,
                letterSpacing: '0.18em',
                color: '#fff',
                opacity: 0.78,
                textShadow: '0 1px 2px rgba(0,0,0,0.45)',
              }}
            >
              SELEÇÃO SORTEADA
            </div>
            <div
              style={{
                fontFamily: 'Anton',
                fontSize: 27,
                lineHeight: 1,
                color: '#fff',
                textShadow: '0 1px 4px rgba(0,0,0,0.45)',
              }}
            >
              {squad.country.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.1em',
          }}
        >
          ESCALE 1 PARA <b style={{ color: 'var(--color-d-ink)' }}>{activeLabel}</b>
        </div>
        {canSkip ? (
          <button
            type="button"
            onClick={onSkip}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-d-lime)',
              color: 'var(--color-d-lime)',
              borderRadius: 8,
              padding: '8px 12px',
              fontFamily: 'Space Mono',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
            }}
          >
            ⤳ PULAR ({skipsRemaining})
          </button>
        ) : (
          <span
            style={{
              border: '1px solid var(--color-d-line)',
              color: 'var(--color-d-mut)',
              borderRadius: 8,
              padding: '8px 12px',
              fontFamily: 'Space Mono',
              fontSize: 11,
              fontWeight: 700,
              opacity: 0.5,
              flex: '0 0 auto',
              whiteSpace: 'nowrap',
            }}
          >
            SEM PULOS
          </span>
        )}
      </div>
      {skipped > 0 && (
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 10,
            color: 'var(--color-d-mut)',
            marginBottom: 10,
            letterSpacing: '0.06em',
          }}
        >
          {skipped} seleção{skipped === 1 ? '' : 'ões'} pulada{skipped === 1 ? '' : 's'} (sem
          jogador compatível)
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((p) => (
          <CandidateRow key={`${p.name}-${p.shirt}`} player={p} onPick={() => onPick(p)} />
        ))}
        {sorted.length === 0 && (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--color-d-mut)',
              fontFamily: 'Space Mono',
              fontSize: 12,
            }}
          >
            Nenhum jogador compatível.
          </div>
        )}
      </div>
    </div>
  )
}

function CandidateRow({ player, onPick }: { player: Player; onPick: () => void }) {
  const ariaPos = player.primaryPosition ?? player.position
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`Escalar ${player.name}, ${ariaPos}, overall ${player.overall}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '12px 14px',
        borderRadius: 11,
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color .15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-d-lime)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-d-line)')}
    >
      <div
        style={{
          width: 30,
          fontFamily: 'Anton',
          fontSize: 19,
          color: 'var(--color-d-mut)',
          textAlign: 'center',
          flex: '0 0 auto',
        }}
      >
        {player.shirt ?? '·'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--color-d-ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {player.name}
          {player.isCaptain && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 9,
                fontFamily: 'Space Mono',
                color: 'var(--color-d-lime)',
                letterSpacing: '0.1em',
              }}
            >
              CAP
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 9,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.08em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {player.primaryPosition ?? player.position} · {player.club}
        </div>
      </div>
      <div style={{ fontFamily: 'Anton', fontSize: 22, color: 'var(--color-d-lime)', flex: '0 0 auto' }}>
        {player.overall}
      </div>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: 'var(--color-d-lime)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-d-bg)',
          fontWeight: 800,
          fontSize: 15,
          flex: '0 0 auto',
        }}
      >
        →
      </div>
    </button>
  )
}
