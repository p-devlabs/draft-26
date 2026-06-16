import { memo, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { nationGradient } from '../../lib/nation-colors'

import type { MatchEvent } from '../../lib/narrate'

// ---------- Tipos públicos ----------

export interface SideTeam {
  code: string
  name: string
  averageOverall: number
  isUser: boolean
}

export interface PartidaShellProps {
  phaseLabel: string
  home: SideTeam
  away: SideTeam
  homeGoals: number
  awayGoals: number
  clockMinute: number
  totalMinutes: number
  playing: boolean
  finished: boolean
  /** Tempo regulamentar+ET acabou, mas cobranças ainda saindo uma a uma. */
  shootoutActive?: boolean
  /** Quantas cobranças do shootout já estão visíveis (0 antes de começar). */
  shootoutKicksRevealed?: number
  /** Marcadores plotados na timeline do scoreboard (gols). */
  goalAndRedEvents: MatchEvent[]
  /** Slot opcional entre o scoreboard e o body — usado pra mostrar o
   *  card de disputa de pênaltis como subheader (toggle ?p=hero). */
  belowScoreboard?: ReactNode
  /** Conteúdo do body: feed de lances, painel direito, drawer de resultado, etc. */
  children: ReactNode
}

// ---------- Componente público ----------

export function PartidaShell(p: PartidaShellProps) {
  return (
    <div className="d26-scope">
      <AppBar phaseLabel={p.phaseLabel} />
      <ScoreboardHero
        home={p.home}
        away={p.away}
        homeGoals={p.homeGoals}
        awayGoals={p.awayGoals}
        clockMinute={p.clockMinute}
        totalMinutes={p.totalMinutes}
        playing={p.playing}
        finished={p.finished}
        shootoutActive={p.shootoutActive}
        shootoutKicksRevealed={p.shootoutKicksRevealed ?? 0}
        markers={p.goalAndRedEvents}
      />
      <ScoreAnnouncer home={p.home} away={p.away} homeGoals={p.homeGoals} awayGoals={p.awayGoals} />
      {p.belowScoreboard && (
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            padding: '0 clamp(16px, 4vw, 28px)',
          }}
        >
          {p.belowScoreboard}
        </div>
      )}
      <Body>{p.children}</Body>
    </div>
  )
}

// Anuncia gols pra screen readers via live region. Compara o placar atual com
// o anterior em useEffect — só dispara quando algum lado realmente marcou,
// evitando ruído a cada re-render do shell.
function ScoreAnnouncer({
  home,
  away,
  homeGoals,
  awayGoals,
}: {
  home: SideTeam
  away: SideTeam
  homeGoals: number
  awayGoals: number
}) {
  const prev = useRef({ home: homeGoals, away: awayGoals })
  const [message, setMessage] = useState('')

  useEffect(() => {
    const last = prev.current
    const homeScored = homeGoals > last.home
    const awayScored = awayGoals > last.away
    if (homeScored || awayScored) {
      const scorer = homeScored ? home : away
      const label = scorer.isUser ? 'Seu XI' : scorer.name
      setMessage(`${label} marcou. Placar ${homeGoals} a ${awayGoals}.`)
    }
    prev.current = { home: homeGoals, away: awayGoals }
  }, [homeGoals, awayGoals, home, away])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'absolute',
        width: 1,
        height: 1,
        padding: 0,
        margin: -1,
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {message}
    </div>
  )
}

export function Loading() {
  return (
    <div className="d26-scope flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize: 12,
          letterSpacing: '0.12em',
          color: 'var(--color-d-mut)',
        }}
      >
        A PARTIDA VAI COMEÇAR…
      </span>
    </div>
  )
}

// ---------- App Bar ----------

