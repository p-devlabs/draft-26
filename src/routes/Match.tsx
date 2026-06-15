import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import {
  OutcomeDrawer,
  type CampaignStats,
  type OutcomeContext,
  type OutcomeKind,
  type ScorerRow,
} from '../components/match/OutcomeDrawer'
import { Loading, PartidaShell, type SideTeam } from '../components/match/PartidaShell'
import { PenaltiesCard } from '../components/PenaltiesCard'
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
  type WorldCupGroups,
} from '../lib/groups'
import { narrateMatch } from '../lib/narrate'
import {
  loadBracket,
  loadMatchSpeed,
  loadWorldCup,
  saveBracket,
  saveMatchSpeed,
  saveWorldCup,
} from '../lib/persistence'
import { SLOT_LABEL } from '../lib/positions'
import { rosterForKnockout } from '../lib/rosters'
import { track } from '../lib/track'

import type { DraftState, DraftSlot } from '../lib/draft'
import type { MatchEvent } from '../lib/narrate'

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

  if (kind === 'knockout')
    return <KnockoutMatchRunner navigate={navigate} matchId={params.get('id') ?? ''} />
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
        (m) =>
          m.round === round && (m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE),
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
    () =>
      homeTeam
        ? revealed.filter((e) => e.type === 'goal' && e.teamCode === homeTeam.code).length
        : 0,
    [revealed, homeTeam],
  )
  const awayGoals = useMemo(
    () =>
      awayTeam
        ? revealed.filter((e) => e.type === 'goal' && e.teamCode === awayTeam.code).length
        : 0,
    [revealed, awayTeam],
  )

  // SideTeam estável por identidade do *Team — passa pra ScoreboardHero /
  // LancesFeed sem trocar referência a cada tick.
  const home = useMemo<SideTeam | null>(
    () =>
      homeTeam
        ? {
            code: homeTeam.code,
            name: homeTeam.name,
            averageOverall: homeTeam.averageOverall,
            isUser: homeTeam.isUser,
          }
        : null,
    [homeTeam],
  )
  const away = useMemo<SideTeam | null>(
    () =>
      awayTeam
        ? {
            code: awayTeam.code,
            name: awayTeam.name,
            averageOverall: awayTeam.averageOverall,
            isUser: awayTeam.isUser,
          }
        : null,
    [awayTeam],
  )

  const goalEvents = useMemo(() => {
    const finalEvents = finished ? events : revealed
    return finalEvents.filter((e) => e.type === 'goal' || e.type === 'red')
  }, [finished, events, revealed])

  const outcomeContext = useMemo(() => {
    if (!data || !homeTeam || !awayTeam) return null
    return buildGroupOutcomeContext(
      data.worldCup,
      data.draft,
      round,
      homeTeam,
      awayTeam,
      homeGoals,
      awayGoals,
    )
  }, [data, homeTeam, awayTeam, round, homeGoals, awayGoals])

  if (!data || !userMatch || !homeTeam || !awayTeam || !home || !away || !outcomeContext)
    return <Loading />

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
      goalAndRedEvents={goalEvents}
    >
      <LancesFeed events={revealed} home={home} away={away} />
      <RightColumn
        playing={playing}
        finished={finished}
        speed={speed}
        onToggle={onToggle}
        onRestart={onRestart}
        onSpeed={setSpeed}
        onSkipToEnd={onSkipToEnd}
        onShowOutcome={onShowOutcome}
        outcome={outcome}
        home={home}
        away={away}
        draft={data.draft}
        userTeamCode={USER_TEAM_CODE}
        revealedEvents={revealed}
      />
      {outcome && <OutcomeDrawer outcome={outcome} ctx={outcomeContext} onClose={onCloseOutcome} />}
    </PartidaShell>
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
  let jogos = 0,
    w = 0,
    d = 0,
    l = 0,
    gf = 0,
    ga = 0
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
  const [simResult, setSimResult] = useState<{
    events: MatchEvent[]
    extraTime?: { homeGoals: number; awayGoals: number }
    penalties?: Penalties
    winner: 'home' | 'away'
  } | null>(null)
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
    const homeRoster = rosterForKnockout(home.code, persisted.draft, {
      name: home.name,
      flag: home.flag,
    })
    const awayRoster = rosterForKnockout(away.code, persisted.draft, {
      name: away.name,
      flag: away.flag,
    })
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
      ? (userIsHome ? reg.homeGoals : reg.awayGoals) +
        (userIsHome ? extra.homeGoals : extra.awayGoals)
      : 0
    const oppGoals = reg
      ? (userIsHome ? reg.awayGoals : reg.homeGoals) +
        (userIsHome ? extra.awayGoals : extra.homeGoals)
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
    const reg = revealedRegular.filter(
      (e) => e.type === 'goal' && e.teamCode === homeTeam.code,
    ).length
    const extra = inExtraTime ? (simResult?.extraTime?.homeGoals ?? 0) : 0
    return reg + extra
  }, [revealedRegular, homeTeam, inExtraTime, simResult])

  const awayGoals = useMemo(() => {
    if (!awayTeam) return 0
    const reg = revealedRegular.filter(
      (e) => e.type === 'goal' && e.teamCode === awayTeam.code,
    ).length
    const extra = inExtraTime ? (simResult?.extraTime?.awayGoals ?? 0) : 0
    return reg + extra
  }, [revealedRegular, awayTeam, inExtraTime, simResult])

  const home = useMemo<SideTeam | null>(
    () =>
      homeTeam
        ? {
            code: homeTeam.code,
            name: homeTeam.name,
            averageOverall: homeTeam.averageOverall,
            isUser: homeTeam.isUser,
          }
        : null,
    [homeTeam],
  )
  const away = useMemo<SideTeam | null>(
    () =>
      awayTeam
        ? {
            code: awayTeam.code,
            name: awayTeam.name,
            averageOverall: awayTeam.averageOverall,
            isUser: awayTeam.isUser,
          }
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
    return buildKnockoutOutcomeContext(
      bracket,
      stage,
      draft,
      match,
      homeGoals,
      awayGoals,
      simResult?.penalties,
    )
  }, [bracket, stage, draft, match, homeGoals, awayGoals, simResult])

  if (
    !bracket ||
    !simResult ||
    !draft ||
    !stage ||
    !match ||
    !homeTeam ||
    !awayTeam ||
    !home ||
    !away ||
    !outcomeContext
  )
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
      goalAndRedEvents={goalEvents}
    >
      <LancesFeed events={revealed} home={home} away={away} />
      <RightColumn
        playing={playing}
        finished={finalShowing}
        shootoutActive={shootoutActive}
        shootoutKicksRevealed={shootoutKicksRevealed}
        speed={speed}
        onToggle={onToggle}
        onRestart={onRestart}
        onSpeed={setSpeed}
        onSkipToEnd={onSkipToEnd}
        onShowOutcome={onShowOutcome}
        outcome={outcome}
        penalties={regulationEnded ? simResult.penalties : undefined}
        penaltyHomeCode={match.homeCode!}
        penaltyAwayCode={match.awayCode!}
        home={home}
        away={away}
        draft={draft}
        userTeamCode={bracket.userCode}
        revealedEvents={revealed}
      />
      {outcome && <OutcomeDrawer outcome={outcome} ctx={outcomeContext} onClose={onCloseOutcome} />}
    </PartidaShell>
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
  let jogos = 0,
    w = 0,
    d = 0,
    l = 0,
    gf = 0,
    ga = 0
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
  for (const m of bracket.matches) {
    if (!m.result) continue
    if (m.homeCode !== bracket.userCode && m.awayCode !== bracket.userCode) continue
    jogos++
    const userIsHome = m.homeCode === bracket.userCode
    const reg = m.result
    const extra = m.extraTime ?? { homeGoals: 0, awayGoals: 0 }
    const userTotal =
      (userIsHome ? reg.homeGoals : reg.awayGoals) +
      (userIsHome ? extra.homeGoals : extra.awayGoals)
    const oppTotal =
      (userIsHome ? reg.awayGoals : reg.homeGoals) +
      (userIsHome ? extra.awayGoals : extra.homeGoals)
    gf += userTotal
    ga += oppTotal
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
          reversed.map((ev, i) => (
            <LanceRow key={`${ev.minute}-${i}`} ev={ev} home={home} away={away} />
          ))
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
        <span
          style={{
            fontFamily: 'Anton',
            fontSize: ev.label ? 13 : 18,
            color: styling.minColor,
            whiteSpace: 'nowrap',
            letterSpacing: '0.04em',
          }}
        >
          {ev.label ?? `${ev.minute}'`}
        </span>
        <span style={{ fontSize: 14, lineHeight: 1 }}>{styling.emoji}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {styling.chip && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 5,
              flexWrap: 'wrap',
            }}
          >
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
  shootoutKicksRevealed?: number
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
    <div
      style={{ flex: '2 1 250px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <SimulationPanel {...props} />
      {props.penalties && (
        <PenaltiesCard
          penalties={props.penalties}
          kicksRevealed={
            props.shootoutActive
              ? (props.shootoutKicksRevealed ?? 0)
              : props.penalties.sequence.length
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
          <span
            style={{ width: 9, height: 12, borderRadius: 2, background: 'var(--color-d-red)' }}
          />
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
