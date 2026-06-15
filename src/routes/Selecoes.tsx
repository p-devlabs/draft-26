import { Link } from 'react-router-dom'

import { groupedSquads, type Squad } from '../data/squads'
import { NATION_GRADIENTS } from '../lib/nation-colors'

import type { CSSProperties, ReactNode } from 'react'

// Computado em render (não em module-load) pra rodar depois do <SquadsGate>
// ter hidratado `groupedSquads`.
function totalPlayers(): number {
  return groupedSquads.reduce(
    (s, g) => s + g.squads.reduce((ss, sq) => ss + sq.players.length, 0),
    0,
  )
}

export function Selecoes() {
  return (
    <div className="d26-scope">
      <TopBar />
      <Hero />
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 clamp(20px, 5vw, 56px) 80px' }}>
        {groupedSquads.map(({ letter, squads }) => (
          <GroupSection key={letter} letter={letter} squads={squads} />
        ))}
        <Footnote />
      </div>
    </div>
  )
}

// ============================================================
// Top bar (espelha Home — duplicação consciente até virar shared)
// ============================================================

function TopBar() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
        padding: '16px clamp(20px, 5vw, 56px)',
        borderBottom: '1px solid var(--color-d-line)',
        background: 'rgba(10, 11, 9, 0.85)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <Link to="/" style={{ textDecoration: 'none', color: 'var(--color-d-ink)' }}>
        <Wordmark />
      </Link>
      <Link
        to="/draft"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          background: 'var(--color-d-lime)',
          color: 'var(--color-d-bg)',
          borderRadius: 10,
          padding: '11px 18px',
          fontFamily: 'Anton',
          fontSize: 15,
          letterSpacing: '0.02em',
          textDecoration: 'none',
        }}
      >
        JOGAR <span style={{ fontFamily: 'Space Mono', fontSize: 11, fontWeight: 700 }}>→</span>
      </Link>
    </div>
  )
}

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <DiceMark size={36} dotSize={4} padding={7} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span style={{ fontFamily: 'Anton', fontSize: 24, letterSpacing: '0.02em' }}>DRAFT</span>
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            color: 'var(--color-d-lime)',
            fontWeight: 700,
          }}
        >
          26
        </span>
      </div>
    </div>
  )
}

function DiceMark({ size, dotSize, padding }: { size: number; dotSize: number; padding: number }) {
  const dot = (justify?: 'end' | 'center'): CSSProperties => {
    const s: CSSProperties = {
      width: dotSize,
      height: dotSize,
      borderRadius: '50%',
      background: 'var(--color-d-bg)',
    }
    if (justify === 'end') s.justifySelf = 'end'
    if (justify === 'center') s.justifySelf = 'center'
    return s
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size / 4),
        background: 'var(--color-d-lime)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 3,
        padding,
        flex: '0 0 auto',
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
  )
}

// ============================================================
// Hero
// ============================================================