// memo: AppBar é puro e só depende de phaseLabel (string). Sem isso, re-rendera
// a cada tick mesmo a string não tendo mudado.
const AppBar = memo(function AppBar({ phaseLabel }: { phaseLabel: string }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px clamp(16px, 4vw, 28px)',
        borderBottom: '1px solid var(--color-d-line)',
        background: 'linear-gradient(180deg, #101310, #0d0f0c)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <DiceMark />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontFamily: 'Anton', fontSize: 23, letterSpacing: '0.02em' }}>DRAFT</span>
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
      </Link>
      <nav
        style={{
          display: 'flex',
          gap: 4,
          background: 'var(--color-d-bg)',
          border: '1px solid var(--color-d-line)',
          borderRadius: 11,
          padding: 5,
          overflowX: 'auto',
          maxWidth: '100%',
          order: 3,
          flex: '1 1 320px',
          justifyContent: 'center',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <NavPill disabled label="ESCALAÇÃO" />
        <NavPill disabled label="GRUPOS" />
        <NavPill disabled label="CHAVEAMENTO" />
        <NavPill active label="PARTIDA" />
      </nav>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 11,
          color: 'var(--color-d-lime)',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {phaseLabel}
      </div>
    </div>
  )
})

function NavPill({
  to,
  label,
  active,
  disabled,
}: {
  to?: string
  label: string
  active?: boolean
  disabled?: boolean
}) {
  const base: CSSProperties = {
    fontFamily: 'Space Mono',
    fontSize: 12,
    padding: '8px 13px',
    borderRadius: 8,
    whiteSpace: 'nowrap',
  }
  if (active) {
    return (
      <span
        style={{
          ...base,
          fontWeight: 700,
          background: 'var(--color-d-lime)',
          color: 'var(--color-d-bg)',
        }}
      >
        {label}
      </span>
    )
  }
  if (disabled) {
    return (
      <span
        role="link"
        aria-disabled="true"
        title="Use o ↻ no header pra recomeçar essa etapa"
        style={{ ...base, color: 'var(--color-d-mut)', opacity: 0.55, cursor: 'not-allowed' }}
      >
        {label}
      </span>
    )
  }
  return (
    <Link to={to ?? '#'} style={{ ...base, color: 'var(--color-d-mut)' }}>
      {label}
    </Link>
  )
}

function DiceMark() {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 9,
        background: 'var(--color-d-lime)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 3,
        padding: 7,
      }}
    >
      <span style={dotStyle()} />
      <span />
      <span style={dotStyle('end')} />
      <span />
      <span style={dotStyle('center')} />
      <span />
      <span style={dotStyle()} />
      <span />
      <span style={dotStyle('end')} />
    </div>
  )
}

function dotStyle(justify?: 'end' | 'center'): CSSProperties {
  const base: CSSProperties = {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: 'var(--color-d-bg)',
  }
  if (justify === 'end') base.justifySelf = 'end'
  if (justify === 'center') base.justifySelf = 'center'
  return base
}

// ---------- Scoreboard ----------

