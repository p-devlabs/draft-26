import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  findTeam,
  playRound,
  standings,
  USER_TEAM_CODE,
  type GroupMatch,
  type GroupStage,
} from '../lib/groups'
import {
  applyResult,
  findMatch as findKnockoutMatch,
  fullySimulate,
  ROUND_LABEL,
  ROUND_ORDER,
  simulateNonUserRound,
  type BracketMatch,
  type KnockoutBracket,
  type KORound,
  type Penalties,
} from '../lib/bracket'
import { rosterForKnockout } from '../lib/rosters'
import { narrateMatch } from '../lib/narrate'
import { loadBracket, loadStage, saveBracket, saveStage } from '../lib/persistence'
import type { MatchEvent } from '../lib/narrate'
import type { DraftState } from '../lib/draft'

type Speed = 'slow' | 'normal' | 'fast'

const SPEED_DURATION: Record<Speed, number> = {
  slow: 60,
  normal: 30,
  fast: 12,
}
const TICK_MS = 60
const SPEED_LABEL: Record<Speed, string> = { slow: '1×', normal: '2×', fast: '4×' }
const SPEED_ORDER: Speed[] = ['slow', 'normal', 'fast']

type MatchKind = 'group' | 'knockout'

export function Match() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const kind: MatchKind = params.get('kind') === 'knockout' ? 'knockout' : 'group'

  if (kind === 'knockout') return <KnockoutMatchRunner navigate={navigate} matchId={params.get('id') ?? ''} />
  return <GroupMatchRunner navigate={navigate} round={Number(params.get('round')) as 1 | 2 | 3} />
}

// ============================================================
// GROUP MATCH
// ============================================================

