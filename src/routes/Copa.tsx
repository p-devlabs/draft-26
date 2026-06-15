import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { features } from '../lib/features'
import {
  createWorldCup,
  findTeam,
  nextRound,
  standings,
  userFate,
  userGroup as getUserGroup,
  USER_TEAM_CODE,
  type GroupMatch,
  type GroupStage,
  type GroupTeam,
  type Standing,
  type WorldCupGroups,
} from '../lib/groups'
import { autoFillXI } from '../lib/autofill'
import { createDraft, isComplete, type DraftState } from '../lib/draft'
import { loadDraft, saveWorldCup, loadWorldCup, clearWorldCup, clearDraft } from '../lib/persistence'
import { createRun, syncRun, clearLocalRunId } from '../lib/runs'
import { track } from '../lib/track'
import { nationGradient } from '../lib/nation-colors'

export function Copa() {
  const navigate = useNavigate()
  const [worldCup, setWorldCup] = useState<WorldCupGroups | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)

  useEffect(() => {
    const persisted = loadWorldCup()
    if (persisted) {
      setWorldCup(persisted.worldCup)
      setDraft(persisted.draft)
      return
    }
    const fromDraft = loadDraft()
    if (fromDraft && isComplete(fromDraft)) {
      const newWorldCup = createWorldCup(fromDraft)
      setWorldCup(newWorldCup)
      setDraft(fromDraft)
      saveWorldCup(fromDraft, newWorldCup)
      void createRun({ draft: fromDraft, stage: getUserGroup(newWorldCup) })
      return
    }
    const isDemo =
      new URLSearchParams(window.location.search).get('demo') === '1' || features.dev
    if (isDemo) {
      const demoDraft = autoFillXI(createDraft('4-3-3', 'equilibrado', 'medium'))
      const newWorldCup = createWorldCup(demoDraft)
      setWorldCup(newWorldCup)
      setDraft(demoDraft)
      saveWorldCup(demoDraft, newWorldCup)
      void createRun({ draft: demoDraft, stage: getUserGroup(newWorldCup) })
      return
    }
    navigate('/draft', { replace: true })
  }, [navigate])

  // Vista do grupo do user pra UI. Memoiza pra evitar re-renders desnecessários.
  const stage = useMemo(() => (worldCup ? getUserGroup(worldCup) : null), [worldCup])

  const trackedRoundsRef = useRef<Set<1 | 2 | 3>>(new Set())

  useEffect(() => {
    if (!worldCup || !stage) return
    const finishedNow = nextRound(stage) == null

    // Trackeia cada rodada do user assim que terminar (1, 2, 3) — só uma vez por rodada.
    for (const r of [1, 2, 3] as const) {
      if (trackedRoundsRef.current.has(r)) continue
      const userMatch = stage.matches.find(
        (m) => m.round === r && (m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE),
      )
      if (!userMatch?.result) continue
      trackedRoundsRef.current.add(r)
      const userIsHome = userMatch.homeCode === USER_TEAM_CODE
      const ug = userIsHome ? userMatch.result.homeGoals : userMatch.result.awayGoals
      const og = userIsHome ? userMatch.result.awayGoals : userMatch.result.homeGoals
      const sorted = standings(stage)
      const pos = sorted.findIndex((s) => s.team.isUser) + 1
      const points = sorted.find((s) => s.team.isUser)?.points ?? 0
      void track('group_round_completed', {
        round: r,
        userGoals: ug,
        oppGoals: og,
        userResult: ug > og ? 'W' : ug === og ? 'D' : 'L',
        oppCode: userIsHome ? userMatch.awayCode : userMatch.homeCode,
        posAfter: pos,
        pointsAfter: points,
      })
    }

    if (!finishedNow) {
      void syncRun({ stage })
      return
    }
    // Classificação real Copa 2026: 1º, 2º ou 3º entre os 8 melhores.
    const fate = userFate(worldCup)
    const qualified = fate.kind.startsWith('qualified')
    void syncRun({
      stage,
      ...(qualified ? {} : { finishedRound: 'group' as const }),
    })
    void track('group_completed', { fate: fate.kind, qualified })
  }, [worldCup, stage])

  if (!stage || !draft) {
    return (
      <div className="d26-scope" style={{ minHeight: '100vh' }}>
        <AppBar phaseLabel="" onReset={undefined} />
        <div
          style={{
            padding: 60,
            textAlign: 'center',
            color: 'var(--color-d-mut)',
            fontFamily: 'Space Mono',
            fontSize: 12,
            letterSpacing: '0.12em',
          }}
        >
          CARREGANDO FASE DE GRUPOS…
        </div>
      </div>
    )
  }

  const round = nextRound(stage)
  const finished = round == null
  const sortedStandings = useMemo(() => standings(stage), [stage])
  const userPos = sortedStandings.findIndex((s) => s.team.isUser) + 1
  const userStanding = sortedStandings.find((s) => s.team.isUser) ?? null
  const playedRoundsCount = roundsPlayed(stage)
  // Fate só faz sentido quando a fase encerra — antes disso, posição é parcial.
  const fate = finished && worldCup ? userFate(worldCup) : null
  const phaseLabel = finished
    ? 'FASE DE GRUPOS · ENCERRADA'
    : `FASE DE GRUPOS · JOGO ${playedRoundsCount + 1}/3`

  const userMatchInRound = round
    ? stage.matches.find(
        (m) =>
          m.round === round && (m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE),
      ) ?? null
    : null

  const handlePlay = () => {
    if (!round || !worldCup) return
    saveWorldCup(draft, worldCup)
    navigate(`/match?round=${round}`)
  }

  const handleReset = () => {
    void track('reset_clicked', { from: 'groups' })
    clearWorldCup()
    clearDraft()
    clearLocalRunId()
    navigate('/draft', { replace: true })
  }

  return (
    <div className="d26-scope" style={{ position: 'relative', overflowX: 'hidden' }}>
      <AppBar phaseLabel={phaseLabel} onReset={handleReset} />
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: 'clamp(20px, 3.5vw, 30px) clamp(16px, 4vw, 28px) 60px',
        }}
      >
        <Masthead
          letter={stage.letter}
          userStanding={userStanding}
          userPos={userPos}
          playedRounds={playedRoundsCount}
          finished={finished}
          fate={fate}
        />
        {userMatchInRound && !userMatchInRound.result && (
          <NextMatchBanner
            stage={stage}
            match={userMatchInRound}
            round={round!}
            onPlay={handlePlay}
          />
        )}
        <StandingsSection standings={sortedStandings} round={round} finished={finished} />
        <RoundsGrid stage={stage} currentRound={round} />
        <FooterNav finished={finished} userPos={userPos} />
      </div>
    </div>
  )
}

