import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  isHalfMatch,
  ROUND_LABEL,
  userHalfOf,
  type BracketMatch,
  type KnockoutBracket,
  type KnockoutTeam,
  type KORound,
} from '../lib/bracket'
import { nationGradient } from '../lib/nation-colors'

interface BracketViewProps {
  bracket: KnockoutBracket
}

const NARROW_BREAKPOINT = 960

export function BracketView({ bracket }: BracketViewProps) {
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const update = () => setIsNarrow(window.innerWidth < NARROW_BREAKPOINT)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  if (isNarrow) return <BracketMobile bracket={bracket} />
  return <BracketDesktop bracket={bracket} />
}

// ============================================================
// DESKTOP — 9 columns
// ============================================================

const DESKTOP_COLS: { round: KORound; side: 'L' | 'R' | 'C'; label: string }[] = [
  { round: 'R32', side: 'L', label: '32-AVOS' },
  { round: 'R16', side: 'L', label: 'OITAVAS' },
  { round: 'QF', side: 'L', label: 'QUARTAS' },
  { round: 'SF', side: 'L', label: 'SEMIFINAL' },
  { round: 'F', side: 'C', label: 'FINAL' },
  { round: 'SF', side: 'R', label: 'SEMIFINAL' },
  { round: 'QF', side: 'R', label: 'QUARTAS' },
  { round: 'R16', side: 'R', label: 'OITAVAS' },
  { round: 'R32', side: 'R', label: '32-AVOS' },
]