function ScoreboardHero({
  home,
  away,
  homeGoals,
  awayGoals,
  clockMinute,
  totalMinutes,
  playing,
  finished,
  shootoutActive,
  shootoutKicksRevealed,
  markers,
}: {
  home: SideTeam
  away: SideTeam
  homeGoals: number
  awayGoals: number
  clockMinute: number
  totalMinutes: number
  playing: boolean
  finished: boolean
  shootoutActive?: boolean
  shootoutKicksRevealed: number
  markers: MatchEvent[]
}) {
  const statusLabel = shootoutActive
    ? `PÊNALTIS ${shootoutKicksRevealed}`
    : computeStatusLabel(clockMinute, totalMinutes, playing, finished)
  const pct = (Math.min(clockMinute, totalMinutes) / totalMinutes) * 100
  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #101310, #0a0b09)',
        borderBottom: '1px solid var(--color-d-line)',
      }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: 'clamp(18px, 3vw, 26px) clamp(16px, 4vw, 28px) clamp(14px, 2.2vw, 22px)',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 'clamp(10px, 2.5vw, 22px)',
        }}
      >
        <TeamSide team={home} reverse={false} />
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'clamp(8px, 2.5vw, 14px)',
              justifyContent: 'center',
            }}
          >
            <ScoreNumber value={homeGoals} isUser={home.isUser} />
            <span
              style={{
                fontFamily: 'Anton',
                fontSize: 'clamp(22px, 6vw, 34px)',
                color: 'var(--color-d-mut)',
              }}
            >
              —
            </span>
            <ScoreNumber value={awayGoals} isUser={away.isUser} />
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              background: 'var(--color-d-bg)',
              border: '1px solid var(--color-d-line)',
              borderRadius: 8,
              padding: '6px clamp(9px, 2vw, 13px)',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--color-d-red)',
                animation: playing ? 'd26-blink 1s infinite' : 'none',
              }}
            />
            <span
              style={{
                fontFamily: 'Space Mono',
                fontSize: 'clamp(12px, 2.4vw, 13px)',
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}
            >
              {finished ? `${totalMinutes}'` : `${clockMinute}'`}
            </span>
            <span
              style={{
                fontFamily: 'Space Mono',
                fontSize: 10,
                color: 'var(--color-d-mut)',
                letterSpacing: '0.08em',
              }}
            >
              {statusLabel}
            </span>
          </div>
        </div>
        <TeamSide team={away} reverse />
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 clamp(16px, 4vw, 28px) 18px' }}>
        <div
          style={{
            position: 'relative',
            height: 8,
            borderRadius: 6,
            background: 'var(--color-d-surface2)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              borderRadius: 6,
              background: 'var(--color-d-lime)',
              width: `${pct}%`,
              transition: 'width .15s linear',
            }}
          />
          {markers.map((m, i) => (
            <span
              key={`${m.minute}-${i}`}
              style={{
                position: 'absolute',
                top: -3,
                left: `${(m.minute / totalMinutes) * 100}%`,
                width: 3,
                height: 14,
                borderRadius: 2,
                background: 'var(--color-d-bg)',
                boxShadow: '0 0 0 1.5px var(--color-d-bg)',
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'Space Mono',
            fontSize: 10,
            color: 'var(--color-d-mut)',
            marginTop: 6,
          }}
        >
          <span>0'</span>
          <span>{Math.floor(totalMinutes / 2)}'</span>
          <span>{totalMinutes}'</span>
        </div>
      </div>
    </div>
  )
}

function computeStatusLabel(
  minute: number,
  total: number,
  playing: boolean,
  finished: boolean,
): string {
  if (finished) return 'ENCERRADO'
  if (minute === 0) return 'APITO INICIAL'
  if (!playing) return 'PAUSADO'
  if (total === 120 && minute > 90) return 'PROR.'
  if (minute === 45) return 'INTERVALO'
  if (minute > 45) return '2º TEMPO'
  return '1º TEMPO'
}

function ScoreNumber({ value, isUser }: { value: number; isUser: boolean }) {
  return (
    <span
      // key muda só quando esse lado marca — gol adversário não dispara flash celebrativo
      key={value}
      style={{
        fontFamily: 'Anton',
        fontSize: 'clamp(40px, 12vw, 64px)',
        lineHeight: 0.85,
        color: isUser ? 'var(--color-d-lime)' : 'var(--color-d-ink)',
        display: 'inline-block',
        // Celebração só do nosso lado. Lado adversário muda número sem animação.
        animation: isUser ? 'd26-goal-flash .5s ease' : 'none',
      }}
    >
      {value}
    </span>
  )
}

function TeamSide({ team, reverse }: { team: SideTeam; reverse: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(9px, 2vw, 16px)',
        justifyContent: reverse ? 'flex-start' : 'flex-end',
        minWidth: 0,
        flexDirection: reverse ? 'row' : 'row-reverse',
      }}
    >
      <TeamBadge team={team} />
      <div style={{ textAlign: reverse ? 'left' : 'right', minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'Anton',
            fontSize: 'clamp(19px, 4.6vw, 30px)',
            lineHeight: 0.9,
            color: team.isUser ? 'var(--color-d-lime)' : 'var(--color-d-ink)',
          }}
        >
          {team.isUser ? 'SEU XI' : team.name.toUpperCase()}
        </div>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 'clamp(9px, 1.6vw, 10px)',
            color: 'var(--color-d-mut)',
            letterSpacing: '0.1em',
            marginTop: 3,
          }}
        >
          {team.isUser ? 'ALL-STARS' : 'SELEÇÃO'} · OVR {Math.round(team.averageOverall)}
        </div>
      </div>
    </div>
  )
}

function TeamBadge({ team }: { team: SideTeam }) {
  const sizeStyle: CSSProperties = {
    width: 'clamp(38px, 9vw, 46px)',
    height: 'clamp(38px, 9vw, 46px)',
    flexShrink: 0,
    borderRadius: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Space Mono',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--color-d-bg)',
  }
  if (team.isUser) {
    return (
      <div
        style={{
          ...sizeStyle,
          background: 'var(--color-d-lime)',
          fontSize: 'clamp(17px, 4vw, 22px)',
        }}
      >
        ⚄
      </div>
    )
  }
  return (
    <div
      role="img"
      aria-label={team.name}
      style={{
        ...sizeStyle,
        background: nationGradient(team.code),
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  )
}

// ---------- Body ----------

function Body({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: 'clamp(16px, 3vw, 22px) clamp(16px, 4vw, 28px) 48px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 18,
        alignItems: 'flex-start',
      }}
    >
      {children}
    </div>
  )
}