function roundsPlayed(stage: GroupStage): number {
  let played = 0
  for (const r of [1, 2, 3] as const) {
    const matchesOfRound = stage.matches.filter((m) => m.round === r)
    if (matchesOfRound.every((m) => m.result)) played++
  }
  return played
}

// ============================================================
// App bar
// ============================================================

function AppBar({ phaseLabel, onReset }: { phaseLabel: string; onReset?: () => void }) {
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
        <NavPill active label="GRUPOS" />
        <NavPill to="/bracket" label="CHAVEAMENTO" />
        <NavPill to="/match" label="PARTIDA" />
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            color: 'var(--color-d-lime)',
            whiteSpace: 'nowrap',
          }}
        >
          {phaseLabel}
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            aria-label="Recomeçar campanha"
            title="Recomeçar"
            style={{
              background: 'var(--color-d-surface2)',
              border: '1px solid var(--color-d-line)',
              color: 'var(--color-d-mut)',
              borderRadius: 8,
              width: 30,
              height: 30,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ↻
          </button>
        )}
      </div>
    </div>
  )
}

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
        style={{ ...base, fontWeight: 700, background: 'var(--color-d-lime)', color: 'var(--color-d-bg)' }}
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
  const dot = (justify?: 'end' | 'center'): CSSProperties => {
    const s: CSSProperties = { width: 4, height: 4, borderRadius: '50%', background: 'var(--color-d-bg)' }
    if (justify === 'end') s.justifySelf = 'end'
    if (justify === 'center') s.justifySelf = 'center'
    return s
  }
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
// Group selector
// ============================================================

// ============================================================
// Masthead
// ============================================================