function BracketDesktop({ bracket }: { bracket: KnockoutBracket }) {
  const userHalf = userHalfOf(bracket)
  return (
    <div
      style={{
        overflowX: 'auto',
        padding: '14px clamp(16px, 4vw, 28px) 56px',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        style={{
          minWidth: 1520,
          maxWidth: 1680,
          margin: '0 auto',
          height: 740,
          display: 'flex',
          gap: 0,
          alignItems: 'stretch',
        }}
      >
        {DESKTOP_COLS.map((col, idx) => (
          <BracketColumn
            key={`${col.round}-${col.side}-${idx}`}
            bracket={bracket}
            round={col.round}
            side={col.side}
            label={col.label}
            isFirst={idx === 0 || idx === DESKTOP_COLS.length - 1}
            userHalf={userHalf}
          />
        ))}
      </div>
    </div>
  )
}

function BracketColumn({
  bracket,
  round,
  side,
  label,
  isFirst,
  userHalf,
}: {
  bracket: KnockoutBracket
  round: KORound
  side: 'L' | 'R' | 'C'
  label: string
  isFirst: boolean
  userHalf: 'top' | 'bottom'
}) {
  const matches = bracket.matches
    .filter((m) => m.round === round)
    .filter((m) => {
      if (side === 'C') return true
      // L = user's half (consistent with the design's "your path" being on the left)
      const inUserHalf = isHalfMatch(m, userHalf)
      return side === 'L' ? inUserHalf : !inUserHalf
    })
    // Sort by position so visual layout is stable
    .sort((a, b) => a.position - b.position)

  const merges = round === 'R32' || round === 'R16' || round === 'QF'
  const accent = round === 'SF' || round === 'F'
  const labelColor = accent ? 'var(--color-d-lime)' : 'var(--color-d-mut)'
  const isFinal = round === 'F'

  return (
    <div style={{ flex: 1, minWidth: 148, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 10,
          letterSpacing: '0.12em',
          color: labelColor,
          textAlign: 'center',
          marginBottom: 14,
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {isFinal && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              left: 0,
              right: 0,
              textAlign: 'center',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                margin: '0 auto 8px',
                borderRadius: '50%',
                background: 'var(--color-d-lime)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 25,
                boxShadow: '0 8px 24px -6px rgba(212, 255, 61, 0.5)',
              }}
            >
              🏆
            </div>
            <div
              style={{
                fontFamily: 'Anton',
                fontSize: 18,
                color: 'var(--color-d-lime)',
                lineHeight: 0.9,
              }}
            >
              CAMPEÃO<br />DO MUNDO
            </div>
          </div>
        )}
        {matches.map((m, i) => (
          <BracketCell
            key={m.id}
            match={m}
            bracket={bracket}
            side={side}
            isFirst={isFirst}
            merges={merges}
            indexInCol={i}
          />
        ))}
      </div>
    </div>
  )
}

function BracketCell({
  match,
  bracket,
  side,
  isFirst,
  merges,
  indexInCol,
}: {
  match: BracketMatch
  bracket: KnockoutBracket
  side: 'L' | 'R' | 'C'
  isFirst: boolean
  merges: boolean
  indexInCol: number
}) {
  const isUserMatch =
    match.homeCode === bracket.userCode || match.awayCode === bracket.userCode
  const userWon = match.winnerCode === bracket.userCode
  const playable = isUserMatch && !match.winnerCode && match.homeCode && match.awayCode

  const lime = 'var(--color-d-lime)'
  const line = 'var(--color-d-line)'

  // Connectors
  const sLeft = side === 'L' ? !isFirst : side === 'R' ? true : true
  const sRight = side === 'L' ? true : side === 'R' ? !isFirst : true
  const vLeft = side === 'R' && merges && indexInCol % 2 === 0
  const vRight = side === 'L' && merges && indexInCol % 2 === 0
  const connectorColor = isUserMatch || userWon ? lime : line

  const border = playable
    ? 'var(--color-d-lime)'
    : isUserMatch
      ? 'rgba(212,255,61,0.5)'
      : 'var(--color-d-line)'
  const shadow = playable
    ? '0 0 26px -8px rgba(212,255,61,0.55)'
    : isUserMatch
      ? '0 0 18px -10px rgba(212,255,61,0.55)'
      : 'none'

  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 13px',
      }}
    >
      {sLeft && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            width: 13,
            height: 2,
            marginTop: -1,
            background: connectorColor,
            zIndex: 0,
          }}
        />
      )}
      {sRight && (
        <span
          style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            width: 13,
            height: 2,
            marginTop: -1,
            background: connectorColor,
            zIndex: 0,
          }}
        />
      )}
      {vRight && (
        <span
          style={{
            position: 'absolute',
            right: 0,
            top: '50%',
            width: 2,
            height: '100%',
            background: connectorColor,
            zIndex: 0,
          }}
        />
      )}
      {vLeft && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            width: 2,
            height: '100%',
            background: connectorColor,
            zIndex: 0,
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          background: 'var(--color-d-surface)',
          border: `1px solid ${border}`,
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: shadow,
        }}
      >
        <CellSide
          team={match.homeCode ? bracket.teams[match.homeCode] : null}
          score={cellScore(match, 'home')}
          won={winnerSide(match) === 'home'}
          compact
        />
        <div style={{ borderTop: '1px solid var(--color-d-line)' }} />
        <CellSide
          team={match.awayCode ? bracket.teams[match.awayCode] : null}
          score={cellScore(match, 'away')}
          won={winnerSide(match) === 'away'}
          compact
        />
        {playable && <PlayButton matchId={match.id} compact />}
      </div>
    </div>
  )
}

function PlayButton({ matchId, compact }: { matchId: string; compact?: boolean }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(`/match?kind=knockout&id=${matchId}`)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: 'var(--color-d-lime)',
        color: 'var(--color-d-bg)',
        padding: compact ? 9 : 14,
        fontFamily: 'Anton',
        fontSize: compact ? 13 : 17,
        letterSpacing: '0.02em',
        border: 'none',
        cursor: 'pointer',
        width: '100%',
        animation: compact ? 'd26-pulse 2.2s infinite' : 'd26-pulse 2.4s infinite',
      }}
    >
      JOGAR {compact ? '→' : 'PARTIDA →'}
    </button>
  )
}

