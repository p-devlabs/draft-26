import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  findTeam,
  playCpuRound,
  playRound,
  setUserGroup,
  standings,
  userFate,
  userGroup as getUserGroup,
  USER_TEAM_CODE,
  type GroupMatch,
  type GroupStage,
  type UserFate,
  type WorldCupGroups,
} from '../lib/groups'
import {
  applyResult,
  findMatch as findKnockoutMatch,
  fullySimulate,
  ROUND_LABEL,
  ROUND_ORDER,
  ensureRoundsSimulated,
  type BracketMatch,
  type KnockoutBracket,
  type KORound,
  type Penalties,
} from '../lib/bracket'
import { rosterForKnockout } from '../lib/rosters'
import { PenaltiesCard } from '../components/PenaltiesCard'
import { narrateMatch } from '../lib/narrate'
import {
  loadBracket,
  loadMatchSpeed,
  loadWorldCup,
  saveBracket,
  saveMatchSpeed,
  saveWorldCup,
} from '../lib/persistence'
import { nationGradient } from '../lib/nation-colors'
import { SLOT_LABEL } from '../lib/positions'
import type { MatchEvent } from '../lib/narrate'
import type { DraftState, DraftSlot } from '../lib/draft'
import { track } from '../lib/track'

type Speed = 'slow' | 'normal' | 'fast'

const SPEED_DURATION: Record<Speed, number> = {
  slow: 60,
  normal: 30,
  fast: 12,
}
const TICK_MS = 60
const SPEED_LABEL: Record<Speed, string> = { slow: '1×', normal: '2×', fast: '4×' }
const SPEED_ORDER: Speed[] = ['slow', 'normal', 'fast']

/**
 * Intervalo entre cobranças do shootout, por velocidade. Cobranças saem
 * "uma a uma" — mais lento que minuto de jogo pra dar tempo de ler quem
 * bateu e o resultado.
 */
const PENALTY_KICK_MS: Record<Speed, number> = {
  slow: 1500,
  normal: 850,
  fast: 380,
}

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
  const [data, setData] = useState<{
    worldCup: WorldCupGroups
    stage: GroupStage
    draft: DraftState
  } | null>(null)
  const [virtualMinute, setVirtualMinute] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, _setSpeed] = useState<Speed>(() => loadMatchSpeed())
  const setSpeed = useCallback(
    (s: Speed) => {
      if (s !== speed) {
        void track('match_speed_changed', { kind: 'group', round, from: speed, to: s })
      }
      saveMatchSpeed(s)
      _setSpeed(s)
    },
    [round, speed],
  )
  const [outcome, setOutcome] = useState<OutcomeKind | null>(null)
  const persistedRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const skippedRef = useRef(false)
  // Espelha virtualMinute num ref pra onSkipToEnd ler o minuto atual sem
  // recriar a callback a cada tick — se virtualMinute fosse dep do useCallback,
  // o memo() do SimulationPanel quebraria a cada 60ms.
  const virtualMinuteRef = useRef(0)
  virtualMinuteRef.current = virtualMinute

  useEffect(() => {
    const persisted = loadWorldCup()
    if (!persisted || !round) {
      navigate('/groups', { replace: true })
      return
    }
    // Simula o jogo do user no grupo dele E simula a mesma rodada nos
    // 11 outros grupos (CPU vs CPU) em lockstep. Idempotente — rodas já
    // jogadas ficam intactas.
    const userGroupAfter = playRound(getUserGroup(persisted.worldCup), round, persisted.draft)
    const stitched = setUserGroup(persisted.worldCup, userGroupAfter)
    const worldCupAfter = playCpuRound(stitched, round)
    setData({ worldCup: worldCupAfter, stage: userGroupAfter, draft: persisted.draft })
    startedAtRef.current = Date.now()
    const userMatchOnEntry = userGroupAfter.matches.find(
      (m) => m.round === round && (m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE),
    )
    if (userMatchOnEntry) {
      const userIsHome = userMatchOnEntry.homeCode === USER_TEAM_CODE
      void track('match_started', {
        kind: 'group',
        round,
        userIsHome,
        oppCode: userIsHome ? userMatchOnEntry.awayCode : userMatchOnEntry.homeCode,
        initialSpeed: loadMatchSpeed(),
      })
    }
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
    saveWorldCup(data.draft, data.worldCup)
    setPlaying(false)
    setOutcome(resolveGroupOutcome(data.worldCup, round))
    const userMatch = data.stage.matches.find(
      (m) => m.round === round && (m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE),
    )
    if (userMatch?.result) {
      const userIsHome = userMatch.homeCode === USER_TEAM_CODE
      const ug = userIsHome ? userMatch.result.homeGoals : userMatch.result.awayGoals
      const og = userIsHome ? userMatch.result.awayGoals : userMatch.result.homeGoals
      void track('match_completed', {
        kind: 'group',
        round,
        userGoals: ug,
        oppGoals: og,
        userResult: ug > og ? 'W' : ug === og ? 'D' : 'L',
        durationMs: startedAtRef.current ? Date.now() - startedAtRef.current : null,
        skippedToResult: skippedRef.current,
        finalSpeed: speed,
      })
    }
  }, [data, virtualMinute, round, speed])

  // Handlers estáveis: passados pra <PartidaShell> e re-encaminhados pros
  // children memoizados (SimulationPanel). Sem useCallback, cada tick criava
  // funções novas e quebrava o memo() lá embaixo.
  const onToggle = useCallback(() => setPlaying((p) => !p), [])
  const onRestart = useCallback(() => {
    setVirtualMinute(0)
    setPlaying(true)
    persistedRef.current = false
    setOutcome(null)
  }, [])
  const onSkipToEnd = useCallback(() => {
    if (!skippedRef.current) {
      skippedRef.current = true
      void track('match_skipped_to_result', {
        kind: 'group',
        round,
        atMinute: Math.floor(virtualMinuteRef.current),
      })
    }
    setVirtualMinute(90)
  }, [round])
  const onCloseOutcome = useCallback(() => setOutcome(null), [])
  const onShowOutcome = useCallback((o: OutcomeKind) => setOutcome(o), [])

  const wholeMinute = Math.floor(virtualMinute)
  const finished = virtualMinute >= 90

  // Derivações por wholeMinute (não por virtualMinute): só mudam quando o
  // relógio cruza um minuto inteiro, e não a cada um dos 60ms ticks.
  const homeTeam = data && userMatch ? findTeam(data.stage, userMatch.homeCode)! : null
  const awayTeam = data && userMatch ? findTeam(data.stage, userMatch.awayCode)! : null
  const events = userMatch?.events ?? []

  const revealed = useMemo(
    () => events.filter((e) => e.minute <= wholeMinute),
    [events, wholeMinute],
  )
  const homeGoals = useMemo(
    () => (homeTeam ? revealed.filter((e) => e.type === 'goal' && e.teamCode === homeTeam.code).length : 0),
    [revealed, homeTeam],
  )
  const awayGoals = useMemo(
    () => (awayTeam ? revealed.filter((e) => e.type === 'goal' && e.teamCode === awayTeam.code).length : 0),
    [revealed, awayTeam],
  )

  // SideTeam estável por identidade do *Team — passa pra ScoreboardHero /
  // LancesFeed sem trocar referência a cada tick.
  const home = useMemo<SideTeam | null>(
    () =>
      homeTeam
        ? { code: homeTeam.code, name: homeTeam.name, averageOverall: homeTeam.averageOverall, isUser: homeTeam.isUser }
        : null,
    [homeTeam],
  )
  const away = useMemo<SideTeam | null>(
    () =>
      awayTeam
        ? { code: awayTeam.code, name: awayTeam.name, averageOverall: awayTeam.averageOverall, isUser: awayTeam.isUser }
        : null,
    [awayTeam],
  )

  const goalEvents = useMemo(() => {
    const finalEvents = finished ? events : revealed
    return finalEvents.filter((e) => e.type === 'goal' || e.type === 'red')
  }, [finished, events, revealed])

  const outcomeContext = useMemo(() => {
    if (!data || !homeTeam || !awayTeam) return null
    return buildGroupOutcomeContext(data.worldCup, data.draft, round, homeTeam, awayTeam, homeGoals, awayGoals)
  }, [data, homeTeam, awayTeam, round, homeGoals, awayGoals])

  if (!data || !userMatch || !homeTeam || !awayTeam || !home || !away || !outcomeContext) return <Loading />

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
      onToggle={onToggle}
      onRestart={onRestart}
      onSpeed={setSpeed}
      onSkipToEnd={onSkipToEnd}
      outcome={outcome}
      outcomeContext={outcomeContext}
      onCloseOutcome={onCloseOutcome}
      onShowOutcome={onShowOutcome}
      draft={data.draft}
      userTeamCode={USER_TEAM_CODE}
    />
  )
}