function Masthead({
  letter,
  userStanding,
  userPos,
  playedRounds,
  finished,
  fate,
}: {
  letter: string
  userStanding: Standing | null
  userPos: number
  playedRounds: number
  finished: boolean
  fate: ReturnType<typeof userFate> | null
}) {
  const status = computeStatusPill(userStanding, userPos, finished, fate)
  const pct = (playedRounds / 3) * 100

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 22,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 6, height: 54, borderRadius: 4, background: 'var(--color-d-lime)' }} />
        <div>
          <div
            style={{
              fontFamily: 'Space Mono',
              fontSize: 11,
              letterSpacing: '0.16em',
              color: 'var(--color-d-lime)',
              marginBottom: 5,
            }}
          >
            SEU GRUPO · COPA 2026
          </div>
          <h1
            style={{
              fontFamily: 'Anton',
              fontSize: 'clamp(34px, 7vw, 52px)',
              margin: 0,
              lineHeight: 0.9,
              whiteSpace: 'nowrap',
            }}
          >
            GRUPO {letter}
          </h1>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            fontWeight: 700,
            padding: '6px 13px',
            borderRadius: 8,
            background: status.bg,
            color: status.fg,
            whiteSpace: 'nowrap',
          }}
        >
          {status.label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--color-d-mut)' }}>
            PROGRESSO
          </span>
          <span style={{ fontFamily: 'Anton', fontSize: 16, color: 'var(--color-d-lime)' }}>
            {playedRounds}
          </span>
          <span style={{ fontFamily: 'Anton', fontSize: 16, color: 'var(--color-d-mut)' }}>/3</span>
          <div
            style={{
              width: 96,
              height: 7,
              borderRadius: 6,
              background: 'var(--color-d-surface2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{ width: `${pct}%`, height: '100%', background: 'var(--color-d-lime)', transition: 'width .4s' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function computeStatusPill(
  s: Standing | null,
  pos: number,
  finished: boolean,
  fate: ReturnType<typeof userFate> | null,
): { label: string; bg: string; fg: string } {
  if (!s || pos === 0) {
    return { label: 'CARREGANDO…', bg: 'var(--color-d-surface2)', fg: 'var(--color-d-mut)' }
  }
  if (finished) {
    if (pos === 1)
      return { label: `1º LUGAR · ${s.points} PTS`, bg: 'var(--color-d-lime)', fg: 'var(--color-d-bg)' }
    if (pos === 2)
      return { label: `CLASSIFICADO · ${s.points} PTS`, bg: 'var(--color-d-lime)', fg: 'var(--color-d-bg)' }
    // 3º colocado: depende se entrou nos 8 melhores
    if (pos === 3 && fate?.kind === 'qualified-3rd-rank') {
      return {
        label: `CLASSIFICADO · 3º (#${fate.rank}/12)`,
        bg: 'var(--color-d-lime)',
        fg: 'var(--color-d-bg)',
      }
    }
    if (pos === 3 && fate?.kind === 'eliminated-3rd-rank') {
      return {
        label: `ELIMINADO · 3º (#${fate.rank}/12)`,
        bg: 'var(--color-d-red)',
        fg: '#fff',
      }
    }
    return { label: `ELIMINADO · ${pos}º LUGAR`, bg: 'var(--color-d-red)', fg: '#fff' }
  }
  const labels: Record<number, string> = {
    1: 'LÍDER PARCIAL',
    2: 'EM ZONA · 2º LUGAR',
    3: '3º · PODE CLASSIFICAR',
    4: '4º LUGAR',
  }
  // pos 1-2: zona segura (lime). pos 3: amarelo/warn (pode classificar via
  // 8 melhores 3ºs). pos 4: cinza.
  const tone = pos <= 2
    ? { bg: 'var(--color-d-lime)', fg: 'var(--color-d-bg)' }
    : pos === 3
      ? { bg: 'rgba(255,138,59,0.18)', fg: 'var(--color-d-warn)' }
      : { bg: 'rgba(255,138,59,0.10)', fg: 'var(--color-d-mut)' }
  return { label: `${labels[pos] ?? `${pos}º`} · ${s.points} PTS`, ...tone }
}

// ============================================================
// Next match banner
// ============================================================

function NextMatchBanner({
  stage,
  match,
  round,
  onPlay,
}: {
  stage: GroupStage
  match: GroupMatch
  round: 1 | 2 | 3
  onPlay: () => void
}) {
  const home = findTeam(stage, match.homeCode)!
  const away = findTeam(stage, match.awayCode)!
  return (
    <div
      style={{
        background: 'linear-gradient(120deg, #1a1e16, #141613 70%)',
        border: '1.5px solid rgba(212,255,61,0.4)',
        borderRadius: 16,
        padding: 'clamp(16px, 2.5vw, 22px)',
        marginBottom: 26,
        boxShadow: '0 18px 50px -28px rgba(212,255,61,0.5)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--color-d-lime)',
              animation: 'd26-blink 1.3s infinite',
            }}
          />
          <span
            style={{
              fontFamily: 'Space Mono',
              fontSize: 11,
              letterSpacing: '0.14em',
              color: 'var(--color-d-lime)',
              fontWeight: 700,
            }}
          >
            SUA VEZ · RODADA {round}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 10,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.1em',
          }}
        >
          VENÇA PARA CARIMBAR A VAGA
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px, 3vw, 28px)', flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(12px, 2.5vw, 22px)',
            flex: '1 1 280px',
            minWidth: 240,
          }}
        >
          <BannerTeam team={home} />
          <span style={{ fontFamily: 'Anton', fontSize: 'clamp(20px, 3vw, 26px)', color: 'var(--color-d-mut)' }}>
            VS
          </span>
          <BannerTeam team={away} />
        </div>
        <button
          type="button"
          onClick={onPlay}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: 'var(--color-d-lime)',
            color: 'var(--color-d-bg)',
            border: 'none',
            padding: '16px 24px',
            borderRadius: 12,
            fontFamily: 'Anton',
            fontSize: 'clamp(17px, 2.4vw, 21px)',
            letterSpacing: '0.02em',
            cursor: 'pointer',
            flex: '1 1 220px',
            animation: 'd26-pulse 2.6s infinite',
          }}
        >
          JOGAR PARTIDA →
        </button>
      </div>
    </div>
  )
}