function CellSide({
  team,
  score,
  won,
  compact,
}: {
  team: KnockoutTeam | null
  score: number | null
  won: boolean
  compact?: boolean
}) {
  const padding = compact ? '7px 9px' : '12px 14px'
  if (!team) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 7 : 10,
          padding,
          color: 'var(--color-d-mut)',
        }}
      >
        <span
          style={{
            width: compact ? 16 : 24,
            height: compact ? 16 : 24,
            borderRadius: 4,
            background: 'var(--color-d-surface2)',
            border: '1px dashed var(--color-d-line)',
            flex: '0 0 auto',
          }}
        />
        <span
          style={{
            flex: 1,
            fontSize: compact ? 12 : 15,
            color: 'var(--color-d-mut)',
            fontStyle: 'italic',
          }}
        >
          —
        </span>
      </div>
    )
  }
  const isUser = team.isUser
  const codeColor = isUser
    ? 'var(--color-d-lime)'
    : won
      ? 'var(--color-d-ink)'
      : 'var(--color-d-mut)'
  const scoreColor = won ? 'var(--color-d-lime)' : 'var(--color-d-mut)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 7 : 10,
        padding,
      }}
    >
      {isUser ? (
        <UserIcon size={compact ? 16 : 24} />
      ) : (
        <TeamChip code={team.code} compact={compact} />
      )}
      <span
        style={{
          flex: 1,
          fontWeight: 700,
          fontSize: compact ? 12 : 15,
          color: codeColor,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {isUser ? 'SEU XI' : team.code.toUpperCase()}
      </span>
      <span style={{ fontFamily: 'Anton', fontSize: compact ? 16 : 23, color: scoreColor }}>
        {score == null ? '–' : score}
      </span>
    </div>
  )
}

function UserIcon({ size }: { size: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size > 20 ? 6 : 4,
        background: 'var(--color-d-lime)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size > 20 ? 12 : 8,
        color: 'var(--color-d-bg)',
        flex: '0 0 auto',
      }}
    >
      ⚄
    </span>
  )
}

function TeamChip({ code, compact }: { code: string; compact?: boolean }) {
  return (
    <span
      style={{
        width: compact ? 16 : 28,
        height: compact ? 11 : 19,
        borderRadius: compact ? 3 : 5,
        background: nationGradient(code),
        flex: '0 0 auto',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    />
  )
}


function cellScore(match: BracketMatch, side: 'home' | 'away'): number | null {
  if (!match.result) return null
  const reg = side === 'home' ? match.result.homeGoals : match.result.awayGoals
  const et = match.extraTime
    ? side === 'home'
      ? match.extraTime.homeGoals
      : match.extraTime.awayGoals
    : 0
  return reg + et
}

function winnerSide(match: BracketMatch): 'home' | 'away' | null {
  if (!match.winnerCode) return null
  return match.winnerCode === match.homeCode ? 'home' : 'away'
}

// ============================================================
// MOBILE — round tabs with SEU LADO + OUTRO LADO
// ============================================================

const MOBILE_ROUNDS: { key: KORound; label: string }[] = [
  { key: 'R32', label: '32-AVOS' },
  { key: 'R16', label: 'OITAVAS' },
  { key: 'QF', label: 'QUARTAS' },
  { key: 'SF', label: 'SEMI' },
  { key: 'F', label: 'FINAL' },
]

function BracketMobile({ bracket }: { bracket: KnockoutBracket }) {
  const userHalf = userHalfOf(bracket)
  const [activeRound, setActiveRound] = useState<KORound>('R32')

  // Auto-jump to user's current round on mount
  useEffect(() => {
    const userRoundsOrder: KORound[] = ['R32', 'R16', 'QF', 'SF', 'F']
    for (const r of userRoundsOrder) {
      const userMatchInRound = bracket.matches.find(
        (m) =>
          m.round === r &&
          (m.homeCode === bracket.userCode || m.awayCode === bracket.userCode),
      )
      if (userMatchInRound && !userMatchInRound.winnerCode) {
        setActiveRound(r)
        return
      }
    }
  }, [bracket])

  const roundMatches = bracket.matches
    .filter((m) => m.round === activeRound)
    .sort((a, b) => a.position - b.position)

  const isFinal = activeRound === 'F'
  const yourSide = isFinal
    ? roundMatches
    : roundMatches.filter((m) => isHalfMatch(m, userHalf))
  const otherSide = isFinal ? [] : roundMatches.filter((m) => !isHalfMatch(m, userHalf))

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '6px clamp(16px, 4vw, 28px) 54px' }}>
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '2px 0 12px',
          marginBottom: 4,
        }}
      >
        {MOBILE_ROUNDS.map((r) => {
          const on = activeRound === r.key
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setActiveRound(r.key)}
              style={{
                flex: '0 0 auto',
                fontFamily: 'Space Mono',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '9px 13px',
                borderRadius: 9,
                whiteSpace: 'nowrap',
                background: on ? 'var(--color-d-lime)' : 'var(--color-d-surface2)',
                color: on ? 'var(--color-d-bg)' : 'var(--color-d-mut)',
                border: `1px solid ${on ? 'var(--color-d-lime)' : 'var(--color-d-line)'}`,
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          )
        })}
      </div>

      {isFinal ? (
        <FinalView matches={roundMatches} bracket={bracket} />
      ) : (
        <>
          <SideHeader title="SEU LADO" sublabel={MOBILE_ROUNDS.find((r) => r.key === activeRound)!.label} primary />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
            {yourSide.map((m) => (
              <MobileMatchCard key={m.id} match={m} bracket={bracket} />
            ))}
          </div>
          <SideHeader title="OUTRO LADO" sublabel="RODANDO EM 2º PLANO" liveAmber />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.72 }}>
            {otherSide.map((m) => (
              <MobileOtherRow key={m.id} match={m} bracket={bracket} />
            ))}
          </div>
          <div
            style={{
              textAlign: 'center',
              fontFamily: 'Space Mono',
              fontSize: 10,
              color: 'var(--color-d-mut)',
              letterSpacing: '0.08em',
              marginTop: 14,
            }}
          >
            O VENCEDOR DESTE LADO É O SEU POSSÍVEL ADVERSÁRIO NA FINAL
          </div>
        </>
      )}
    </div>
  )
}