function GroupMatchRunner({
  navigate,
  round,
}: {
  navigate: ReturnType<typeof useNavigate>
  round: 1 | 2 | 3
}) {
  const [data, setData] = useState<{ stage: GroupStage; draft: DraftState } | null>(null)
  const [virtualMinute, setVirtualMinute] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<Speed>('normal')
  const [outcome, setOutcome] = useState<OutcomeKind | null>(null)
  const persistedRef = useRef(false)

  useEffect(() => {
    const persisted = loadStage()
    if (!persisted || !round) {
      navigate('/groups', { replace: true })
      return
    }
    const played = playRound(persisted.stage, round, persisted.draft)
    setData({ stage: played, draft: persisted.draft })
  }, [navigate, round])

  useEffect(() => {
    if (!data || !playing) return
    const duration = SPEED_DURATION[speed]
    const ratePerTick = (90 / (duration * 1000)) * TICK_MS
    const id = window.setInterval(() => {
      setVirtualMinute((m) => {
        const next = m + ratePerTick
        if (next >= 90) {
          window.clearInterval(id)
          return 90
        }
        return next
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [data, playing, speed])

  const userMatch = useMemo<GroupMatch | null>(() => {
    if (!data) return null
    return (
      data.stage.matches.find(
        (m) => m.round === round && (m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE),
      ) ?? null
    )
  }, [data, round])

  useEffect(() => {
    if (!data || virtualMinute < 90 || persistedRef.current) return
    persistedRef.current = true
    saveStage(data.draft, data.stage)
    setPlaying(false)
    setOutcome(resolveGroupOutcome(data.stage, round))
  }, [data, virtualMinute, round])

  if (!data || !userMatch) return <Loading />

  const homeTeam = findTeam(data.stage, userMatch.homeCode)!
  const awayTeam = findTeam(data.stage, userMatch.awayCode)!
  const wholeMinute = Math.floor(virtualMinute)
  const events = userMatch.events ?? []
  const revealed = events.filter((e) => e.minute <= wholeMinute)
  const homeGoals = revealed.filter((e) => e.type === 'goal' && e.teamCode === homeTeam.code).length
  const awayGoals = revealed.filter((e) => e.type === 'goal' && e.teamCode === awayTeam.code).length
  const finished = virtualMinute >= 90

  const home: SideTeam = {
    code: homeTeam.code,
    name: homeTeam.name,
    averageOverall: homeTeam.averageOverall,
    isUser: homeTeam.isUser,
  }
  const away: SideTeam = {
    code: awayTeam.code,
    name: awayTeam.name,
    averageOverall: awayTeam.averageOverall,
    isUser: awayTeam.isUser,
  }
  const finalEvents = finished ? events : revealed
  const goalEvents = finalEvents.filter((e) => e.type === 'goal' || e.type === 'red')

  return (
    <PartidaShell
      phaseLabel={`GRUPO ${data.stage.letter} · RODADA ${round}`}
      home={home}
      away={away}
      homeGoals={homeGoals}
      awayGoals={awayGoals}
      clockMinute={wholeMinute}
      totalMinutes={90}
      playing={playing}
      finished={finished}
      events={revealed}
      goalAndRedEvents={goalEvents}
      speed={speed}
      onToggle={() => setPlaying((p) => !p)}
      onRestart={() => {
        setVirtualMinute(0)
        setPlaying(true)
        persistedRef.current = false
        setOutcome(null)
      }}
      onSpeed={setSpeed}
      onSkipToEnd={() => setVirtualMinute(90)}
      outcome={outcome}
      outcomeContext={buildGroupOutcomeContext(data.stage, data.draft, round, homeTeam, awayTeam, homeGoals, awayGoals)}
      onCloseOutcome={() => setOutcome(null)}
      onShowOutcome={(o) => setOutcome(o)}
    />
  )
}

function resolveGroupOutcome(stage: GroupStage, round: 1 | 2 | 3): OutcomeKind {
  const table = standings(stage)
  if (round < 3) {
    const userMatch = stage.matches.find(
      (m) => m.round === round && (m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE),
    )
    if (!userMatch?.result) return 'grupo-resultado'
    const userIsHome = userMatch.homeCode === USER_TEAM_CODE
    const ug = userIsHome ? userMatch.result.homeGoals : userMatch.result.awayGoals
    const og = userIsHome ? userMatch.result.awayGoals : userMatch.result.homeGoals
    if (ug > og) return 'grupo'
    return 'grupo-resultado'
  }
  // round 3 (final group game)
  const userPos = table.findIndex((s) => s.team.code === USER_TEAM_CODE)
  if (userPos === 0 || userPos === 1) return 'classificado'
  return 'fora-grupos'
}

function buildGroupOutcomeContext(
  stage: GroupStage,
  draft: DraftState,
  round: 1 | 2 | 3,
  home: ReturnType<typeof findTeam>,
  away: ReturnType<typeof findTeam>,
  homeGoals: number,
  awayGoals: number,
): OutcomeContext {
  const userMatch = stage.matches.find(
    (m) => m.round === round && (m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE),
  )
  const userIsHome = userMatch?.homeCode === USER_TEAM_CODE
  const userGoals = userIsHome ? homeGoals : awayGoals
  const oppGoals = userIsHome ? awayGoals : homeGoals
  const opp = userIsHome ? away : home
  const stats = computeGroupCampaign(stage)
  const scorers = computeGroupScorers(stage)
  const table = standings(stage)
  const userPos = table.findIndex((s) => s.team.code === USER_TEAM_CODE) + 1
  return {
    phase: `FASE DE GRUPOS · ${round}/3`,
    resultLine: `SEU XI ${userGoals}–${oppGoals} ${opp?.name?.slice(0, 3).toUpperCase() ?? 'OPP'}`,
    draft,
    stats,
    scorers,
    extras: { userPos },
  }
}

function computeGroupCampaign(stage: GroupStage): CampaignStats {
  let jogos = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0
  for (const m of stage.matches) {
    if (!m.result) continue
    if (m.homeCode !== USER_TEAM_CODE && m.awayCode !== USER_TEAM_CODE) continue
    jogos++
    const userIsHome = m.homeCode === USER_TEAM_CODE
    const ug = userIsHome ? m.result.homeGoals : m.result.awayGoals
    const og = userIsHome ? m.result.awayGoals : m.result.homeGoals
    gf += ug
    ga += og
    if (ug > og) w++
    else if (ug === og) d++
    else l++
  }
  return { jogos, rec: `${w}-${d}-${l}`, gols: gf, saldo: signed(gf - ga) }
}

function computeGroupScorers(stage: GroupStage): ScorerRow[] {
  const counts = new Map<string, number>()
  for (const m of stage.matches) {
    if (!m.events) continue
    for (const e of m.events) {
      if (e.type !== 'goal' || e.teamCode !== USER_TEAM_CODE) continue
      counts.set(e.player, (counts.get(e.player) ?? 0) + 1)
    }
  }
  return scorersFromCounts(counts)
}

// ============================================================
// KNOCKOUT MATCH
// ============================================================

function KnockoutMatchRunner({
  navigate,
  matchId,
}: {
  navigate: ReturnType<typeof useNavigate>
  matchId: string
}) {
  const [bracket, setBracket] = useState<KnockoutBracket | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [stage, setStage] = useState<GroupStage | null>(null)
  const [virtualMinute, setVirtualMinute] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<Speed>('normal')
  const [simResult, setSimResult] = useState<
    | { events: MatchEvent[]; extraTime?: { homeGoals: number; awayGoals: number }; penalties?: Penalties; winner: 'home' | 'away' }
    | null
  >(null)
  const [outcome, setOutcome] = useState<OutcomeKind | null>(null)
  const persistedRef = useRef(false)

  useEffect(() => {
    const stageData = loadStage()
    const br = loadBracket()
    if (!stageData || !br) {
      navigate('/bracket', { replace: true })
      return
    }
    const match = findKnockoutMatch(br, matchId)
    if (!match || !match.homeCode || !match.awayCode) {
      navigate('/bracket', { replace: true })
      return
    }
    setDraft(stageData.draft)
    setStage(stageData.stage)

    const home = br.teams[match.homeCode]
    const away = br.teams[match.awayCode]
    const sim = fullySimulate(home, away)
    const events = narrateMatch({
      home: rosterForKnockout(home.code, stageData.draft, { name: home.name, flag: home.flag }),
      away: rosterForKnockout(away.code, stageData.draft, { name: away.name, flag: away.flag }),
      result: sim.result,
    })
    setSimResult({
      events,
      extraTime: sim.extraTime,
      penalties: sim.penalties,
      winner: sim.winner,
    })

    const winnerCode = sim.winner === 'home' ? home.code : away.code
    let next = applyResult(br, matchId, {
      result: sim.result,
      extraTime: sim.extraTime,
      penalties: sim.penalties,
      winnerCode,
      events,
    })
    next = simulateNonUserRound(next, match.round)
    setBracket(next)
  }, [matchId, navigate])

  const goalMinute = simResult?.extraTime ? 120 : 90

  useEffect(() => {
    if (!bracket || !simResult || !playing) return
    const duration = SPEED_DURATION[speed] * (goalMinute / 90)
    const ratePerTick = (goalMinute / (duration * 1000)) * TICK_MS
    const id = window.setInterval(() => {
      setVirtualMinute((m) => {
        const next = m + ratePerTick
        if (next >= goalMinute) {
          window.clearInterval(id)
          return goalMinute
        }
        return next
      })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [bracket, simResult, playing, speed, goalMinute])

  const finalShowing = !!simResult && virtualMinute >= goalMinute

  useEffect(() => {
    if (!bracket || !draft || !finalShowing || persistedRef.current) return
    persistedRef.current = true
    saveBracket(bracket)
    setPlaying(false)
    const match = findKnockoutMatch(bracket, matchId)
    if (!match) return
    setOutcome(resolveKnockoutOutcome(bracket, match))
  }, [bracket, draft, finalShowing, matchId])

  if (!bracket || !simResult || !draft || !stage) return <Loading />

  const match = findKnockoutMatch(bracket, matchId)!
  const homeTeam = bracket.teams[match.homeCode!]
  const awayTeam = bracket.teams[match.awayCode!]
  const wholeMinute = Math.floor(virtualMinute)
  const revealed = simResult.events.filter((e) => e.minute <= Math.min(wholeMinute, 90))
  const inExtraTime = wholeMinute > 90
  const homeGoals90 = revealed.filter((e) => e.type === 'goal' && e.teamCode === homeTeam.code).length
  const awayGoals90 = revealed.filter((e) => e.type === 'goal' && e.teamCode === awayTeam.code).length
  const extraHome = inExtraTime ? (simResult.extraTime?.homeGoals ?? 0) : 0
  const extraAway = inExtraTime ? (simResult.extraTime?.awayGoals ?? 0) : 0
  const homeGoals = homeGoals90 + extraHome
  const awayGoals = awayGoals90 + extraAway

  const home: SideTeam = {
    code: homeTeam.code,
    name: homeTeam.name,
    averageOverall: homeTeam.averageOverall,
    isUser: homeTeam.isUser,
  }
  const away: SideTeam = {
    code: awayTeam.code,
    name: awayTeam.name,
    averageOverall: awayTeam.averageOverall,
    isUser: awayTeam.isUser,
  }
  const goalEvents = (finalShowing ? simResult.events : revealed).filter(
    (e) => e.type === 'goal' || e.type === 'red',
  )

  const phaseLabel = `${ROUND_LABEL[match.round].toUpperCase()} · COPA 2026`

  return (
    <PartidaShell
      phaseLabel={phaseLabel}
      home={home}
      away={away}
      homeGoals={homeGoals}
      awayGoals={awayGoals}
      clockMinute={Math.min(wholeMinute, goalMinute)}
      totalMinutes={goalMinute}
      playing={playing}
      finished={finalShowing}
      events={revealed}
      goalAndRedEvents={goalEvents}
      penalties={finalShowing ? simResult.penalties : undefined}
      penaltyHomeCode={match.homeCode!}
      penaltyAwayCode={match.awayCode!}
      speed={speed}
      onToggle={() => setPlaying((p) => !p)}
      onRestart={() => {
        setVirtualMinute(0)
        setPlaying(true)
        persistedRef.current = false
        setOutcome(null)
      }}
      onSpeed={setSpeed}
      onSkipToEnd={() => setVirtualMinute(goalMinute)}
      outcome={outcome}
      outcomeContext={buildKnockoutOutcomeContext(bracket, stage, draft, match, homeGoals, awayGoals, simResult.penalties)}
      onCloseOutcome={() => setOutcome(null)}
      onShowOutcome={(o) => setOutcome(o)}
    />
  )
}

function resolveKnockoutOutcome(bracket: KnockoutBracket, match: BracketMatch): OutcomeKind {
  const userWon = match.winnerCode === bracket.userCode
  if (!userWon) return 'elim'
  if (match.round === 'F') return 'champ'
  return 'avancou'
}

function buildKnockoutOutcomeContext(
  bracket: KnockoutBracket,
  stage: GroupStage,
  draft: DraftState,
  match: BracketMatch,
  homeGoals: number,
  awayGoals: number,
  penalties?: Penalties,
): OutcomeContext {
  const userIsHome = match.homeCode === bracket.userCode
  const userGoals = userIsHome ? homeGoals : awayGoals
  const oppGoals = userIsHome ? awayGoals : homeGoals
  const oppCode = userIsHome ? match.awayCode! : match.homeCode!
  const oppTeam = bracket.teams[oppCode]
  const stats = computeFullCampaign(stage, bracket)
  const scorers = computeFullScorers(stage, bracket)
  const roundLabel = ROUND_LABEL[match.round].toUpperCase()
  let resultLine = `SEU XI ${userGoals}–${oppGoals} ${oppTeam?.code ?? 'OPP'}`
  if (penalties) {
    const ph = penalties.homeScored
    const pa = penalties.awayScored
    const userP = userIsHome ? ph : pa
    const oppP = userIsHome ? pa : ph
    resultLine += ` (${userP}–${oppP} pen)`
  }
  return {
    phase: `${roundLabel} · COPA 2026`,
    resultLine,
    draft,
    stats,
    scorers,
    extras: { nextRoundLabel: nextRoundOfLabel(match.round) },
  }
}

function nextRoundOfLabel(r: KORound): string | null {
  const idx = ROUND_ORDER.indexOf(r)
  if (idx < 0 || idx >= ROUND_ORDER.length - 1) return null
  return ROUND_LABEL[ROUND_ORDER[idx + 1]].toUpperCase()
}

function computeFullCampaign(stage: GroupStage, bracket: KnockoutBracket): CampaignStats {
  let jogos = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0
  for (const m of stage.matches) {
    if (!m.result) continue
    if (m.homeCode !== USER_TEAM_CODE && m.awayCode !== USER_TEAM_CODE) continue
    jogos++
    const userIsHome = m.homeCode === USER_TEAM_CODE
    const ug = userIsHome ? m.result.homeGoals : m.result.awayGoals
    const og = userIsHome ? m.result.awayGoals : m.result.homeGoals
    gf += ug; ga += og
    if (ug > og) w++
    else if (ug === og) d++
    else l++
  }
  for (const m of bracket.matches) {
    if (!m.result) continue
    if (m.homeCode !== bracket.userCode && m.awayCode !== bracket.userCode) continue
    jogos++
    const userIsHome = m.homeCode === bracket.userCode
    const reg = m.result
    const extra = m.extraTime ?? { homeGoals: 0, awayGoals: 0 }
    const userTotal = (userIsHome ? reg.homeGoals : reg.awayGoals) + (userIsHome ? extra.homeGoals : extra.awayGoals)
    const oppTotal = (userIsHome ? reg.awayGoals : reg.homeGoals) + (userIsHome ? extra.awayGoals : extra.homeGoals)
    gf += userTotal; ga += oppTotal
    if (m.winnerCode === bracket.userCode) w++
    else if (m.winnerCode) l++
    else d++
  }
  return { jogos, rec: `${w}-${d}-${l}`, gols: gf, saldo: signed(gf - ga) }
}

function computeFullScorers(stage: GroupStage, bracket: KnockoutBracket): ScorerRow[] {
  const counts = new Map<string, number>()
  const eat = (events: MatchEvent[] | undefined, userCode: string) => {
    if (!events) return
    for (const e of events) {
      if (e.type !== 'goal' || e.teamCode !== userCode) continue
      counts.set(e.player, (counts.get(e.player) ?? 0) + 1)
    }
  }
  for (const m of stage.matches) eat(m.events, USER_TEAM_CODE)
  for (const m of bracket.matches) eat(m.events, bracket.userCode)
  return scorersFromCounts(counts)
}

function scorersFromCounts(counts: Map<string, number>): ScorerRow[] {
  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, goals]) => ({ name, goals }))
  return rows
}

function signed(n: number): string {
  if (n > 0) return `+${n}`
  return String(n)
}

// ============================================================
// PARTIDA SHELL — the design
// ============================================================

interface SideTeam {
  code: string
  name: string
  averageOverall: number
  isUser: boolean
}

interface ScorerRow {
  name: string
  goals: number
}

interface CampaignStats {
  jogos: number
  rec: string
  gols: number
  saldo: string
}

type OutcomeKind =
  | 'grupo'
  | 'grupo-resultado'
  | 'classificado'
  | 'fora-grupos'
  | 'avancou'
  | 'elim'
  | 'champ'

interface OutcomeContext {
  phase: string
  resultLine: string
  draft: DraftState
  stats: CampaignStats
  scorers: ScorerRow[]
  extras: { userPos?: number; nextRoundLabel?: string | null }
}

interface PartidaShellProps {
  phaseLabel: string
  home: SideTeam
  away: SideTeam
  homeGoals: number
  awayGoals: number
  clockMinute: number
  totalMinutes: number
  playing: boolean
  finished: boolean
  events: MatchEvent[]
  goalAndRedEvents: MatchEvent[]
  speed: Speed
  onToggle: () => void
  onRestart: () => void
  onSpeed: (s: Speed) => void
  onSkipToEnd: () => void
  outcome: OutcomeKind | null
  outcomeContext: OutcomeContext
  onCloseOutcome: () => void
  onShowOutcome: (o: OutcomeKind) => void
  penalties?: Penalties
  penaltyHomeCode?: string
  penaltyAwayCode?: string
}

function PartidaShell(p: PartidaShellProps) {
  const totalGoals = p.homeGoals + p.awayGoals
  const isOutcomeOpen = !!p.outcome

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
        flashKey={totalGoals}
        markers={p.goalAndRedEvents}
      />
      <Body>
        <LancesFeed events={p.events} home={p.home} away={p.away} />
        <RightColumn
          playing={p.playing}
          finished={p.finished}
          speed={p.speed}
          onToggle={p.onToggle}
          onRestart={p.onRestart}
          onSpeed={p.onSpeed}
          onSkipToEnd={p.onSkipToEnd}
          onShowOutcome={p.onShowOutcome}
          outcome={p.outcome}
          penalties={p.penalties}
          home={p.home}
          away={p.away}
          penaltyHomeCode={p.penaltyHomeCode}
          penaltyAwayCode={p.penaltyAwayCode}
        />
      </Body>
      {isOutcomeOpen && (
        <OutcomeDrawer
          outcome={p.outcome!}
          ctx={p.outcomeContext}
          onClose={p.onCloseOutcome}
        />
      )}
    </div>
  )
}

function Loading() {
  return (
    <div className="d26-scope flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <span style={{ fontFamily: 'Space Mono', fontSize: 12, letterSpacing: '0.12em', color: 'var(--color-d-mut)' }}>
        A PARTIDA VAI COMEÇAR…
      </span>
    </div>
  )
}

// ---------- App Bar ----------

function AppBar({ phaseLabel }: { phaseLabel: string }) {
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
          <span style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--color-d-lime)', fontWeight: 700 }}>26</span>
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
        <NavPill to="/draft" label="ESCALAÇÃO" />
        <NavPill to="/groups" label="GRUPOS" />
        <NavPill to="/bracket" label="CHAVEAMENTO" />
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
}

function NavPill({ to, label, active }: { to?: string; label: string; active?: boolean }) {
  const base: CSSProperties = {
    fontFamily: 'Space Mono',
    fontSize: 12,
    padding: '8px 13px',
    borderRadius: 8,
    whiteSpace: 'nowrap',
  }
  if (active) {
    return (
      <span style={{ ...base, fontWeight: 700, background: 'var(--color-d-lime)', color: 'var(--color-d-bg)' }}>
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
  home, away, homeGoals, awayGoals, clockMinute, totalMinutes, playing, finished, flashKey, markers,
}: {
  home: SideTeam
  away: SideTeam
  homeGoals: number
  awayGoals: number
  clockMinute: number
  totalMinutes: number
  playing: boolean
  finished: boolean
  flashKey: number
  markers: MatchEvent[]
}) {
  const statusLabel = computeStatusLabel(clockMinute, totalMinutes, playing, finished)
  const pct = (Math.min(clockMinute, totalMinutes) / totalMinutes) * 100
  return (
    <div style={{ background: 'linear-gradient(180deg, #101310, #0a0b09)', borderBottom: '1px solid var(--color-d-line)' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2.5vw, 14px)', justifyContent: 'center' }}>
            <ScoreNumber value={homeGoals} flashKey={flashKey} highlight={home.isUser} />
            <span style={{ fontFamily: 'Anton', fontSize: 'clamp(22px, 6vw, 34px)', color: 'var(--color-d-mut)' }}>—</span>
            <ScoreNumber value={awayGoals} flashKey={flashKey} highlight={away.isUser} />
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
            <span style={{ fontFamily: 'Space Mono', fontSize: 'clamp(12px, 2.4vw, 13px)', fontWeight: 700, letterSpacing: '0.06em' }}>
              {finished ? `${totalMinutes}'` : `${clockMinute}'`}
            </span>
            <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'var(--color-d-mut)', letterSpacing: '0.08em' }}>
              {statusLabel}
            </span>
          </div>
        </div>
        <TeamSide team={away} reverse />
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 clamp(16px, 4vw, 28px) 18px' }}>
        <div style={{ position: 'relative', height: 8, borderRadius: 6, background: 'var(--color-d-surface2)' }}>
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
                background: m.type === 'red' ? 'var(--color-d-red)' : 'var(--color-d-bg)',
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

function computeStatusLabel(minute: number, total: number, playing: boolean, finished: boolean): string {
  if (finished) return 'ENCERRADO'
  if (minute === 0) return 'APITO INICIAL'
  if (!playing) return 'PAUSADO'
  if (total === 120 && minute > 90) return 'PROR.'
  if (minute === 45) return 'INTERVALO'
  if (minute > 45) return '2º TEMPO'
  return '1º TEMPO'
}

function ScoreNumber({ value, flashKey, highlight }: { value: number; flashKey: number; highlight: boolean }) {
  return (
    <span
      key={`${value}-${flashKey}`}
      style={{
        fontFamily: 'Anton',
        fontSize: 'clamp(40px, 12vw, 64px)',
        lineHeight: 0.85,
        color: highlight ? 'var(--color-d-lime)' : 'var(--color-d-ink)',
        display: 'inline-block',
        animation: 'd26-goal-flash .5s ease',
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
      <div style={{ ...sizeStyle, background: 'var(--color-d-lime)', fontSize: 'clamp(17px, 4vw, 22px)' }}>⚄</div>
    )
  }
  return (
    <div
      style={{
        ...sizeStyle,
        background: gradientFor(team.code),
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '6px 6px 4px',
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.95) 100%)',
          color: '#fff',
          fontFamily: 'Space Mono',
          fontWeight: 700,
          fontSize: 10,
          letterSpacing: '0.04em',
          textAlign: 'center',
        }}
      >
        {team.code.slice(0, 3).toUpperCase()}
      </span>
    </div>
  )
}

function gradientFor(code: string): string {
  let h = 0
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) | 0
  const h1 = Math.abs(h) % 360
  const h2 = (h1 + 95) % 360
  return `linear-gradient(135deg, hsl(${h1} 65% 42%), hsl(${h2} 70% 52%))`
}

// ---------- Body / Lances / Right Column ----------

function Body({ children }: { children: React.ReactNode }) {
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

function LancesFeed({ events, home, away }: { events: MatchEvent[]; home: SideTeam; away: SideTeam }) {
  const reversed = [...events].reverse()
  return (
    <div
      style={{
        flex: '5 1 360px',
        minWidth: 0,
        background: 'var(--color-d-surface)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '15px 18px',
          borderBottom: '1px solid var(--color-d-line)',
        }}
      >
        <div style={{ fontFamily: 'Anton', fontSize: 18 }}>LANCES</div>
        <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--color-d-mut)' }}>
          GOLS E EXPULSÕES
        </div>
      </div>
      <div
        style={{
          minHeight: 360,
          maxHeight: 420,
          overflowY: 'auto',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        {reversed.length === 0 ? (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--color-d-mut)',
              fontFamily: 'Space Mono',
              fontSize: 12,
              letterSpacing: '0.08em',
            }}
          >
            A PARTIDA VAI COMEÇAR…
          </div>
        ) : (
          reversed.map((ev, i) => <LanceRow key={`${ev.minute}-${i}`} ev={ev} home={home} away={away} />)
        )}
      </div>
    </div>
  )
}

function LanceRow({ ev, home, away }: { ev: MatchEvent; home: SideTeam; away: SideTeam }) {
  const isGoal = ev.type === 'goal'
  const isRed = ev.type === 'red'
  const bg = isGoal
    ? 'rgba(212,255,61,0.07)'
    : isRed
      ? 'rgba(255,59,59,0.07)'
      : 'var(--color-d-surface2)'
  const bd = isGoal
    ? 'rgba(212,255,61,0.3)'
    : isRed
      ? 'rgba(255,59,59,0.3)'
      : 'var(--color-d-line)'
  const dotColor = isGoal ? 'var(--color-d-lime)' : isRed ? 'var(--color-d-red)' : 'var(--color-d-mut)'
  const minColor = isGoal ? 'var(--color-d-lime)' : isRed ? 'var(--color-d-red)' : 'var(--color-d-ink)'
  const teamTag =
    ev.teamCode === home.code
      ? home.isUser ? 'SEU XI' : home.code.toUpperCase()
      : ev.teamCode === away.code
        ? away.isUser ? 'SEU XI' : away.code.toUpperCase()
        : ''

  return (
    <div
      style={{
        display: 'flex',
        gap: 13,
        padding: '11px 12px',
        borderRadius: 10,
        background: bg,
        border: `1px solid ${bd}`,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 40, flex: '0 0 auto' }}>
        <span style={{ fontFamily: 'Anton', fontSize: 18, color: minColor }}>{ev.minute}'</span>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: dotColor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {(isGoal || isRed) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'Space Mono',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: isGoal ? 'var(--color-d-bg)' : '#fff',
                background: isGoal ? 'var(--color-d-lime)' : 'var(--color-d-red)',
                padding: '3px 8px',
                borderRadius: 5,
              }}
            >
              {isGoal ? 'GOL' : 'EXPULSÃO'}
            </span>
            <span style={{ fontFamily: 'Space Mono', fontSize: 10, fontWeight: 700, color: 'var(--color-d-ink)' }}>
              {ev.player.toUpperCase()}
            </span>
            <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'var(--color-d-mut)' }}>{teamTag}</span>
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--color-d-ink)', lineHeight: 1.4 }}>{ev.text}</div>
      </div>
    </div>
  )
}