function BannerTeam({ team }: { team: GroupTeam }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, flex: 1 }}>
      <BadgeLarge team={team} />
      <div
        style={{
          fontFamily: 'Anton',
          fontSize: 'clamp(16px, 2.4vw, 20px)',
          color: team.isUser ? 'var(--color-d-lime)' : 'var(--color-d-ink)',
          textAlign: 'center',
          lineHeight: 1,
        }}
      >
        {team.isUser ? 'SEU XI' : team.name.toUpperCase()}
      </div>
    </div>
  )
}

function BadgeLarge({ team }: { team: GroupTeam }) {
  if (team.isUser) {
    return (
      <div
        style={{
          width: 54,
          height: 38,
          borderRadius: 8,
          background: 'var(--color-d-lime)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Anton',
          fontSize: 18,
          color: 'var(--color-d-bg)',
          boxShadow: '0 6px 16px -6px rgba(212,255,61,0.5)',
        }}
      >
        XI
      </div>
    )
  }
  return <BadgeChip code={team.code} width={54} height={38} fontSize={13} />
}

function BadgeChip({
  code,
  width,
  height,
  fontSize,
}: {
  code: string
  width: number
  height: number
  fontSize: number
}) {
  const c = code.toUpperCase()
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: nationGradient(c),
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.14)',
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize,
          fontWeight: 700,
          color: '#fff',
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          letterSpacing: '0.04em',
        }}
      >
        {c}
      </span>
    </div>
  )
}


// ============================================================
// Standings
// ============================================================