function SideHeader({
  title,
  sublabel,
  primary,
  liveAmber,
}: {
  title: string
  sublabel: string
  primary?: boolean
  liveAmber?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '4px 0 11px' }}>
      <span
        style={{
          width: 5,
          height: 18,
          borderRadius: 3,
          background: primary ? 'var(--color-d-lime)' : 'var(--color-d-line)',
        }}
      />
      <span
        style={{
          fontFamily: 'Anton',
          fontSize: 16,
          letterSpacing: '0.01em',
          color: primary ? 'var(--color-d-ink)' : 'var(--color-d-mut)',
        }}
      >
        {title}
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'Space Mono',
          fontSize: 9,
          color: 'var(--color-d-mut)',
          letterSpacing: '0.08em',
        }}
      >
        {liveAmber && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-d-warn)',
              animation: 'd26-blink 1.4s infinite',
            }}
          />
        )}
        {sublabel}
      </span>
    </div>
  )
}

function MobileMatchCard({ match, bracket }: { match: BracketMatch; bracket: KnockoutBracket }) {
  const isUserMatch =
    match.homeCode === bracket.userCode || match.awayCode === bracket.userCode
  const playable = isUserMatch && !match.winnerCode && match.homeCode && match.awayCode
  const border = playable
    ? 'var(--color-d-lime)'
    : isUserMatch
      ? 'rgba(212,255,61,0.5)'
      : 'var(--color-d-line)'
  const shadow = playable
    ? '0 0 26px -8px rgba(212,255,61,0.55)'
    : isUserMatch
      ? '0 0 18px -10px rgba(212,255,61,0.55)'
      : 'none'
  return (
    <div
      style={{
        background: 'var(--color-d-surface)',
        border: `1px solid ${border}`,
        borderRadius: 13,
        overflow: 'hidden',
        boxShadow: shadow,
      }}
    >
      <CellSide
        team={match.homeCode ? bracket.teams[match.homeCode] : null}
        score={cellScore(match, 'home')}
        won={winnerSide(match) === 'home'}
      />
      <div style={{ borderTop: '1px solid var(--color-d-line)' }} />
      <CellSide
        team={match.awayCode ? bracket.teams[match.awayCode] : null}
        score={cellScore(match, 'away')}
        won={winnerSide(match) === 'away'}
      />
      {playable && <PlayButton matchId={match.id} />}
    </div>
  )
}