function Hero() {
  return (
    <div
      style={{
        borderBottom: '1px solid var(--color-d-line)',
        background: 'linear-gradient(180deg, #101310, #0a0b09)',
        padding: 'clamp(40px, 6vw, 72px) clamp(20px, 5vw, 56px)',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <Kicker>
          48 SELEÇÕES · 12 GRUPOS · {totalPlayers().toLocaleString('pt-BR')} CONVOCADOS
        </Kicker>
        <h1
          style={{
            fontFamily: 'Anton',
            fontWeight: 400,
            fontSize: 'clamp(36px, 7vw, 64px)',
            lineHeight: 0.96,
            margin: '0 0 18px',
            maxWidth: 760,
          }}
        >
          AS 48 QUE DISPUTAM O <span style={{ color: 'var(--color-d-lime)' }}>VERÃO DE 2026</span>
        </h1>
        <p
          style={{
            maxWidth: 540,
            fontSize: 16,
            lineHeight: 1.55,
            color: 'var(--color-d-mut)',
            margin: 0,
          }}
        >
          Clique numa seleção pra ver elenco completo, ratings do EA FC 26, formação preferida do
          técnico e o valor de mercado dos convocados.
        </p>
      </div>
    </div>
  )
}

function Kicker({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontFamily: 'Space Mono',
        fontSize: 12,
        letterSpacing: '0.18em',
        color: color ?? 'var(--color-d-lime)',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  )
}

// ============================================================
// Group section
// ============================================================

function GroupSection({ letter, squads }: { letter: string; squads: Squad[] }) {
  return (
    <section
      style={{
        padding: '48px 0',
        borderBottom: '1px solid var(--color-d-line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 16,
          marginBottom: 22,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: 'Space Mono',
              fontSize: 11,
              color: 'var(--color-d-mut)',
              letterSpacing: '0.18em',
            }}
          >
            GRUPO
          </span>
          <span
            style={{
              fontFamily: 'Anton',
              fontSize: 42,
              color: 'var(--color-d-lime)',
              lineHeight: 0.9,
            }}
          >
            {letter}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.08em',
          }}
        >
          {squads.length} SELEÇÕES
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        {squads.map((s) => (
          <SquadCard key={s.code} squad={s} />
        ))}
      </div>
    </section>
  )
}

// ============================================================
// Squad card
// ============================================================

function SquadCard({ squad }: { squad: Squad }) {
  const gradient = NATION_GRADIENTS[squad.code] ?? 'var(--color-d-surface2)'
  return (
    <Link
      to={`/teams/${squad.code.toLowerCase()}`}
      aria-label={`Ver elenco de ${squad.country}`}
      style={{
        display: 'block',
        background: 'var(--color-d-surface)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 14,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'var(--color-d-ink)',
        transition: 'border-color 120ms, transform 120ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-d-lime)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-d-line)'
        e.currentTarget.style.transform = 'none'
      }}
    >
      {/* Faixa de cor da bandeira — limpa, sem código nem OVR sobreposto
          (criavam "vazado" no topo/base por causa do textShadow). Código e
          rating moved pro corpo do card. */}
      <div role="img" aria-label={squad.country} style={{ height: 64, background: gradient }} />
      <div style={{ padding: '14px 16px 16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontFamily: 'Anton',
              fontSize: 19,
              lineHeight: 1.05,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {squad.country.toUpperCase()}
          </div>
          <span
            style={{
              fontFamily: 'Anton',
              fontSize: 22,
              lineHeight: 1,
              color: 'var(--color-d-lime)',
              flex: '0 0 auto',
            }}
          >
            {squad.averageOverall.toFixed(0)}
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-d-mut)',
            marginBottom: 12,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {squad.coach ?? '—'}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontFamily: 'Space Mono',
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--color-d-mut)',
          }}
        >
          <span>
            {squad.code} · {squad.formation.primary}
          </span>
          <span>{squad.players.length} CONVOC.</span>
        </div>
      </div>
    </Link>
  )
}

// ============================================================
// Footnote
// ============================================================

function Footnote() {
  return (
    <p
      style={{
        marginTop: 48,
        paddingTop: 24,
        borderTop: '1px solid var(--color-d-line)',
        fontSize: 12,
        lineHeight: 1.6,
        color: 'var(--color-d-mut)',
        maxWidth: 720,
      }}
    >
      Convocações via Wikipedia. Ratings e posições granulares do{' '}
      <a
        href="https://www.ea.com/games/ea-sports-fc"
        style={{ color: 'var(--color-d-ink)', textDecoration: 'underline' }}
      >
        EA FC 26
      </a>{' '}
      (~73% dos jogadores). Quem não casa no EA FC vira estimativa via valor de mercado do
      Transfermarkt — marcado com <span style={{ color: 'var(--color-d-lime)' }}>✦</span> na ficha.
    </p>
  )
}