function StandingsSection({
  standings,
  round,
  finished,
}: {
  standings: Standing[]
  round: 1 | 2 | 3 | null
  finished: boolean
}) {
  const subtitle = finished
    ? 'FINAL'
    : round
      ? `APÓS RODADA ${(round as number) - 1}`
      : 'INICIAL'
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 13,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <h2 style={{ fontFamily: 'Anton', fontSize: 22, margin: 0, letterSpacing: '0.01em' }}>
            CLASSIFICAÇÃO
          </h2>
          <span
            style={{
              fontFamily: 'Space Mono',
              fontSize: 10,
              color: 'var(--color-d-mut)',
              letterSpacing: '0.1em',
            }}
          >
            {subtitle}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <LegendDot color="var(--color-d-lime)" label="CLASSIFICADO" />
          <LegendDot color="var(--color-d-warn)" label="MELHORES 3ºS" />
        </div>
      </div>
      <div
        style={{
          background: 'var(--color-d-surface)',
          border: '1px solid var(--color-d-line)',
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 34,
        }}
      >
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ minWidth: 480 }}>
            <StandingsHeader />
            {standings.map((s, i) => (
              <StandingsRow key={s.team.code} standing={s} pos={i + 1} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: 'Space Mono',
        fontSize: 10,
        color: 'var(--color-d-mut)',
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />
      {label}
    </span>
  )
}

const ROW_GRID =
  '38px minmax(120px, 1fr) 46px 34px 34px 34px 34px 52px'

function StandingsHeader() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: ROW_GRID,
        gap: 6,
        padding: '12px 16px',
        fontFamily: 'Space Mono',
        fontSize: 10,
        color: 'var(--color-d-mut)',
        letterSpacing: '0.06em',
        borderBottom: '1px solid var(--color-d-line)',
      }}
    >
      <span style={{ textAlign: 'center' }}>#</span>
      <span>SELEÇÃO</span>
      <span style={{ textAlign: 'center', color: 'var(--color-d-ink)' }}>PTS</span>
      <span style={{ textAlign: 'center' }}>J</span>
      <span style={{ textAlign: 'center' }}>V</span>
      <span style={{ textAlign: 'center' }}>E</span>
      <span style={{ textAlign: 'center' }}>D</span>
      <span style={{ textAlign: 'center' }}>SG</span>
    </div>
  )
}

function StandingsRow({ standing, pos }: { standing: Standing; pos: number }) {
  const isUser = standing.team.isUser
  const zone = pos <= 2 ? 'var(--color-d-lime)' : pos === 3 ? 'var(--color-d-warn)' : 'transparent'
  const rowBg = isUser ? 'rgba(212,255,61,0.08)' : 'transparent'
  const accent = isUser ? 'var(--color-d-lime)' : 'var(--color-d-ink)'
  const sg = standing.goalsFor - standing.goalsAgainst
  const sgFormatted = sg > 0 ? `+${sg}` : String(sg)
  const sgColor = sg > 0 ? 'var(--color-d-lime)' : sg < 0 ? 'var(--color-d-mut)' : 'var(--color-d-ink)'
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: ROW_GRID,
        gap: 6,
        alignItems: 'center',
        padding: '13px 16px',
        background: rowBg,
        borderBottom: '1px solid var(--color-d-line)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <span style={{ width: 4, height: 22, borderRadius: 3, background: zone }} />
        <span style={{ fontFamily: 'Anton', fontSize: 16, color: accent }}>{pos}</span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <SmallBadge team={standing.team} />
        <b
          style={{
            fontSize: 14,
            color: accent,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {isUser ? 'SEU XI' : standing.team.name.toUpperCase()}
        </b>
      </span>
      <span
        style={{ fontFamily: 'Anton', fontSize: 18, color: accent, textAlign: 'center' }}
      >
        {standing.points}
      </span>
      <Cell value={standing.played} muted />
      <Cell value={standing.wins} />
      <Cell value={standing.draws} muted />
      <Cell value={standing.losses} muted />
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize: 13,
          textAlign: 'center',
          color: sgColor,
        }}
      >
        {sgFormatted}
      </span>
    </div>
  )
}

function Cell({ value, muted }: { value: number; muted?: boolean }) {
  return (
    <span
      style={{
        fontFamily: 'Space Mono',
        fontSize: 13,
        textAlign: 'center',
        color: muted ? 'var(--color-d-mut)' : 'var(--color-d-ink)',
      }}
    >
      {value}
    </span>
  )
}