function MobileOtherRow({ match, bracket }: { match: BracketMatch; bracket: KnockoutBracket }) {
  const home = match.homeCode ? bracket.teams[match.homeCode] : null
  const away = match.awayCode ? bracket.teams[match.awayCode] : null
  const hScore = cellScore(match, 'home')
  const aScore = cellScore(match, 'away')
  const wSide = winnerSide(match)
  const played = match.result != null
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 10,
        padding: '11px 13px',
        borderRadius: 11,
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
      }}
    >
      <SmallSide team={home} won={wSide === 'home'} alignRight />
      <ScoreInline
        hScore={hScore}
        aScore={aScore}
        played={played}
        hWin={wSide === 'home'}
        aWin={wSide === 'away'}
      />
      <SmallSide team={away} won={wSide === 'away'} />
    </div>
  )
}

function SmallSide({
  team,
  won,
  alignRight,
}: {
  team: KnockoutTeam | null
  won: boolean
  alignRight?: boolean
}) {
  const color = !team
    ? 'var(--color-d-mut)'
    : won
      ? 'var(--color-d-ink)'
      : 'var(--color-d-mut)'
  const baseStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    flexDirection: alignRight ? 'row' : 'row-reverse',
    justifyContent: alignRight ? 'flex-end' : 'flex-start',
  }
  if (!team) {
    return (
      <div style={baseStyle}>
        <span
          style={{
            fontWeight: 700,
            fontSize: 12,
            color,
            whiteSpace: 'nowrap',
            textAlign: alignRight ? 'right' : 'left',
          }}
        >
          —
        </span>
      </div>
    )
  }
  return (
    <div style={baseStyle}>
      <span
        style={{
          fontWeight: 700,
          fontSize: 12,
          color,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: alignRight ? 'right' : 'left',
        }}
      >
        {team.code.toUpperCase()}
      </span>
      <TeamChip code={team.code} compact />
    </div>
  )
}

function ScoreInline({
  hScore,
  aScore,
  played,
  hWin,
  aWin,
}: {
  hScore: number | null
  aScore: number | null
  played: boolean
  hWin: boolean
  aWin: boolean
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 52, justifyContent: 'center' }}
    >
      <span
        style={{
          fontFamily: 'Anton',
          fontSize: 17,
          color: hWin ? 'var(--color-d-ink)' : 'var(--color-d-mut)',
        }}
      >
        {hScore == null ? '–' : hScore}
      </span>
      <span style={{ fontFamily: 'Anton', fontSize: 11, color: 'var(--color-d-mut)' }}>
        {played ? '—' : '·'}
      </span>
      <span
        style={{
          fontFamily: 'Anton',
          fontSize: 17,
          color: aWin ? 'var(--color-d-ink)' : 'var(--color-d-mut)',
        }}
      >
        {aScore == null ? '–' : aScore}
      </span>
    </div>
  )
}

function FinalView({ matches, bracket }: { matches: BracketMatch[]; bracket: KnockoutBracket }) {
  return (
    <>
      <div style={{ textAlign: 'center', padding: '18px 0 6px' }}>
        <div
          style={{
            width: 60,
            height: 60,
            margin: '0 auto 12px',
            borderRadius: '50%',
            background: 'var(--color-d-lime)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            boxShadow: '0 10px 30px -6px rgba(212,255,61,0.5)',
          }}
        >
          🏆
        </div>
        <div
          style={{
            fontFamily: 'Anton',
            fontSize: 30,
            color: 'var(--color-d-lime)',
            lineHeight: 0.92,
            marginBottom: 18,
          }}
        >
          A GRANDE<br />FINAL
        </div>
      </div>
      {matches.map((m) => (
        <MobileMatchCard key={m.id} match={m} bracket={bracket} />
      ))}
      <div
        style={{
          textAlign: 'center',
          fontFamily: 'Space Mono',
          fontSize: 10,
          color: 'var(--color-d-mut)',
          letterSpacing: '0.1em',
          marginTop: 14,
        }}
      >
        VENÇA AS SEMIS DOS DOIS LADOS PARA CHEGAR AQUI
      </div>
    </>
  )
}

// Re-exports so consumers can opt into a specific layout
export { BracketDesktop, BracketMobile, ROUND_LABEL }