function RightColumn(props: {
  playing: boolean
  finished: boolean
  speed: Speed
  onToggle: () => void
  onRestart: () => void
  onSpeed: (s: Speed) => void
  onSkipToEnd: () => void
  onShowOutcome: (o: OutcomeKind) => void
  outcome: OutcomeKind | null
  penalties?: Penalties
  home: SideTeam
  away: SideTeam
  penaltyHomeCode?: string
  penaltyAwayCode?: string
}) {
  return (
    <div style={{ flex: '2 1 250px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SimulationPanel {...props} />
      {props.finished && props.penalties && (
        <PenaltiesCard
          penalties={props.penalties}
          homeCode={props.penaltyHomeCode!}
          awayCode={props.penaltyAwayCode!}
          home={props.home}
          away={props.away}
        />
      )}
    </div>
  )
}

function SimulationPanel(props: {
  playing: boolean
  finished: boolean
  speed: Speed
  onToggle: () => void
  onRestart: () => void
  onSpeed: (s: Speed) => void
  onSkipToEnd: () => void
  onShowOutcome: (o: OutcomeKind) => void
  outcome: OutcomeKind | null
}) {
  const playLabel = props.finished ? 'PARTIDA ENCERRADA' : props.playing ? '❚❚ PAUSAR' : '▶ CONTINUAR'

  return (
    <div
      style={{
        background: 'var(--color-d-surface)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--color-d-mut)',
          marginBottom: 14,
        }}
      >
        SIMULAÇÃO
      </div>
      {!props.finished ? (
        <button
          onClick={props.onToggle}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: 'var(--color-d-lime)',
            color: 'var(--color-d-bg)',
            border: 'none',
            borderRadius: 11,
            padding: 15,
            fontFamily: 'Anton',
            fontSize: 19,
            letterSpacing: '0.02em',
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          {playLabel}
        </button>
      ) : (
        <button
          onClick={() => props.outcome && props.onShowOutcome(props.outcome)}
          disabled={!props.outcome}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            background: 'var(--color-d-lime)',
            color: 'var(--color-d-bg)',
            border: 'none',
            borderRadius: 11,
            padding: 14,
            fontFamily: 'Anton',
            fontSize: 17,
            letterSpacing: '0.02em',
            cursor: props.outcome ? 'pointer' : 'default',
            marginBottom: 12,
            animation: props.outcome ? 'd26-pulse 2.4s infinite' : 'none',
          }}
        >
          VER DESFECHO →
        </button>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={props.onRestart}
          title="Reiniciar"
          style={{
            flex: '0 0 auto',
            background: 'var(--color-d-surface2)',
            border: '1px solid var(--color-d-line)',
            color: 'var(--color-d-ink)',
            borderRadius: 9,
            padding: '11px 14px',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ↻
        </button>
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: 6,
            background: 'var(--color-d-surface2)',
            border: '1px solid var(--color-d-line)',
            borderRadius: 9,
            padding: 4,
          }}
        >
          {SPEED_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => props.onSpeed(s)}
              style={{
                flex: 1,
                background: props.speed === s ? 'var(--color-d-lime)' : 'transparent',
                color: props.speed === s ? 'var(--color-d-bg)' : 'var(--color-d-mut)',
                border: 'none',
                borderRadius: 6,
                padding: '8px 0',
                fontFamily: 'Space Mono',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {SPEED_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      {!props.finished && (
        <button
          onClick={props.onSkipToEnd}
          style={{
            width: '100%',
            marginTop: 10,
            background: 'transparent',
            border: '1px solid var(--color-d-line)',
            color: 'var(--color-d-mut)',
            borderRadius: 9,
            padding: '9px 0',
            fontFamily: 'Space Mono',
            fontSize: 11,
            letterSpacing: '0.06em',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ⏭ PULAR PRO FIM
        </button>
      )}
    </div>
  )
}

function PenaltiesCard({
  penalties,
  homeCode,
  awayCode,
  home,
  away,
}: {
  penalties: Penalties
  homeCode: string
  awayCode: string
  home: SideTeam
  away: SideTeam
}) {
  const homeKicks = penalties.sequence.filter((s) => s.team === 'home')
  const awayKicks = penalties.sequence.filter((s) => s.team === 'away')
  return (
    <div
      style={{
        background: 'var(--color-d-surface)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--color-d-mut)',
          marginBottom: 12,
        }}
      >
        DECISÃO POR PÊNALTIS
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontFamily: 'Anton', fontSize: 22 }}>
        <span style={{ color: home.isUser ? 'var(--color-d-lime)' : 'var(--color-d-ink)' }}>
          {penalties.homeScored}
        </span>
        <span style={{ color: 'var(--color-d-mut)' }}>—</span>
        <span style={{ color: away.isUser ? 'var(--color-d-lime)' : 'var(--color-d-ink)' }}>
          {penalties.awayScored}
        </span>
      </div>
      <PenRow label={home.isUser ? 'SEU XI' : homeCode.toUpperCase()} kicks={homeKicks} />
      <div style={{ height: 8 }} />
      <PenRow label={away.isUser ? 'SEU XI' : awayCode.toUpperCase()} kicks={awayKicks} />
    </div>
  )
}

function PenRow({ label, kicks }: { label: string; kicks: Penalties['sequence'] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'var(--color-d-mut)', width: 60 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {kicks.map((k, i) => (
          <span
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: k.scored ? 'var(--color-d-lime)' : 'transparent',
              border: `1.5px solid ${k.scored ? 'var(--color-d-lime)' : 'var(--color-d-red)'}`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ---------- Outcome drawer ----------

interface OutcomeConfig {
  kicker: string
  title: string
  titleColor: string
  sub: string
  accent: string
  bannerBg: string
  showCheck: boolean
  emoji: string | null
  ctaLabel: string
  ctaTo: string
  cta2Label?: string
  cta2To?: string
  primaryIsLime: boolean
  champion: boolean
  showShare: boolean
}

function outcomeConfig(kind: OutcomeKind, ctx: OutcomeContext): OutcomeConfig {
  switch (kind) {
    case 'grupo':
      return {
        kicker: ctx.phase,
        title: 'VITÓRIA',
        titleColor: 'var(--color-d-ink)',
        sub: 'Mais três pontos. Falta jogo pra fechar o grupo.',
        accent: 'var(--color-d-lime)',
        bannerBg: 'linear-gradient(180deg, #12160d, #0a0b09)',
        showCheck: true,
        emoji: null,
        ctaLabel: 'VOLTAR PRO GRUPO →',
        ctaTo: '/groups',
        cta2Label: 'VER CHAVEAMENTO',
        cta2To: '/bracket',
        primaryIsLime: true,
        champion: false,
        showShare: true,
      }
    case 'grupo-resultado':
      return {
        kicker: ctx.phase,
        title: 'JOGO ENCERRADO',
        titleColor: 'var(--color-d-ink)',
        sub: 'Ainda falta jogo pra fechar o grupo.',
        accent: 'var(--color-d-mut)',
        bannerBg: 'linear-gradient(180deg, #141613, #0a0b09)',
        showCheck: false,
        emoji: null,
        ctaLabel: 'VOLTAR PRO GRUPO →',
        ctaTo: '/groups',
        primaryIsLime: false,
        champion: false,
        showShare: false,
      }
    case 'classificado':
      return {
        kicker: 'FASE DE GRUPOS · ENCERRADA',
        title: 'CLASSIFICADO',
        titleColor: 'var(--color-d-ink)',
        sub: `${ordinalPt(ctx.extras.userPos ?? 1)} do grupo. Seu XI está no mata-mata.`,
        accent: 'var(--color-d-lime)',
        bannerBg: 'linear-gradient(180deg, #161d0b, #0a0b09)',
        showCheck: true,
        emoji: null,
        ctaLabel: 'IR PRO MATA-MATA →',
        ctaTo: '/bracket',
        cta2Label: 'REVER O GRUPO',
        cta2To: '/groups',
        primaryIsLime: true,
        champion: false,
        showShare: true,
      }
    case 'fora-grupos':
      return {
        kicker: 'COPA 2026 · FIM DE LINHA',
        title: 'ELIMINADO',
        titleColor: 'var(--color-d-ink)',
        sub: 'Seu XI não passou da fase de grupos. Tente de novo.',
        accent: 'var(--color-d-red)',
        bannerBg: 'linear-gradient(180deg, #1a1012, #141613)',
        showCheck: false,
        emoji: '🥀',
        ctaLabel: 'TENTAR DE NOVO →',
        ctaTo: '/draft',
        cta2Label: 'VER CHAVEAMENTO',
        cta2To: '/bracket',
        primaryIsLime: false,
        champion: false,
        showShare: false,
      }
    case 'avancou':
      return {
        kicker: ctx.phase,
        title: ctx.extras.nextRoundLabel ? `NA ${ctx.extras.nextRoundLabel}!` : 'AVANÇOU',
        titleColor: 'var(--color-d-ink)',
        sub: 'Seu XI passou pra próxima fase.',
        accent: 'var(--color-d-lime)',
        bannerBg: 'linear-gradient(180deg, #161d0b, #0a0b09)',
        showCheck: true,
        emoji: null,
        ctaLabel: ctx.extras.nextRoundLabel
          ? `VER ${ctx.extras.nextRoundLabel} →`
          : 'VOLTAR PRO CHAVEAMENTO →',
        ctaTo: '/bracket',
        primaryIsLime: true,
        champion: false,
        showShare: true,
      }
    case 'elim':
      return {
        kicker: ctx.phase,
        title: 'ELIMINADO',
        titleColor: 'var(--color-d-ink)',
        sub: 'Seu time caiu no mata-mata. Quase lá.',
        accent: 'var(--color-d-red)',
        bannerBg: 'linear-gradient(180deg, #1a1012, #141613)',
        showCheck: false,
        emoji: '🥀',
        ctaLabel: 'TENTAR DE NOVO →',
        ctaTo: '/draft',
        cta2Label: 'VER CHAVEAMENTO',
        cta2To: '/bracket',
        primaryIsLime: false,
        champion: false,
        showShare: false,
      }
    case 'champ':
      return {
        kicker: 'COPA 2026 · DECISÃO',
        title: 'CAMPEÃO',
        titleColor: 'var(--color-d-bg)',
        sub: 'Seu time levantou a taça.',
        accent: 'rgba(10,11,9,0.7)',
        bannerBg: 'radial-gradient(130% 100% at 50% 0%, #d4ff3d, #a9d11e)',
        showCheck: false,
        emoji: '🏆',
        ctaLabel: 'JOGAR DE NOVO →',
        ctaTo: '/draft',
        primaryIsLime: true,
        champion: true,
        showShare: false,
      }
  }
}

function ordinalPt(n: number): string {
  if (n === 1) return '1º'
  if (n === 2) return '2º'
  if (n === 3) return '3º'
  return `${n}º`
}

function OutcomeDrawer({
  outcome,
  ctx,
  onClose,
}: {
  outcome: OutcomeKind
  ctx: OutcomeContext
  onClose: () => void
}) {
  const cfg = outcomeConfig(outcome, ctx)
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6,7,5,0.78)',
          backdropFilter: 'blur(4px)',
          zIndex: 30,
          animation: 'd26-fade-in .25s ease',
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
          animation: 'd26-sheet-up .32s cubic-bezier(.2,.9,.3,1)',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 600,
            maxHeight: '92vh',
            overflowY: 'auto',
            background: 'var(--color-d-surface)',
            border: '1px solid var(--color-d-line)',
            borderBottom: 'none',
            borderRadius: '22px 22px 0 0',
            boxShadow: '0 -30px 60px -20px rgba(0,0,0,0.7)',
            pointerEvents: 'auto',
          }}
        >
          <OutcomeBanner cfg={cfg} onClose={onClose} />
          <div style={{ padding: '22px clamp(18px, 5vw, 28px) 30px' }}>
            <ResultChip phase={ctx.phase} result={ctx.resultLine} />
            <TeamChosenCard draft={ctx.draft} />
            <CampaignStatsRow stats={ctx.stats} />
            {ctx.scorers.length > 0 && <ScorersList scorers={ctx.scorers} />}
            {cfg.champion && <ChampionShareBlock resultLine={ctx.resultLine} topScorer={ctx.scorers[0]} />}
            {!cfg.champion && cfg.showShare && <CompactShare />}
            <OutcomeActions cfg={cfg} />
          </div>
        </div>
      </div>
    </>
  )
}

function OutcomeBanner({ cfg, onClose }: { cfg: OutcomeConfig; onClose: () => void }) {
  return (
    <div
      style={{
        padding: '24px clamp(18px, 5vw, 28px) 20px',
        borderBottom: '1px solid var(--color-d-line)',
        background: cfg.bannerBg,
        position: 'relative',
      }}
    >
      <div
        style={{
          width: 44,
          height: 5,
          borderRadius: 5,
          background: 'rgba(255,255,255,0.25)',
          margin: '0 auto 18px',
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid var(--color-d-line)',
          color: 'var(--color-d-ink)',
          borderRadius: 8,
          width: 30,
          height: 30,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
      <div style={{ textAlign: 'center' }}>
        {cfg.showCheck && (
          <div
            style={{
              width: 54,
              height: 54,
              margin: '0 auto 8px',
              borderRadius: '50%',
              background: 'rgba(212,255,61,0.14)',
              border: '1.5px solid var(--color-d-lime)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Anton',
              fontSize: 28,
              color: 'var(--color-d-lime)',
            }}
          >
            ✓
          </div>
        )}
        {cfg.emoji && (
          <div style={{ fontSize: 46, lineHeight: 1, marginBottom: 8 }}>{cfg.emoji}</div>
        )}
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            letterSpacing: '0.18em',
            color: cfg.accent,
            marginBottom: 4,
          }}
        >
          {cfg.kicker}
        </div>
        <h2
          style={{
            fontFamily: 'Anton',
            fontSize: 40,
            margin: 0,
            lineHeight: 0.92,
            color: cfg.titleColor,
          }}
        >
          {cfg.title}
        </h2>
        <div style={{ fontFamily: 'Space Mono', fontSize: 12, color: cfg.champion ? 'rgba(10,11,9,0.6)' : 'var(--color-d-mut)', marginTop: 8 }}>
          {cfg.sub}
        </div>
      </div>
    </div>
  )
}

function ResultChip({ phase, result }: { phase: string; result: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 11,
        padding: '11px 14px',
        marginBottom: 14,
      }}
    >
      <span style={{ fontFamily: 'Space Mono', fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-d-mut)' }}>
        {phase}
      </span>
      <span style={{ fontFamily: 'Anton', fontSize: 18, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
        {result}
      </span>
    </div>
  )
}

function TeamChosenCard({ draft }: { draft: DraftState }) {
  const ovr = Math.round(averageOvr(draft))
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 18,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'var(--color-d-lime)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          color: 'var(--color-d-bg)',
        }}
      >
        ⚄
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Anton', fontSize: 22, lineHeight: 0.95 }}>SEU XI</div>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 10,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.08em',
            marginTop: 2,
          }}
        >
          {draft.formationName.toUpperCase()} · {draft.style.toUpperCase()} · {draft.pickedCountries.length} SELEÇÕES
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'var(--color-d-mut)' }}>OVR</div>
        <div style={{ fontFamily: 'Anton', fontSize: 26, color: 'var(--color-d-lime)' }}>{ovr}</div>
      </div>
    </div>
  )
}