function resolveGroupOutcome(worldCup: WorldCupGroups, round: 1 | 2 | 3): OutcomeKind {
  const stage = getUserGroup(worldCup)
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
  // round 3 — usa regra Copa 2026 completa (1º, 2º ou 3º entre os 8 melhores)
  return userFate(worldCup).kind.startsWith('qualified') ? 'classificado' : 'fora-grupos'
}

function buildGroupOutcomeContext(
  worldCup: WorldCupGroups,
  draft: DraftState,
  round: 1 | 2 | 3,
  home: ReturnType<typeof findTeam>,
  away: ReturnType<typeof findTeam>,
  homeGoals: number,
  awayGoals: number,
): OutcomeContext {
  const stage = getUserGroup(worldCup)
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
  const oppLabel = opp?.name?.slice(0, 3).toUpperCase() ?? 'OPP'
  // Só no jogo final faz sentido falar de fate (no round 3). Nos outros é
  // só posição parcial.
  const fate = round === 3 ? userFate(worldCup) : null
  return {
    phase: `FASE DE GRUPOS · ${round}/3`,
    resultLine: `SEU XI ${userGoals}–${oppGoals} ${oppLabel}`,
    matchResult: { userGoals, oppGoals, oppLabel },
    draft,
    stats,
    scorers,
    extras: { userPos, fate },
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
  const [speed, _setSpeed] = useState<Speed>(() => loadMatchSpeed())
  const setSpeed = useCallback(
    (s: Speed) => {
      if (s !== speed) {
        void track('match_speed_changed', { kind: 'knockout', matchId, from: speed, to: s })
      }
      saveMatchSpeed(s)
      _setSpeed(s)
    },
    [matchId, speed],
  )
  const [simResult, setSimResult] = useState<
    | { events: MatchEvent[]; extraTime?: { homeGoals: number; awayGoals: number }; penalties?: Penalties; winner: 'home' | 'away' }
    | null
  >(null)
  /**
   * Quantas cobranças do shootout já foram reveladas. Avança automaticamente
   * a cada PENALTY_KICK_MS quando o tempo regulamentar (e ET, se houver)
   * acabou e existe shootout. 0 antes da decisão começar.
   */
  const [shootoutKicksRevealed, setShootoutKicksRevealed] = useState(0)
  const [outcome, setOutcome] = useState<OutcomeKind | null>(null)
  const persistedRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const skippedRef = useRef(false)
  // Ver comentário em GroupMatchRunner: evita recriar onSkipToEnd a cada tick.
  const virtualMinuteRef = useRef(0)
  virtualMinuteRef.current = virtualMinute

  useEffect(() => {
    const persisted = loadWorldCup()
    const br = loadBracket()
    if (!persisted || !br) {
      navigate('/bracket', { replace: true })
      return
    }
    const match = findKnockoutMatch(br, matchId)
    if (!match || !match.homeCode || !match.awayCode) {
      navigate('/bracket', { replace: true })
      return
    }
    setDraft(persisted.draft)
    setStage(getUserGroup(persisted.worldCup))

    const home = br.teams[match.homeCode]
    const away = br.teams[match.awayCode]
    const homeRoster = rosterForKnockout(home.code, persisted.draft, { name: home.name, flag: home.flag })
    const awayRoster = rosterForKnockout(away.code, persisted.draft, { name: away.name, flag: away.flag })
    const sim = fullySimulate(home, away, Math.random, {
      difficulty: persisted.draft.difficulty,
      homeRoster,
      awayRoster,
    })
    const events = narrateMatch({
      home: homeRoster,
      away: awayRoster,
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
    // Avança round-a-round: o lado oposto só evolui depois da rodada do user.
    // Se o user foi eliminado, ensureRoundsSimulated continua até o final
    // pra ter campeão definido.
    next = ensureRoundsSimulated(next)
    setBracket(next)
    startedAtRef.current = Date.now()
    const userIsHome = match.homeCode === br.userCode
    void track('match_started', {
      kind: 'knockout',
      matchId,
      round: match.round,
      userIsHome,
      oppCode: userIsHome ? match.awayCode : match.homeCode,
      initialSpeed: loadMatchSpeed(),
    })
  }, [matchId, navigate])

  const goalMinute = simResult?.extraTime ? 120 : 90
  const regulationEnded = !!simResult && virtualMinute >= goalMinute
  const totalKicks = simResult?.penalties?.sequence.length ?? 0
  /** Decisão em andamento — cobranças sendo reveladas uma a uma. */
  const shootoutActive = regulationEnded && totalKicks > 0 && shootoutKicksRevealed < totalKicks
  /** "Finished" = tudo encerrado: tempo regulamentar + (se houver) todas as cobranças. */
  const finalShowing = regulationEnded && !shootoutActive

  useEffect(() => {
    if (!bracket || !simResult || !playing) return
    if (regulationEnded) return
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
  }, [bracket, simResult, playing, speed, goalMinute, regulationEnded])

  // Timer do shootout: revela uma cobrança por vez no intervalo da velocidade.
  // Para automaticamente quando todas saíram (shootoutActive vira false).
  useEffect(() => {
    if (!shootoutActive || !playing) return
    const id = window.setTimeout(() => {
      setShootoutKicksRevealed((n) => Math.min(n + 1, totalKicks))
    }, PENALTY_KICK_MS[speed])
    return () => window.clearTimeout(id)
  }, [shootoutActive, playing, speed, shootoutKicksRevealed, totalKicks])

  useEffect(() => {
    if (!bracket || !draft || !finalShowing || persistedRef.current) return
    persistedRef.current = true
    saveBracket(bracket)
    setPlaying(false)
    const match = findKnockoutMatch(bracket, matchId)
    if (!match) return
    setOutcome(resolveKnockoutOutcome(bracket, match))
    const userIsHome = match.homeCode === bracket.userCode
    const userWon = match.winnerCode === bracket.userCode
    const reg = match.result
    const extra = match.extraTime ?? { homeGoals: 0, awayGoals: 0 }
    const userGoals = reg
      ? (userIsHome ? reg.homeGoals : reg.awayGoals) + (userIsHome ? extra.homeGoals : extra.awayGoals)
      : 0
    const oppGoals = reg
      ? (userIsHome ? reg.awayGoals : reg.homeGoals) + (userIsHome ? extra.awayGoals : extra.homeGoals)
      : 0
    void track('match_completed', {
      kind: 'knockout',
      matchId,
      round: match.round,
      userGoals,
      oppGoals,
      userResult: userWon ? 'W' : 'L',
      hadExtraTime: !!match.extraTime,
      hadPenalties: !!match.penalties,
      durationMs: startedAtRef.current ? Date.now() - startedAtRef.current : null,
      skippedToResult: skippedRef.current,
      finalSpeed: speed,
    })
  }, [bracket, draft, finalShowing, matchId, speed])

  // Handlers estáveis — passados pros children memoizados via <PartidaShell>.
  const onToggle = useCallback(() => setPlaying((p) => !p), [])
  const onRestart = useCallback(() => {
    setVirtualMinute(0)
    setShootoutKicksRevealed(0)
    setPlaying(true)
    persistedRef.current = false
    setOutcome(null)
  }, [])
  const onSkipToEnd = useCallback(() => {
    if (!skippedRef.current) {
      skippedRef.current = true
      const match = bracket ? findKnockoutMatch(bracket, matchId) : null
      void track('match_skipped_to_result', {
        kind: 'knockout',
        matchId,
        round: match?.round ?? null,
        atMinute: Math.floor(virtualMinuteRef.current),
      })
    }
    // Pula direto pro fim do tempo regulamentar/ET E revela todas as
    // cobranças (se houver). Um clique só → resultado final visível.
    setVirtualMinute(goalMinute)
    if (totalKicks > 0) setShootoutKicksRevealed(totalKicks)
  }, [bracket, matchId, goalMinute, totalKicks])
  const onCloseOutcome = useCallback(() => setOutcome(null), [])
  const onShowOutcome = useCallback((o: OutcomeKind) => setOutcome(o), [])

  const wholeMinute = Math.floor(virtualMinute)
  const inExtraTime = wholeMinute > 90
  const match = bracket ? findKnockoutMatch(bracket, matchId) : null
  const homeTeam = bracket && match?.homeCode ? bracket.teams[match.homeCode] : null
  const awayTeam = bracket && match?.awayCode ? bracket.teams[match.awayCode] : null

  // Derivações dependem de wholeMinute (não virtualMinute) — só recalcula no
  // cruzamento de minuto inteiro.
  const revealedRegular = useMemo(() => {
    if (!simResult) return [] as MatchEvent[]
    return simResult.events.filter((e) => e.minute <= Math.min(wholeMinute, 90))
  }, [simResult, wholeMinute])

  // Cobranças do shootout convertidas em MatchEvents pro feed LANCES, uma
  // a uma conforme shootoutKicksRevealed cresce. Memo separada pra não
  // refazer o filter regulamentar a cada cobrança.
  const penaltyEvents = useMemo<MatchEvent[]>(() => {
    if (!simResult?.penalties || shootoutKicksRevealed === 0) return []
    if (!match?.homeCode || !match?.awayCode) return []
    return penaltyKicksToEvents(
      simResult.penalties.sequence.slice(0, shootoutKicksRevealed),
      match.homeCode,
      match.awayCode,
    )
  }, [simResult, shootoutKicksRevealed, match?.homeCode, match?.awayCode])

  const revealed = useMemo(
    () => [...revealedRegular, ...penaltyEvents],
    [revealedRegular, penaltyEvents],
  )

  const homeGoals = useMemo(() => {
    if (!homeTeam) return 0
    const reg = revealedRegular.filter((e) => e.type === 'goal' && e.teamCode === homeTeam.code).length
    const extra = inExtraTime ? (simResult?.extraTime?.homeGoals ?? 0) : 0
    return reg + extra
  }, [revealedRegular, homeTeam, inExtraTime, simResult])

  const awayGoals = useMemo(() => {
    if (!awayTeam) return 0
    const reg = revealedRegular.filter((e) => e.type === 'goal' && e.teamCode === awayTeam.code).length
    const extra = inExtraTime ? (simResult?.extraTime?.awayGoals ?? 0) : 0
    return reg + extra
  }, [revealedRegular, awayTeam, inExtraTime, simResult])

  const home = useMemo<SideTeam | null>(
    () =>
      homeTeam
        ? { code: homeTeam.code, name: homeTeam.name, averageOverall: homeTeam.averageOverall, isUser: homeTeam.isUser }
        : null,
    [homeTeam],
  )
  const away = useMemo<SideTeam | null>(
    () =>
      awayTeam
        ? { code: awayTeam.code, name: awayTeam.name, averageOverall: awayTeam.averageOverall, isUser: awayTeam.isUser }
        : null,
    [awayTeam],
  )

  const goalEvents = useMemo(() => {
    if (!simResult) return [] as MatchEvent[]
    const source = finalShowing ? simResult.events : revealed
    return source.filter((e) => e.type === 'goal' || e.type === 'red')
  }, [finalShowing, simResult, revealed])

  const outcomeContext = useMemo(() => {
    if (!bracket || !stage || !draft || !match) return null
    return buildKnockoutOutcomeContext(bracket, stage, draft, match, homeGoals, awayGoals, simResult?.penalties)
  }, [bracket, stage, draft, match, homeGoals, awayGoals, simResult])

  if (!bracket || !simResult || !draft || !stage || !match || !homeTeam || !awayTeam || !home || !away || !outcomeContext)
    return <Loading />

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
      shootoutActive={shootoutActive}
      shootoutKicksRevealed={shootoutKicksRevealed}
      events={revealed}
      goalAndRedEvents={goalEvents}
      penalties={regulationEnded ? simResult.penalties : undefined}
      penaltyHomeCode={match.homeCode!}
      penaltyAwayCode={match.awayCode!}
      speed={speed}
      onToggle={onToggle}
      onRestart={onRestart}
      onSpeed={setSpeed}
      onSkipToEnd={onSkipToEnd}
      outcome={outcome}
      outcomeContext={outcomeContext}
      onCloseOutcome={onCloseOutcome}
      onShowOutcome={onShowOutcome}
      draft={draft}
      userTeamCode={bracket.userCode}
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
  const oppLabel = oppTeam?.code ?? 'OPP'
  let resultLine = `SEU XI ${userGoals}–${oppGoals} ${oppLabel}`
  let normalizedPenalties: OutcomeContext['matchResult']['penalties']
  if (penalties) {
    const userP = userIsHome ? penalties.homeScored : penalties.awayScored
    const oppP = userIsHome ? penalties.awayScored : penalties.homeScored
    resultLine += ` (${userP}–${oppP} pen)`
    normalizedPenalties = {
      userScored: userP,
      oppScored: oppP,
      sequence: penalties.sequence.map((k) => ({
        isUser: userIsHome ? k.team === 'home' : k.team === 'away',
        scored: k.scored,
      })),
    }
  }
  return {
    phase: `${roundLabel} · COPA 2026`,
    resultLine,
    matchResult: { userGoals, oppGoals, oppLabel, penalties: normalizedPenalties },
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

const PENALTY_TEXTS_SCORED = [
  '%PLAYER% bateu firme e converteu.',
  '%PLAYER% deslocou o goleiro — gol.',
  '%PLAYER% no canto: bola na rede.',
  '%PLAYER% acertou um cavadinha de mestre.',
]
const PENALTY_TEXTS_MISSED = [
  'O goleiro defendeu! %PLAYER% errou.',
  '%PLAYER% mandou pra fora.',
  '%PLAYER% carimbou a trave.',
  '%PLAYER% bateu mal e o goleiro pegou.',
]

/**
 * Converte as cobranças reveladas do shootout em MatchEvents pro feed
 * "LANCES". Usa `label` pra substituir o "minuto" pelo número da cobrança,
 * e `minute` cresce monotonicamente (200+) só pra manter ordem.
 */
function penaltyKicksToEvents(
  kicks: Penalties['sequence'],
  homeCode: string,
  awayCode: string,
): MatchEvent[] {
  return kicks.map((k, i) => {
    const teamCode = k.team === 'home' ? homeCode : awayCode
    const player = k.kicker ?? 'Batedor'
    const tpl = k.scored
      ? PENALTY_TEXTS_SCORED[i % PENALTY_TEXTS_SCORED.length]
      : PENALTY_TEXTS_MISSED[i % PENALTY_TEXTS_MISSED.length]
    const round = Math.floor(i / 2) + 1
    return {
      minute: 200 + i,
      type: k.scored ? 'pen-scored' : 'pen-missed',
      teamCode,
      player,
      text: tpl.replace('%PLAYER%', player),
      label: `${round}ª`,
    }
  })
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
  matchResult: {
    userGoals: number
    oppGoals: number
    oppLabel: string
    /** Pênaltis (knockout) já normalizados na perspectiva do user. */
    penalties?: {
      userScored: number
      oppScored: number
      /** Cobranças em ordem cronológica — true = converteu. */
      sequence: { isUser: boolean; scored: boolean }[]
    }
  }
  draft: DraftState
  stats: CampaignStats
  scorers: ScorerRow[]
  extras: { userPos?: number; nextRoundLabel?: string | null; fate?: UserFate | null }
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
  /** Tempo regulamentar+ET acabou, mas cobranças ainda saindo uma a uma. */
  shootoutActive?: boolean
  /** Quantas cobranças do shootout já estão visíveis (0 antes de começar). */
  shootoutKicksRevealed?: number
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
  /** XI montado pelo usuário — base do painel "SEU XI EM CAMPO". */
  draft: DraftState
  /** Código do time do user na partida (USER_TEAM_CODE em grupos, bracket.userCode em mata-mata). */
  userTeamCode: string
}

function PartidaShell(p: PartidaShellProps) {
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
        shootoutActive={p.shootoutActive}
        shootoutKicksRevealed={p.shootoutKicksRevealed ?? 0}
        markers={p.goalAndRedEvents}
      />
      <Body>
        <LancesFeed events={p.events} home={p.home} away={p.away} />
        <RightColumn
          playing={p.playing}
          finished={p.finished}
          shootoutActive={p.shootoutActive}
          shootoutKicksRevealed={p.shootoutKicksRevealed ?? 0}
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
          draft={p.draft}
          userTeamCode={p.userTeamCode}
          revealedEvents={p.events}
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
      <span style={{ ...base, fontWeight: 700, background: 'var(--color-d-lime)', color: 'var(--color-d-bg)' }}>
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
  home, away, homeGoals, awayGoals, clockMinute, totalMinutes, playing, finished, shootoutActive, shootoutKicksRevealed, markers,
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
            <ScoreNumber value={homeGoals} isUser={home.isUser} />
            <span style={{ fontFamily: 'Anton', fontSize: 'clamp(22px, 6vw, 34px)', color: 'var(--color-d-mut)' }}>—</span>
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
      <div style={{ ...sizeStyle, background: 'var(--color-d-lime)', fontSize: 'clamp(17px, 4vw, 22px)' }}>⚄</div>
    )
  }
  return (
    <div
      style={{
        ...sizeStyle,
        background: nationGradient(team.code),
        position: 'relative',
        overflow: 'hidden',
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
            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,1) 80%)',
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

// memo: LancesFeed só muda quando entra um evento novo (identidade de `events`
// muda) ou quando o time troca. Os runners agora memoizam `revealed` por
// wholeMinute, então `events` só vira referência nova quando passa de minuto
// inteiro — não a cada tick de 60ms.
const LancesFeed = memo(function LancesFeed({
  events,
  home,
  away,
}: {
  events: MatchEvent[]
  home: SideTeam
  away: SideTeam
}) {
  const reversed = useMemo(() => [...events].reverse(), [events])
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
})

function LanceRow({ ev, home, away }: { ev: MatchEvent; home: SideTeam; away: SideTeam }) {
  const eventIsUser =
    (home.isUser && ev.teamCode === home.code) || (away.isUser && ev.teamCode === away.code)
  const teamTag =
    ev.teamCode === home.code
      ? home.isUser
        ? 'SEU XI'
        : home.code.toUpperCase()
      : ev.teamCode === away.code
        ? away.isUser
          ? 'SEU XI'
          : away.code.toUpperCase()
        : ''

  const styling = lanceStyle(ev.type, eventIsUser)

  return (
    <div
      style={{
        display: 'flex',
        gap: 13,
        padding: '11px 12px',
        borderRadius: 10,
        background: styling.bg,
        border: `1px solid ${styling.bd}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          width: 40,
          flex: '0 0 auto',
        }}
      >
        <span style={{ fontFamily: 'Anton', fontSize: ev.label ? 13 : 18, color: styling.minColor, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
          {ev.label ?? `${ev.minute}'`}
        </span>
        <span style={{ fontSize: 14, lineHeight: 1 }}>{styling.emoji}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {styling.chip && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: 'Space Mono',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: styling.chip.fg,
                background: styling.chip.bg,
                padding: '3px 8px',
                borderRadius: 5,
              }}
            >
              {styling.chip.label}
            </span>
            <span
              style={{
                fontFamily: 'Space Mono',
                fontSize: 10,
                fontWeight: 700,
                color: styling.nameColor,
              }}
            >
              {ev.player.toUpperCase()}
            </span>
            <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'var(--color-d-mut)' }}>
              {teamTag}
            </span>
          </div>
        )}
        <div style={{ fontSize: 13, color: styling.textColor, lineHeight: 1.4 }}>{ev.text}</div>
      </div>
    </div>
  )
}

interface LanceStyle {
  bg: string
  bd: string
  minColor: string
  emoji: string
  textColor: string
  nameColor: string
  chip: { label: string; bg: string; fg: string } | null
}

function lanceStyle(type: MatchEvent['type'], byUser: boolean): LanceStyle {
  if (type === 'goal') {
    if (byUser) {
      // ⚽ gol nosso — celebração lima
      return {
        bg: 'rgba(212,255,61,0.07)',
        bd: 'rgba(212,255,61,0.3)',
        minColor: 'var(--color-d-lime)',
        emoji: '⚽',
        textColor: 'var(--color-d-ink)',
        nameColor: 'var(--color-d-ink)',
        chip: { label: 'GOL', bg: 'var(--color-d-lime)', fg: 'var(--color-d-bg)' },
      }
    }
    // 💔 gol adversário — tom apagado, sem destaque lima
    return {
      bg: 'rgba(255,59,59,0.04)',
      bd: 'rgba(255,59,59,0.18)',
      minColor: 'var(--color-d-red)',
      emoji: '💔',
      textColor: 'var(--color-d-mut)',
      nameColor: 'var(--color-d-mut)',
      chip: { label: 'GOL', bg: 'rgba(255,59,59,0.18)', fg: 'var(--color-d-red)' },
    }
  }
  if (type === 'red') {
    return {
      bg: 'rgba(255,59,59,0.07)',
      bd: 'rgba(255,59,59,0.3)',
      minColor: 'var(--color-d-red)',
      emoji: '🟥',
      textColor: 'var(--color-d-ink)',
      nameColor: 'var(--color-d-ink)',
      chip: { label: 'EXPULSÃO', bg: 'var(--color-d-red)', fg: '#fff' },
    }
  }
  if (type === 'pen-scored') {
    if (byUser) {
      return {
        bg: 'rgba(212,255,61,0.07)',
        bd: 'rgba(212,255,61,0.3)',
        minColor: 'var(--color-d-lime)',
        emoji: '⚽',
        textColor: 'var(--color-d-ink)',
        nameColor: 'var(--color-d-ink)',
        chip: { label: 'PÊNALTI', bg: 'var(--color-d-lime)', fg: 'var(--color-d-bg)' },
      }
    }
    return {
      bg: 'rgba(255,59,59,0.04)',
      bd: 'rgba(255,59,59,0.18)',
      minColor: 'var(--color-d-red)',
      emoji: '⚽',
      textColor: 'var(--color-d-mut)',
      nameColor: 'var(--color-d-mut)',
      chip: { label: 'PÊNALTI', bg: 'rgba(255,59,59,0.18)', fg: 'var(--color-d-red)' },
    }
  }
  if (type === 'pen-missed') {
    if (byUser) {
      // Nossa cobrança perdida — vermelho apagado (frustrante)
      return {
        bg: 'rgba(255,59,59,0.08)',
        bd: 'rgba(255,59,59,0.3)',
        minColor: 'var(--color-d-red)',
        emoji: '🧤',
        textColor: 'var(--color-d-ink)',
        nameColor: 'var(--color-d-ink)',
        chip: { label: 'PERDEU', bg: 'var(--color-d-red)', fg: '#fff' },
      }
    }
    // Adversário perdeu — alívio lima
    return {
      bg: 'rgba(212,255,61,0.06)',
      bd: 'rgba(212,255,61,0.24)',
      minColor: 'var(--color-d-lime)',
      emoji: '🧤',
      textColor: 'var(--color-d-ink)',
      nameColor: 'var(--color-d-ink)',
      chip: { label: 'PERDEU', bg: 'rgba(212,255,61,0.22)', fg: 'var(--color-d-lime)' },
    }
  }
  // yellow
  return {
    bg: 'rgba(255,138,59,0.06)',
    bd: 'rgba(255,138,59,0.22)',
    minColor: 'var(--color-d-warn)',
    emoji: '🟨',
    textColor: 'var(--color-d-ink)',
    nameColor: 'var(--color-d-ink)',
    chip: { label: 'AMARELO', bg: 'rgba(255,138,59,0.18)', fg: 'var(--color-d-warn)' },
  }
}

function RightColumn(props: {
  playing: boolean
  finished: boolean
  shootoutActive?: boolean
  shootoutKicksRevealed: number
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
  draft: DraftState
  userTeamCode: string
  revealedEvents: MatchEvent[]
}) {
  return (
    <div style={{ flex: '2 1 250px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SimulationPanel {...props} />
      {props.penalties && (
        <PenaltiesCard
          penalties={props.penalties}
          kicksRevealed={
            props.shootoutActive ? props.shootoutKicksRevealed : props.penalties.sequence.length
          }
          home={{
            label: props.home.isUser ? 'SEU XI' : props.penaltyHomeCode!.toUpperCase(),
            isUser: props.home.isUser,
          }}
          away={{
            label: props.away.isUser ? 'SEU XI' : props.penaltyAwayCode!.toUpperCase(),
            isUser: props.away.isUser,
          }}
          active={!!props.shootoutActive}
        />
      )}
      <LineupCard
        draft={props.draft}
        userTeamCode={props.userTeamCode}
        revealedEvents={props.revealedEvents}
      />
    </div>
  )
}

// memo: SimulationPanel não depende de virtualMinute — só de playing/finished/
// speed/outcome + callbacks. Com os handlers estáveis (useCallback) lá em cima,
// memo() é eficaz e mata ~1500 re-renders por partida desse painel.
const SimulationPanel = memo(function SimulationPanel(props: {
  playing: boolean
  finished: boolean
  shootoutActive?: boolean
  speed: Speed
  onToggle: () => void
  onRestart: () => void
  onSpeed: (s: Speed) => void
  onSkipToEnd: () => void
  onShowOutcome: (o: OutcomeKind) => void
  outcome: OutcomeKind | null
}) {
  const playLabel = props.finished
    ? 'PARTIDA ENCERRADA'
    : props.shootoutActive
      ? props.playing
        ? '❚❚ PAUSAR COBRANÇAS'
        : '▶ CONTINUAR COBRANÇAS'
      : props.playing
        ? '❚❚ PAUSAR'
        : '▶ CONTINUAR'

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
          aria-label="Reiniciar simulação"
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
          role="radiogroup"
          aria-label="Velocidade da simulação"
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
              role="radio"
              aria-checked={props.speed === s}
              aria-label={`Velocidade ${SPEED_LABEL[s]}`}
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
})


// ---------- Sidebar "SEU XI EM CAMPO" ----------

const LINE_ORDER: { key: 'GOL' | 'DEF' | 'MEI' | 'ATA'; label: string }[] = [
  { key: 'GOL', label: 'GOLEIRO' },
  { key: 'DEF', label: 'DEFESA' },
  { key: 'MEI', label: 'MEIO-CAMPO' },
  { key: 'ATA', label: 'ATAQUE' },
]

function lineKeyOf(slot: DraftSlot): 'GOL' | 'DEF' | 'MEI' | 'ATA' {
  const bucket = slot.player?.player.position
  if (bucket === 'GK') return 'GOL'
  if (bucket === 'DEF') return 'DEF'
  if (bucket === 'MID') return 'MEI'
  if (bucket === 'FWD') return 'ATA'
  // Fallback pelo SlotPosition se o slot não tiver player (caso degenerado).
  if (slot.pos === 'GK') return 'GOL'
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(slot.pos)) return 'DEF'
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(slot.pos)) return 'MEI'
  return 'ATA'
}

interface LineupRow {
  shirt: number | null
  name: string
  posLabel: string
  goals: number
  yellow: boolean
  red: boolean
}

// memo: LineupCard só precisa re-renderizar quando entra um evento novo (i.e.,
// identidade de revealedEvents muda) ou quando o draft muda (não muda durante a
// partida). Com `revealed` memoizado no runner por wholeMinute, esse painel
// para de re-renderizar a cada 60ms.
const LineupCard = memo(function LineupCard({
  draft,
  userTeamCode,
  revealedEvents,
}: {
  draft: DraftState
  userTeamCode: string
  revealedEvents: MatchEvent[]
}) {
  // Por-jogador, deriva gols/amarelo/vermelho dos eventos já revelados,
  // matching por nome — narrate.ts pesca os atletas direto do roster do
  // user (rosterForKnockout / playRound), então os nomes batem 1:1.
  const lines = useMemo(() => {
    const userEvents = revealedEvents.filter((e) => e.teamCode === userTeamCode)
    const byPlayer = new Map<string, { goals: number; yellow: boolean; red: boolean }>()
    for (const ev of userEvents) {
      const cur = byPlayer.get(ev.player) ?? { goals: 0, yellow: false, red: false }
      if (ev.type === 'goal') cur.goals += 1
      if (ev.type === 'yellow') cur.yellow = true
      if (ev.type === 'red') cur.red = true
      byPlayer.set(ev.player, cur)
    }

    const grouped = new Map<'GOL' | 'DEF' | 'MEI' | 'ATA', LineupRow[]>()
    for (const slot of draft.slots) {
      if (!slot.player) continue
      const key = lineKeyOf(slot)
      const player = slot.player.player
      const evs = byPlayer.get(player.name)
      const row: LineupRow = {
        shirt: player.shirt,
        name: player.name,
        posLabel: SLOT_LABEL[slot.pos].toUpperCase(),
        goals: evs?.goals ?? 0,
        yellow: evs?.yellow ?? false,
        red: evs?.red ?? false,
      }
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(row)
    }

    return LINE_ORDER.filter((l) => grouped.has(l.key)).map((l) => ({
      label: l.label,
      players: grouped.get(l.key)!,
    }))
  }, [draft, userTeamCode, revealedEvents])

  if (lines.length === 0) return null

  return (
    <div
      style={{
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
          padding: '14px 16px',
          borderBottom: '1px solid var(--color-d-line)',
        }}
      >
        <div style={{ fontFamily: 'Anton', fontSize: 16 }}>SEU XI EM CAMPO</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'Space Mono',
              fontSize: 9,
              color: 'var(--color-d-mut)',
            }}
          >
            <span style={{ fontSize: 11 }}>⚽</span>GOL
          </span>
          <span style={{ width: 9, height: 12, borderRadius: 2, background: '#f5d11e' }} />
          <span style={{ width: 9, height: 12, borderRadius: 2, background: 'var(--color-d-red)' }} />
        </div>
      </div>
      <div style={{ padding: '4px 8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {lines.map((ln) => (
          <div key={ln.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px 3px' }}>
              <span
                style={{
                  fontFamily: 'Space Mono',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  color: 'var(--color-d-mut)',
                }}
              >
                {ln.label}
              </span>
              <span style={{ flex: 1, height: 1, background: 'var(--color-d-line)' }} />
            </div>
            {ln.players.map((p, i) => (
              <LineupRowItem key={`${p.name}-${i}`} row={p} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
})

function LineupRowItem({ row }: { row: LineupRow }) {
  const accent = row.red
    ? 'var(--color-d-red)'
    : row.goals > 0
      ? 'var(--color-d-lime)'
      : row.yellow
        ? '#f5d11e'
        : 'transparent'
  const rowBg = row.red
    ? 'rgba(255,59,59,0.06)'
    : row.goals > 0
      ? 'rgba(212,255,61,0.06)'
      : row.yellow
        ? 'rgba(245,209,30,0.05)'
        : 'transparent'
  const nameColor = row.red ? 'var(--color-d-mut)' : 'var(--color-d-ink)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 8,
        borderRadius: 9,
        background: rowBg,
        boxShadow: `inset 3px 0 0 ${accent}`,
      }}
    >
      <span
        style={{
          fontFamily: 'Anton',
          fontSize: 15,
          color: 'var(--color-d-mut)',
          width: 22,
          textAlign: 'center',
          flex: '0 0 auto',
        }}
      >
        {row.shirt ?? '·'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: nameColor,
            textDecoration: row.red ? 'line-through' : 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {row.name}
        </div>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 8,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.08em',
          }}
        >
          {row.posLabel}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
        {row.goals > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              background: 'var(--color-d-lime)',
              color: 'var(--color-d-bg)',
              borderRadius: 6,
              padding: '3px 7px',
              fontFamily: 'Space Mono',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            ⚽ {row.goals}
          </span>
        )}
        {row.yellow && (
          <span
            title="Amarelo"
            style={{
              width: 13,
              height: 17,
              borderRadius: 3,
              background: '#f5d11e',
              display: 'inline-block',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          />
        )}
        {row.red && (
          <span
            title="Vermelho"
            style={{
              width: 13,
              height: 17,
              borderRadius: 3,
              background: 'var(--color-d-red)',
              display: 'inline-block',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          />
        )}
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
        sub: classificadoSubMessage(ctx),
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
        sub: foraGruposSubMessage(ctx),
        accent: 'var(--color-d-red)',
        bannerBg: 'linear-gradient(180deg, #1a1012, #141613)',
        showCheck: false,
        emoji: null,
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
        emoji: null,
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

/**
 * Sub-mensagem do drawer "CLASSIFICADO" — varia por destino:
 *   - 1º/2º: "1º do grupo. Seu XI está no mata-mata."
 *   - 3º entre os 8 melhores: "3º do grupo · entre os 8 melhores terceiros."
 */
function classificadoSubMessage(ctx: OutcomeContext): string {
  const fate = ctx.extras.fate
  if (fate?.kind === 'qualified-3rd-rank') {
    return `3º do grupo · entre os 8 melhores terceiros (#${fate.rank} de 12).`
  }
  return `${ordinalPt(ctx.extras.userPos ?? 1)} do grupo. Seu XI está no mata-mata.`
}

/**
 * Sub-mensagem do drawer "ELIMINADO" da fase de grupos — diferencia entre
 * 3º fora dos 8 melhores e 4º colocado puro.
 */
function foraGruposSubMessage(ctx: OutcomeContext): string {
  const fate = ctx.extras.fate
  if (fate?.kind === 'eliminated-3rd-rank') {
    return `3º do grupo, fora dos 8 melhores terceiros (#${fate.rank} de 12). Faltou pouco.`
  }
  if (fate?.kind === 'eliminated-4th') {
    return 'Último do grupo. Seu XI não passou.'
  }
  return 'Seu XI não passou da fase de grupos. Tente de novo.'
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
        aria-hidden="true"
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
          role="dialog"
          aria-modal="true"
          aria-label={cfg.title}
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
            <MatchResultCard phase={ctx.phase} result={ctx.matchResult} />
            <TeamChosenCard draft={ctx.draft} />
            <CampaignStatsRow stats={ctx.stats} />
            {ctx.scorers.length > 0 && <ScorersList scorers={ctx.scorers} />}
            {cfg.champion && <ChampionShareBlock resultLine={ctx.resultLine} topScorer={ctx.scorers[0]} />}
            {!cfg.champion && cfg.showShare && <CompactShare surface={outcome} />}
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
        aria-label="Fechar"
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

function MatchResultCard({
  phase,
  result,
}: {
  phase: string
  result: OutcomeContext['matchResult']
}) {
  const { userGoals, oppGoals, oppLabel, penalties } = result
  const userWon = penalties
    ? penalties.userScored > penalties.oppScored
    : userGoals > oppGoals

  return (
    <div
      style={{
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'var(--color-d-mut)',
          marginBottom: 10,
        }}
      >
        {phase}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            textAlign: 'right',
            fontFamily: 'Anton',
            fontSize: 22,
            color: 'var(--color-d-lime)',
          }}
        >
          SEU XI
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            fontFamily: 'Anton',
            fontSize: 34,
            lineHeight: 1,
          }}
        >
          <span style={{ color: userWon ? 'var(--color-d-lime)' : 'var(--color-d-mut)' }}>
            {userGoals}
          </span>
          <span style={{ fontSize: 22, color: 'var(--color-d-mut)' }}>—</span>
          <span style={{ color: !userWon ? 'var(--color-d-ink)' : 'var(--color-d-mut)' }}>
            {oppGoals}
          </span>
        </div>
        <div
          style={{
            textAlign: 'left',
            fontFamily: 'Anton',
            fontSize: 22,
            color: 'var(--color-d-ink)',
          }}
        >
          {oppLabel}
        </div>
      </div>
      {penalties && <PenaltyDots penalties={penalties} userWon={userWon} />}
    </div>
  )
}

function PenaltyDots({
  penalties,
  userWon,
}: {
  penalties: NonNullable<OutcomeContext['matchResult']['penalties']>
  userWon: boolean
}) {
  const userKicks = penalties.sequence.filter((k) => k.isUser)
  const oppKicks = penalties.sequence.filter((k) => !k.isUser)
  // Slots por lateral: 5 (regulamentar) + 1 por par de morte súbita.
  // Cobranças não-batidas (encerrou cedo) ficam pontilhadas no row.
  const totalSlots = 5 + Math.ceil(Math.max(0, penalties.sequence.length - 10) / 2)
  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 12,
        borderTop: '1px solid var(--color-d-line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'Space Mono',
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'var(--color-d-mut)',
          marginBottom: 8,
        }}
      >
        <span>PÊNALTIS</span>
        <span style={{ fontFamily: 'Anton', fontSize: 16, color: 'var(--color-d-ink)' }}>
          <span style={{ color: userWon ? 'var(--color-d-lime)' : 'var(--color-d-mut)' }}>
            {penalties.userScored}
          </span>
          <span style={{ color: 'var(--color-d-mut)', margin: '0 5px' }}>—</span>
          <span style={{ color: !userWon ? 'var(--color-d-ink)' : 'var(--color-d-mut)' }}>
            {penalties.oppScored}
          </span>
        </span>
      </div>
      <PenaltyRow label="SEU XI" kicks={userKicks} totalSlots={totalSlots} ours scoredColor="var(--color-d-lime)" />
      <div style={{ height: 6 }} />
      <PenaltyRow label="OPP" kicks={oppKicks} totalSlots={totalSlots} scoredColor="var(--color-d-ink)" />
    </div>
  )
}

function PenaltyRow({
  label,
  kicks,
  totalSlots,
  ours,
  scoredColor,
}: {
  label: string
  kicks: NonNullable<OutcomeContext['matchResult']['penalties']>['sequence']
  totalSlots: number
  ours?: boolean
  scoredColor: string
}) {
  const pending = Math.max(0, totalSlots - kicks.length)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: ours ? 'var(--color-d-lime)' : 'var(--color-d-mut)',
          width: 56,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {kicks.map((k, i) => (
          <span
            key={`shot-${i}`}
            title={k.scored ? 'Convertida' : 'Perdida'}
            style={{
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: k.scored ? scoredColor : 'transparent',
              border: `1.5px solid ${k.scored ? scoredColor : 'var(--color-d-mut)'}`,
              opacity: k.scored ? 1 : 0.5,
            }}
          />
        ))}
        {Array.from({ length: pending }).map((_, i) => (
          <span
            key={`pending-${i}`}
            style={{
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: 'transparent',
              border: '1.5px dashed var(--color-d-line)',
              opacity: 0.5,
            }}
          />
        ))}
      </div>
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
      <ShareGrid surface="champion" />
    </div>
  )
}

function CompactShare({ surface }: { surface: string }) {
  return (
    <div style={{ marginTop: 22, borderTop: '1px solid var(--color-d-line)', paddingTop: 18 }}>
      <SectionLabel>COMPARTILHAR</SectionLabel>
      <ShareGrid surface={surface} />
    </div>
  )
}

type ShareMethod = 'x' | 'whats' | 'stories' | 'copy'

// URL canônica de prod — o que viraliza vai pra cá independente de onde o user
// disparou (dev/preview/prod). UTMs fecham o loop de atribuição em session_init.
const SHARE_URL_BASE = 'https://draft-26.pages.dev'

function buildShareUrl(method: ShareMethod, surface: string): string {
  const url = new URL(SHARE_URL_BASE)
  url.searchParams.set('utm_source', 'share')
  url.searchParams.set('utm_medium', method)
  url.searchParams.set('utm_campaign', 'user-share')
  url.searchParams.set('utm_content', surface)
  return url.toString()
}

function buildShareText(surface: string): string {
  switch (surface) {
    case 'champion':
      return '🏆 Meu XI é CAMPEÃO no Draft 26! Simulador da Copa 2026.'
    case 'classificado':
      return 'Classificado no Draft 26 ⚄ Simulador da Copa 2026.'
    case 'avancou':
      return 'Mais uma fase no Draft 26 ⚄ Simulador da Copa 2026.'
    case 'grupo':
      return 'Vitória no grupo no Draft 26 ⚄ Simulador da Copa 2026.'
    default:
      return 'Jogando o Draft 26 ⚄ Simulador da Copa 2026.'
  }
}

async function fireShare(method: ShareMethod, surface: string): Promise<void> {
  void track('share_clicked', { method, surface })
  const url = buildShareUrl(method, surface)
  const text = buildShareText(surface)

  if (method === 'x') {
    const intent = new URL('https://twitter.com/intent/tweet')
    intent.searchParams.set('text', text)
    intent.searchParams.set('url', url)
    window.open(intent.toString(), '_blank', 'noopener,noreferrer')
    return
  }
  if (method === 'whats') {
    const intent = new URL('https://wa.me/')
    intent.searchParams.set('text', `${text} ${url}`)
    window.open(intent.toString(), '_blank', 'noopener,noreferrer')
    return
  }
  if (method === 'stories') {
    // Sem URL direta de IG Stories no web — Web Share API abre o sheet nativo
    // (e o IG aparece nele); em desktop sem suporte, cai pro clipboard.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text, url })
      } catch {
        // cancelou ou bloqueou — silencioso
      }
      return
    }
    await navigator.clipboard.writeText(url)
    return
  }
  await navigator.clipboard.writeText(url)
}

function ShareGrid({ surface }: { surface: string }) {
  const [copied, setCopied] = useState(false)
  const items: { label: string; method: ShareMethod }[] = [
    { label: '𝕏', method: 'x' },
    { label: 'WHATS', method: 'whats' },
    { label: 'STORIES', method: 'stories' },
    { label: copied ? 'COPIADO ✓' : 'COPIAR', method: 'copy' },
  ]

  const handleClick = async (method: ShareMethod) => {
    await fireShare(method, surface)
    if (method === 'copy') {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
      {items.map(({ label, method }) => (
        <button
          key={method}
          onClick={() => void handleClick(method)}
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
