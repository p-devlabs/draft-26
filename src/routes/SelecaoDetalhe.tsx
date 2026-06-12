import type { CSSProperties, ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  findSquad,
  POSITION_LABEL,
  POSITION_SHORT,
  playerValue,
  type Player,
  type Position,
} from '../data/squads'
import { NATION_GRADIENTS } from '../lib/nation-colors'

function formatValue(eur: number | null | undefined): string {
  if (!eur || eur <= 0) return '—'
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(eur >= 10_000_000 ? 0 : 1)}M`
  if (eur >= 1_000) return `€${Math.round(eur / 1_000)}K`
  return `€${eur}`
}

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD']

export function SelecaoDetalhe() {
  const { code } = useParams<{ code: string }>()
  const squad = code ? findSquad(code) : undefined

  if (!squad) {
    return (
      <div className="d26-scope">
        <TopBar />
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '96px clamp(20px, 5vw, 56px)',
            textAlign: 'center',
          }}
        >
          <Kicker>404</Kicker>
          <h1
            style={{
              fontFamily: 'Anton',
              fontWeight: 400,
              fontSize: 'clamp(32px, 6vw, 48px)',
              lineHeight: 0.96,
              margin: '0 0 14px',
            }}
          >
            SELEÇÃO NÃO ENCONTRADA
          </h1>
          <p style={{ color: 'var(--color-d-mut)', marginBottom: 24 }}>
            O código <code style={{ fontFamily: 'Space Mono' }}>{code}</code> não bate com nenhuma
            das 48.
          </p>
          <Link
            to="/teams"
            style={{
              display: 'inline-block',
              fontFamily: 'Space Mono',
              fontSize: 12,
              color: 'var(--color-d-lime)',
              letterSpacing: '0.1em',
              textDecoration: 'underline',
            }}
          >
            ← VER TODAS AS SELEÇÕES
          </Link>
        </div>
      </div>
    )
  }

  const grouped = POSITIONS.map((pos) => ({
    position: pos,
    players: [...squad.players]
      .filter((p) => p.position === pos)
      .sort((a, b) => (a.shirt ?? 99) - (b.shirt ?? 99)),
  }))

  const gradient = NATION_GRADIENTS[squad.code] ?? 'var(--color-d-surface2)'

  return (
    <div className="d26-scope">
      <TopBar />
      <Hero squad={squad} gradient={gradient} />
      <div
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '40px clamp(20px, 5vw, 56px) 80px',
        }}
      >
        <StatsStrip squad={squad} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36, marginTop: 48 }}>
          {grouped.map(({ position, players }) => (
            <PositionSection key={position} position={position} players={players} />
          ))}
        </div>
        <Footnote />
      </div>
    </div>
  )
}

// ============================================================
// Top bar + Wordmark
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link
          to="/teams"
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.08em',
            textDecoration: 'none',
          }}
        >
          ← SELEÇÕES
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
    </div>
  )
}

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
      <DiceMark />
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

function DiceMark() {
  const dot = (justify?: 'end' | 'center'): CSSProperties => {
    const s: CSSProperties = {
      width: 4,
      height: 4,
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
        width: 36,
        height: 36,
        borderRadius: 9,
        background: 'var(--color-d-lime)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 3,
        padding: 7,
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
// Hero
// ============================================================

function Hero({ squad, gradient }: { squad: ReturnType<typeof findSquad>; gradient: string }) {
  if (!squad) return null
  return (
    <div
      style={{
        position: 'relative',
        borderBottom: '1px solid var(--color-d-line)',
        background: 'linear-gradient(180deg, #101310, #0a0b09)',
      }}
    >
      {/* Faixa de cor da bandeira full-bleed atrás */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: gradient,
          opacity: 0.18,
          mixBlendMode: 'screen',
          maskImage: 'linear-gradient(180deg, #000 0%, transparent 75%)',
          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, transparent 75%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          maxWidth: 1120,
          margin: '0 auto',
          padding: 'clamp(48px, 7vw, 80px) clamp(20px, 5vw, 56px) clamp(40px, 6vw, 60px)',
        }}
      >
        <Kicker>
          GRUPO {squad.group} · {squad.code}
        </Kicker>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 24,
            alignItems: 'end',
          }}
        >
          <div>
            {/* Badge da bandeira em destaque */}
            <div
              style={{
                width: 96,
                height: 64,
                borderRadius: 10,
                background: gradient,
                marginBottom: 18,
                position: 'relative',
                boxShadow: '0 8px 32px -8px rgba(0,0,0,0.6)',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  padding: '8px 10px',
                  fontFamily: 'Space Mono',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  letterSpacing: '0.06em',
                  textShadow: '0 1px 4px rgba(0,0,0,0.7)',
                }}
              >
                {squad.code}
              </span>
            </div>
            <h1
              style={{
                fontFamily: 'Anton',
                fontWeight: 400,
                fontSize: 'clamp(40px, 8vw, 72px)',
                lineHeight: 0.94,
                margin: '0 0 12px',
                textTransform: 'uppercase',
              }}
            >
              {squad.country}
            </h1>
            <div
              style={{
                fontSize: 14,
                color: 'var(--color-d-mut)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: 'var(--color-d-mut)' }}>TÉCNICO</span>
              <span style={{ color: 'var(--color-d-ink)', fontWeight: 700 }}>
                {squad.coach ?? '—'}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: 'Space Mono',
                fontSize: 10,
                letterSpacing: '0.16em',
                color: 'var(--color-d-mut)',
                marginBottom: 4,
              }}
            >
              RATING MÉDIO
            </div>
            <div
              style={{
                fontFamily: 'Anton',
                fontSize: 'clamp(56px, 11vw, 96px)',
                lineHeight: 0.9,
                color: 'var(--color-d-lime)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {squad.averageOverall.toFixed(1)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Stats strip
// ============================================================

function StatsStrip({ squad }: { squad: NonNullable<ReturnType<typeof findSquad>> }) {
  return (
    <div
      style={{
        background: 'var(--color-d-surface)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 14,
        padding: '20px clamp(18px, 3vw, 28px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 18,
      }}
    >
      <Stat label="CONVOCADOS" value={squad.players.length.toString()} />
      <Stat label="FORMAÇÃO BASE" value={squad.formation.primary} highlight />
      <Stat label="ALTERNATIVA" value={squad.formation.alternative} />
      <Stat
        label="CURADORIA"
        value={squad.formation.source === 'curated' ? 'MANUAL' : 'DEFAULT'}
        soft={squad.formation.source !== 'curated'}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  highlight,
  soft,
}: {
  label: string
  value: string
  highlight?: boolean
  soft?: boolean
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 10,
          letterSpacing: '0.14em',
          color: 'var(--color-d-mut)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Anton',
          fontSize: 24,
          lineHeight: 1,
          color: highlight
            ? 'var(--color-d-lime)'
            : soft
              ? 'var(--color-d-mut)'
              : 'var(--color-d-ink)',
        }}
      >
        {value}
      </div>
    </div>
  )
}

// ============================================================
// Position sections
// ============================================================

function PositionSection({ position, players }: { position: Position; players: Player[] }) {
  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: 'Anton',
            fontSize: 22,
            color: 'var(--color-d-ink)',
            textTransform: 'uppercase',
          }}
        >
          {POSITION_LABEL[position]}
        </span>
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.08em',
          }}
        >
          {POSITION_SHORT[position]} · {players.length}
        </span>
      </div>
      <div
        style={{
          background: 'var(--color-d-surface)',
          border: '1px solid var(--color-d-line)',
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        {players.map((p, idx) => (
          <PlayerRow key={`${p.name}-${p.shirt ?? idx}`} player={p} isLast={idx === players.length - 1} />
        ))}
      </div>
    </section>
  )
}

function PlayerRow({ player: p, isLast }: { player: Player; isLast: boolean }) {
  const isHeur = p.ratingSource && p.ratingSource !== 'fifa' && p.ratingSource !== 'fifa-fuzzy'
  const heurTitle =
    p.ratingSource === 'tm'
      ? 'Não encontrado no EA FC 26 — overall estimado por valor de mercado (Transfermarkt)'
      : 'Não encontrado no EA FC 26 nem no Transfermarkt — overall estimado por tier do clube'
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '52px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 14,
        padding: '14px clamp(14px, 2.5vw, 22px)',
        borderBottom: isLast ? 'none' : '1px solid var(--color-d-line)',
      }}
    >
      {/* Camisa em badge */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'var(--color-d-surface2)',
          border: '1px solid var(--color-d-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Anton',
          fontSize: 18,
          color: 'var(--color-d-ink)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {p.shirt ?? '—'}
      </div>

      {/* Nome, posição, clube */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-d-ink)' }}>
            {p.name}
          </span>
          {p.isCaptain && (
            <span
              style={{
                fontFamily: 'Space Mono',
                fontSize: 9,
                letterSpacing: '0.12em',
                color: 'var(--color-d-lime)',
                border: '1px solid var(--color-d-lime)',
                borderRadius: 4,
                padding: '2px 5px',
                lineHeight: 1,
              }}
            >
              CAP
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: 'var(--color-d-ink)' }}>
            {p.primaryPosition ?? p.position}
            {p.altPositions && p.altPositions.length > 0 && (
              <span style={{ color: 'var(--color-d-mut)' }}>·{p.altPositions.join('·')}</span>
            )}
          </span>
          <span style={{ color: 'var(--color-d-line)' }}>|</span>
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}
          >
            {p.club}
          </span>
          {p.age != null && (
            <>
              <span style={{ color: 'var(--color-d-line)' }}>|</span>
              <span>{p.age}A</span>
            </>
          )}
        </div>
      </div>

      {/* Valor + Overall */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ textAlign: 'right', minWidth: 60 }}>
          <div
            style={{
              fontFamily: 'Space Mono',
              fontSize: 10,
              letterSpacing: '0.1em',
              color: 'var(--color-d-mut)',
            }}
          >
            VALOR
          </div>
          <div
            style={{
              fontFamily: 'Space Mono',
              fontSize: 13,
              color: 'var(--color-d-ink)',
              fontWeight: 700,
            }}
          >
            {formatValue(playerValue(p))}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 52,
            height: 52,
            borderRadius: 11,
            background: isHeur ? 'var(--color-d-surface2)' : 'var(--color-d-lime)',
            color: isHeur ? 'var(--color-d-ink)' : 'var(--color-d-bg)',
            fontFamily: 'Anton',
            fontSize: 22,
            fontVariantNumeric: 'tabular-nums',
            position: 'relative',
          }}
        >
          {p.overall}
          {isHeur && (
            <span
              title={heurTitle}
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                fontSize: 11,
                color: 'var(--color-d-lime)',
                background: 'var(--color-d-bg)',
                borderRadius: '50%',
                width: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--color-d-lime)',
                cursor: 'help',
              }}
            >
              ✦
            </span>
          )}
        </div>
      </div>
    </div>
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
      Ratings e posições do EA FC 26 (via{' '}
      <a
        href="https://github.com/ismailoksuz/EAFC26-DataHub"
        style={{ color: 'var(--color-d-ink)', textDecoration: 'underline' }}
      >
        EAFC26-DataHub
      </a>
      ). Valor de mercado complementado pelo{' '}
      <a
        href="https://github.com/dcaribou/transfermarkt-datasets"
        style={{ color: 'var(--color-d-ink)', textDecoration: 'underline' }}
      >
        Transfermarkt
      </a>
      . Jogadores não encontrados no EA FC viram estimativa por valor de mercado ou tier do clube —
      marcados com <span style={{ color: 'var(--color-d-lime)' }}>✦</span>.
    </p>
  )
}