function averageOvr(draft: DraftState): number {
  const players = draft.slots.map((s) => s.player?.player).filter(Boolean) as { overall: number }[]
  if (players.length === 0) return 0
  return players.reduce((a, b) => a + b.overall, 0) / players.length
}

function CampaignStatsRow({ stats }: { stats: CampaignStats }) {
  return (
    <>
      <SectionLabel>CAMPANHA NO TORNEIO</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
        <StatCell label="JOGOS" value={String(stats.jogos)} highlight />
        <StatCell label="V-E-D" value={stats.rec} />
        <StatCell label="GOLS PRÓ" value={String(stats.gols)} highlight />
        <StatCell label="SALDO" value={stats.saldo} />
      </div>
    </>
  )
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      style={{
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 11,
        padding: '13px 8px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'Anton',
          fontSize: 26,
          color: highlight ? 'var(--color-d-lime)' : 'var(--color-d-ink)',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 9,
          color: 'var(--color-d-mut)',
          letterSpacing: '0.06em',
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'Space Mono',
        fontSize: 11,
        letterSpacing: '0.12em',
        color: 'var(--color-d-mut)',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

function ScorersList({ scorers }: { scorers: ScorerRow[] }) {
  const maxG = Math.max(...scorers.map((s) => s.goals), 1)
  return (
    <>
      <SectionLabel>ARTILHEIROS DA EQUIPE</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 8 }}>
        {scorers.map((s, i) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 12px)' }}>
            <div style={{ width: 24, flexShrink: 0, fontFamily: 'Anton', fontSize: 16, color: 'var(--color-d-mut)', textAlign: 'center' }}>
              {i + 1}
            </div>
            <div
              style={{
                width: 30,
                height: 21,
                borderRadius: 4,
                background: gradientFor(s.name),
                flex: '0 0 auto',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
            <div style={{ flex: '1 1 70px', minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </div>
            </div>
            <div
              style={{
                flex: '0 1 120px',
                minWidth: 48,
                height: 8,
                borderRadius: 6,
                background: 'var(--color-d-surface2)',
                overflow: 'hidden',
              }}
            >
              <div style={{ width: `${(s.goals / maxG) * 100}%`, height: '100%', background: 'var(--color-d-lime)' }} />
            </div>
            <div
              style={{
                fontFamily: 'Anton',
                fontSize: 20,
                color: 'var(--color-d-lime)',
                width: 28,
                flexShrink: 0,
                textAlign: 'right',
              }}
            >
              {s.goals}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function ChampionShareBlock({ resultLine, topScorer }: { resultLine: string; topScorer?: ScorerRow }) {
  return (
    <div style={{ marginTop: 22, borderTop: '1px solid var(--color-d-line)', paddingTop: 20 }}>
      <SectionLabel>COMPARTILHE A CONQUISTA</SectionLabel>
      <div
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid rgba(212,255,61,0.3)',
          background:
            'radial-gradient(120% 90% at 80% 0%, rgba(212,255,61,0.16), transparent 60%), #101310',
          padding: 20,
          marginBottom: 14,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: 'var(--color-d-lime)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: 'var(--color-d-bg)',
              }}
            >
              ⚄
            </div>
            <span style={{ fontFamily: 'Anton', fontSize: 16 }}>
              DRAFT <span style={{ fontFamily: 'Space Mono', fontSize: 11, color: 'var(--color-d-lime)', fontWeight: 700 }}>26</span>
            </span>
          </div>
          <span style={{ fontSize: 24 }}>🏆</span>
        </div>
        <div style={{ fontFamily: 'Anton', fontSize: 30, lineHeight: 0.95, marginBottom: 6 }}>
          SEU XI É<br />
          <span style={{ color: 'var(--color-d-lime)' }}>CAMPEÃO DO MUNDO</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, fontFamily: 'Space Mono', fontSize: 11, color: 'var(--color-d-mut)' }}>
          <span>{resultLine}</span>
          {topScorer && (
            <>
              <div style={{ width: 1, height: 24, background: 'var(--color-d-line)' }} />
              <span>
                ARTILHEIRO{' '}
                <b style={{ color: 'var(--color-d-ink)' }}>
                  {topScorer.name.toUpperCase()} · {topScorer.goals}
                </b>
              </span>
            </>
          )}
        </div>
      </div>
      <ShareGrid />
      <button
        style={{
          width: '100%',
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          background: 'var(--color-d-lime)',
          color: 'var(--color-d-bg)',
          border: 'none',
          borderRadius: 11,
          padding: 15,
          fontFamily: 'Anton',
          fontSize: 18,
          letterSpacing: '0.02em',
          cursor: 'pointer',
        }}
      >
        ⬇ BAIXAR CARD DE CAMPEÃO
      </button>
    </div>
  )
}

function CompactShare() {
  return (
    <div style={{ marginTop: 22, borderTop: '1px solid var(--color-d-line)', paddingTop: 18 }}>
      <SectionLabel>COMPARTILHAR</SectionLabel>
      <ShareGrid />
    </div>
  )
}

function ShareGrid() {
  const items = ['𝕏', 'WHATS', 'STORIES', 'COPIAR']
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
      {items.map((label) => (
        <button
          key={label}
          style={{
            background: 'var(--color-d-surface2)',
            border: '1px solid var(--color-d-line)',
            color: 'var(--color-d-ink)',
            borderRadius: 10,
            padding: '13px 0',
            fontFamily: 'Space Mono',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function OutcomeActions({ cfg }: { cfg: OutcomeConfig }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
      <Link
        to={cfg.ctaTo}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: cfg.primaryIsLime ? 'var(--color-d-lime)' : 'var(--color-d-surface2)',
          color: cfg.primaryIsLime ? 'var(--color-d-bg)' : 'var(--color-d-ink)',
          border: `1px solid ${cfg.primaryIsLime ? 'var(--color-d-lime)' : 'var(--color-d-line)'}`,
          borderRadius: 11,
          padding: 15,
          fontFamily: 'Anton',
          fontSize: 17,
          letterSpacing: '0.02em',
          cursor: 'pointer',
        }}
      >
        {cfg.ctaLabel}
      </Link>
      {cfg.cta2Label && cfg.cta2To && (
        <Link
          to={cfg.cta2To}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'transparent',
            color: 'var(--color-d-mut)',
            border: '1px solid var(--color-d-line)',
            borderRadius: 11,
            padding: 12,
            fontFamily: 'Space Mono',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: 'pointer',
          }}
        >
          {cfg.cta2Label}
        </Link>
      )}
    </div>
  )
}