function SmallBadge({ team }: { team: GroupTeam }) {
  if (team.isUser) {
    return (
      <div
        style={{
          width: 30,
          height: 21,
          borderRadius: 5,
          background: 'var(--color-d-lime)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Space Mono',
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--color-d-bg)',
          flexShrink: 0,
        }}
      >
        XI
      </div>
    )
  }
  return <BadgeChip code={team.code} width={30} height={21} fontSize={9} />
}

// ============================================================
// Rounds grid
// ============================================================

function RoundsGrid({
  stage,
  currentRound,
}: {
  stage: GroupStage
  currentRound: 1 | 2 | 3 | null
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 15 }}>
        <h2 style={{ fontFamily: 'Anton', fontSize: 22, margin: 0, letterSpacing: '0.01em' }}>
          JOGOS DO GRUPO
        </h2>
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 10,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.1em',
          }}
        >
          3 RODADAS
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: 16,
        }}
      >
        {([1, 2, 3] as const).map((r) => (
          <RoundCard key={r} stage={stage} round={r} currentRound={currentRound} />
        ))}
      </div>
    </>
  )
}

function RoundCard({
  stage,
  round,
  currentRound,
}: {
  stage: GroupStage
  round: 1 | 2 | 3
  currentRound: 1 | 2 | 3 | null
}) {
  const matches = stage.matches.filter((m) => m.round === round)
  const allPlayed = matches.every((m) => m.result)
  const state: 'done' | 'live' | 'next' = allPlayed
    ? 'done'
    : currentRound === round
      ? 'live'
      : 'next'

  const meta = {
    done: {
      cardBorder: 'var(--color-d-line)',
      headBg: 'transparent',
      titleColor: 'var(--color-d-ink)',
      tag: 'ENCERRADA',
      tagBg: 'var(--color-d-surface2)',
      tagColor: 'var(--color-d-mut)',
    },
    live: {
      cardBorder: 'rgba(212,255,61,0.4)',
      headBg: 'rgba(212,255,61,0.06)',
      titleColor: 'var(--color-d-lime)',
      tag: 'EM ANDAMENTO',
      tagBg: 'var(--color-d-lime)',
      tagColor: 'var(--color-d-bg)',
    },
    next: {
      cardBorder: 'var(--color-d-line)',
      headBg: 'transparent',
      titleColor: 'var(--color-d-mut)',
      tag: 'A SEGUIR',
      tagBg: 'transparent',
      tagColor: 'var(--color-d-mut)',
    },
  }[state]

  return (
    <div
      style={{
        background: 'var(--color-d-surface)',
        border: `1px solid ${meta.cardBorder}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 15px',
          borderBottom: '1px solid var(--color-d-line)',
          background: meta.headBg,
        }}
      >
        <span
          style={{
            fontFamily: 'Anton',
            fontSize: 15,
            color: meta.titleColor,
            whiteSpace: 'nowrap',
          }}
        >
          RODADA {round}
        </span>
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '4px 9px',
            borderRadius: 6,
            background: meta.tagBg,
            color: meta.tagColor,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            border:
              state === 'next'
                ? '1px solid var(--color-d-line)'
                : '1px solid transparent',
          }}
        >
          {meta.tag}
        </span>
      </div>
      <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {matches.map((m) => (
          <MatchRow key={`${m.homeCode}-${m.awayCode}`} match={m} stage={stage} state={state} />
        ))}
      </div>
    </div>
  )
}

function MatchRow({
  match,
  stage,
  state,
}: {
  match: GroupMatch
  stage: GroupStage
  state: 'done' | 'live' | 'next'
}) {
  const home = findTeam(stage, match.homeCode)!
  const away = findTeam(stage, match.awayCode)!
  const userIn = home.isUser || away.isUser
  const played = match.result != null
  const hWin = played && match.result!.homeGoals > match.result!.awayGoals
  const aWin = played && match.result!.awayGoals > match.result!.homeGoals

  let rowBg = 'var(--color-d-surface2)'
  let rowBorder = 'var(--color-d-line)'
  if (userIn && state === 'live') {
    rowBg = 'rgba(212,255,61,0.08)'
    rowBorder = 'rgba(212,255,61,0.35)'
  } else if (userIn && played) {
    rowBg = 'rgba(212,255,61,0.05)'
    rowBorder = 'rgba(212,255,61,0.22)'
  } else if (state === 'next') {
    rowBg = 'transparent'
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 10,
        padding: 11,
        borderRadius: 10,
        background: rowBg,
        border: `1px solid ${rowBorder}`,
      }}
    >
      <SideCell team={home} played={played} winner={hWin} alignRight />
      <ScoreCell match={match} home={home} away={away} hWin={hWin} aWin={aWin} played={played} />
      <SideCell team={away} played={played} winner={aWin} />
    </div>
  )
}

function SideCell({
  team,
  played,
  winner,
  alignRight,
}: {
  team: GroupTeam
  played: boolean
  winner: boolean
  alignRight?: boolean
}) {
  const color = team.isUser
    ? 'var(--color-d-lime)'
    : played
      ? 'var(--color-d-ink)'
      : 'var(--color-d-mut)'
  const opacity = played && !winner && !team.isUser ? 0.7 : 1
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        justifyContent: alignRight ? 'flex-end' : 'flex-start',
        flexDirection: alignRight ? 'row' : 'row-reverse',
      }}
    >
      <SmallBadge team={team} />
      <b
        style={{
          fontSize: 12,
          color,
          opacity,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: alignRight ? 'right' : 'left',
        }}
      >
        {team.isUser ? 'SEU XI' : team.code.toUpperCase()}
      </b>
    </div>
  )
}

function ScoreCell({
  match,
  home,
  away,
  hWin,
  aWin,
  played,
}: {
  match: GroupMatch
  home: GroupTeam
  away: GroupTeam
  hWin: boolean
  aWin: boolean
  played: boolean
}) {
  const hColor = !played
    ? 'var(--color-d-mut)'
    : hWin
      ? home.isUser
        ? 'var(--color-d-lime)'
        : 'var(--color-d-ink)'
      : 'var(--color-d-mut)'
  const aColor = !played
    ? 'var(--color-d-mut)'
    : aWin
      ? away.isUser
        ? 'var(--color-d-lime)'
        : 'var(--color-d-ink)'
      : 'var(--color-d-mut)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 54,
      }}
    >
      <span style={{ fontFamily: 'Anton', fontSize: 18, color: hColor }}>
        {played ? match.result!.homeGoals : ''}
      </span>
      <span
        style={{
          fontFamily: 'Anton',
          fontSize: 11,
          color: 'var(--color-d-mut)',
          margin: '0 5px',
        }}
      >
        {played ? '—' : 'VS'}
      </span>
      <span style={{ fontFamily: 'Anton', fontSize: 18, color: aColor }}>
        {played ? match.result!.awayGoals : ''}
      </span>
    </div>
  )
}

// ============================================================
// Footer nav
// ============================================================

function FooterNav({ finished, userPos }: { finished: boolean; userPos: number }) {
  const qualified = finished && userPos > 0 && userPos <= 2
  const ctaLabel = qualified ? 'IR PRO MATA-MATA →' : 'VER MATA-MATA →'
  const ctaStyle: CSSProperties = qualified
    ? {
        background: 'var(--color-d-lime)',
        color: 'var(--color-d-bg)',
        border: '1px solid var(--color-d-lime)',
        animation: 'd26-pulse 2.6s infinite',
      }
    : {
        background: 'transparent',
        color: 'var(--color-d-mut)',
        border: '1px solid var(--color-d-line)',
      }
  const note = finished
    ? qualified
      ? 'Você passou. O mata-mata começa nos 32-avos.'
      : 'Sua campanha de grupos acabou. Tente outro draft.'
    : 'Conclua os 3 jogos do grupo para liberar o mata-mata.'
  return (
    <div
      style={{
        marginTop: 34,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14,
        paddingTop: 22,
        borderTop: '1px solid var(--color-d-line)',
      }}
    >
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize: 11,
          color: 'var(--color-d-mut)',
          maxWidth: 340,
          lineHeight: 1.5,
        }}
      >
        {note}
      </span>
      <Link
        to="/bracket"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '13px 22px',
          borderRadius: 11,
          fontFamily: qualified ? 'Anton' : 'Space Mono',
          fontSize: qualified ? 17 : 12,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textDecoration: 'none',
          ...ctaStyle,
        }}
      >
        {ctaLabel}
      </Link>
    </div>
  )
}
