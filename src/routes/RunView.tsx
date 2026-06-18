import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ROUND_LABEL } from '../lib/bracket'
import { averageOverall } from '../lib/draft'
import { STYLES } from '../lib/formations'
import { fetchPublicRun, type PublicRun } from '../lib/runs'
import { track } from '../lib/track'

import type { KORound } from '../lib/bracket'

/**
 * Tela pública de uma run compartilhada (/r/:id). É a landing do loop de share:
 * mostra o desfecho + o time de quem compartilhou e puxa o visitante pro draft.
 * Reconstrução completa do card (placar/artilheiros) fica pra um follow-up —
 * aqui é a versão herói on-brand com os campos confiáveis da run.
 */

type LoadState = { status: 'loading' } | { status: 'notfound' } | { status: 'ok'; run: PublicRun }

interface Outcome {
  kicker: string
  title: string
  color: string
  emoji?: string
}

function outcomeOf(run: PublicRun): Outcome {
  const fr = run.finishedRound
  if (fr === 'CHAMPION')
    return {
      kicker: 'COPA 2026 · DECISÃO',
      title: 'CAMPEÃO DO MUNDO',
      color: 'var(--color-d-lime)',
      emoji: '🏆',
    }
  if (fr === 'group')
    return {
      kicker: 'COPA 2026 · FIM DE LINHA',
      title: 'CAIU NA FASE DE GRUPOS',
      color: 'var(--color-d-red)',
    }
  if (fr)
    return {
      kicker: 'COPA 2026 · FIM DE LINHA',
      title: `ELIMINADO · ${ROUND_LABEL[fr as KORound] ?? fr}`,
      color: 'var(--color-d-red)',
    }
  return { kicker: 'COPA 2026', title: 'CAMPANHA EM ANDAMENTO', color: 'var(--color-d-ink)' }
}

export function RunView() {
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (!id) {
      setState({ status: 'notfound' })
      return
    }
    let alive = true
    void fetchPublicRun(id).then((run) => {
      if (!alive) return
      if (!run) {
        setState({ status: 'notfound' })
        return
      }
      setState({ status: 'ok', run })
      document.title = 'Draft 26 — uma campanha na Copa 2026'
      void track('run_view', { viewedRun: id, outcome: run.finishedRound })
    })
    return () => {
      alive = false
    }
  }, [id])

  return (
    <main
      style={{
        minHeight: '100dvh',
        background:
          'radial-gradient(1000px 640px at 50% -10%, rgba(212,255,61,0.10), transparent 60%), var(--color-d-bg)',
        color: 'var(--color-d-ink)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(20px, 6vw, 48px)',
        fontFamily: 'Archivo, sans-serif',
      }}
    >
      {state.status === 'loading' && <Brand muted />}
      {state.status === 'notfound' && <NotFound />}
      {state.status === 'ok' && <RunCard run={state.run} />}
    </main>
  )
}

function Brand({ muted }: { muted?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: muted ? 0.5 : 1 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: 'var(--color-d-lime)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 17,
          color: 'var(--color-d-bg)',
        }}
      >
        ⚄
      </div>
      <span style={{ fontFamily: 'Anton', fontSize: 24, letterSpacing: '0.02em' }}>
        DRAFT{' '}
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--color-d-lime)',
          }}
        >
          26
        </span>
      </span>
    </div>
  )
}

function NotFound() {
  return (
    <div style={{ textAlign: 'center', maxWidth: 420 }}>
      <Brand />
      <h1 style={{ fontFamily: 'Anton', fontSize: 34, marginTop: 24, lineHeight: 1 }}>
        CAMPANHA NÃO ENCONTRADA
      </h1>
      <p
        style={{
          fontFamily: 'Space Mono',
          fontSize: 13,
          color: 'var(--color-d-mut)',
          marginTop: 12,
        }}
      >
        Esse link expirou ou a run é privada.
      </p>
      <CtaButton label="MONTAR MEU XI →" />
    </div>
  )
}

function RunCard({ run }: { run: PublicRun }) {
  const o = outcomeOf(run)
  const ovr = Math.round(run.averageOverall ?? averageOverall(run.draft))
  const styleLabel = STYLES.find((s) => s.id === run.draft.style)?.label ?? run.draft.style

  return (
    <div style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Brand />
      </div>

      {o.emoji && <div style={{ fontSize: 64, lineHeight: 1, marginTop: 28 }}>{o.emoji}</div>}

      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 12,
          letterSpacing: '0.18em',
          color: 'var(--color-d-mut)',
          marginTop: o.emoji ? 10 : 28,
        }}
      >
        {o.kicker}
      </div>
      <h1
        style={{
          fontFamily: 'Anton',
          fontSize: 'clamp(40px, 11vw, 64px)',
          lineHeight: 0.92,
          margin: '8px 0 0',
          color: o.color,
        }}
      >
        {o.title}
      </h1>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 13,
          color: 'var(--color-d-mut)',
          marginTop: 14,
        }}
      >
        Um XI montado no dado da Copa 2026.
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          marginTop: 28,
        }}
      >
        <Stat label="FORMAÇÃO" value={run.formation} />
        <Stat label="ESTILO" value={styleLabel.toUpperCase()} />
        <Stat label="SELEÇÕES" value={String(run.draft.pickedCountries.length)} />
        <Stat label="OVR" value={String(ovr)} highlight />
      </div>

      <CtaButton label="MONTAR O MEU XI →" />

      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 11,
          color: 'var(--color-d-mut)',
          marginTop: 18,
        }}
      >
        draft-26.pages.dev · simulador da Copa 2026
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 12,
        padding: '14px 6px',
      }}
    >
      <div
        style={{
          fontFamily: 'Anton',
          fontSize: 24,
          color: highlight ? 'var(--color-d-lime)' : 'var(--color-d-ink)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 9,
          letterSpacing: '0.08em',
          color: 'var(--color-d-mut)',
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function CtaButton({ label }: { label: string }) {
  return (
    <Link
      to="/draft?fresh=1"
      onClick={() => void track('run_view_cta')}
      style={{
        display: 'block',
        marginTop: 28,
        background: 'var(--color-d-lime)',
        color: 'var(--color-d-bg)',
        border: '1px solid var(--color-d-lime)',
        borderRadius: 12,
        padding: 16,
        fontFamily: 'Anton',
        fontSize: 19,
        letterSpacing: '0.02em',
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
  )
}
