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
import {
  PENALTY_KICK_MS,
  SPEED_LABEL,
  SPEED_ORDER,
  useSimPlayback,
  type Speed,
} from '../components/match/useSimPlayback'
import { PenaltiesCard } from '../components/PenaltiesCard'
import {
  applyResult,
  ensureRoundsSimulated,
  findMatch as findKnockoutMatch,
  fullySimulate,
  ROUND_LABEL,
  ROUND_ORDER,
  simulatePenalties,
  type BracketMatch,
  type KnockoutBracket,
  type KORound,
  type Penalties,
} from '../lib/bracket'
import { features } from '../lib/features'
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
import { matchPressure } from '../lib/match-pressure'
import { narrateMatch, type MatchEvent } from '../lib/narrate'
import {
  loadBracket,
  loadMatchSpeed,
  loadWorldCup,
  saveBracket,
  saveWorldCup,
} from '../lib/persistence'
import { SLOT_LABEL } from '../lib/positions'
import { rosterForKnockout } from '../lib/rosters'
import { track } from '../lib/track'

import type { DraftSlot, DraftState } from '../lib/draft'

type MatchKind = 'group' | 'knockout'

export function Match() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const kind: MatchKind = params.get('kind') === 'knockout' ? 'knockout' : 'group'

  if (kind === 'knockout') {
    const pParam = params.get('p')
    // Default = 'hero' (card de pênaltis vira subheader do placar). Os
    // outros dois posicionamentos ficam disponíveis via override explícito.
    const penaltyPlacement: 'aside' | 'top' | 'hero' =
      pParam === 'top' ? 'top' : pParam === 'aside' ? 'aside' : 'hero'
    const forceParam = params.get('dev_force')
    const devForce: 'et' | 'pks' | null =
      features.dev && (forceParam === 'et' || forceParam === 'pks') ? forceParam : null
    return (
      <KnockoutMatchRunner
        navigate={navigate}
        matchId={params.get('id') ?? ''}
        penaltyPlacement={penaltyPlacement}
        devForce={devForce}
      />
    )
  }
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
  const {
    virtualMinute,
    wholeMinute,
    playing,
    speed,
    outcome,
    outcomeOpen,
    virtualMinuteRef,
    setVirtualMinute,
    setPlaying,
    setOutcome,
    setSpeed,
    onToggle,
    onCloseOutcome,
    onShowOutcome,
  } = useSimPlayback({
    enabled: data != null,
    totalMinutes: 90,
    onSpeedChange: (from, to) => {
      void track('match_speed_changed', { kind: 'group', round, from, to })
    },
  })
  const persistedRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const skippedRef = useRef(false)
  const wasAlreadyPlayedRef = useRef(false)

  useEffect(() => {
    const persisted = loadWorldCup()
    if (!persisted || !round) {
      navigate('/groups', { replace: true })
      return
    }
    // Checa "já-jogado" ANTES de chamar playRound — depois de simular, o
    // result aparece pra todo mundo e a heurística vira "sempre replay".
    const userGroupBefore = getUserGroup(persisted.worldCup)
    const userMatchBefore = userGroupBefore.matches.find(
      (m) => m.round === round && (m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE),
    )
    const alreadyPlayed = !!userMatchBefore?.result
    // playRound é idempotente — se o user já jogou essa rodada antes
    // (ex: fechou a modal e voltou pra cá), o stage volta inalterado.
    const userGroupAfter = playRound(userGroupBefore, round, persisted.draft)
    const stitched = setUserGroup(persisted.worldCup, userGroupAfter)
    const worldCupAfter = playCpuRound(stitched, round)
    setData({ worldCup: worldCupAfter, stage: userGroupAfter, draft: persisted.draft })
    startedAtRef.current = Date.now()
    if (alreadyPlayed && userMatchBefore) {
      // Já tinha resultado salvo — pula direto pro fim ao invés de obrigar
      // a assistir o jogo de novo (e suprime o re-trigger de
      // match_started/_completed na telemetria).
      wasAlreadyPlayedRef.current = true
      setVirtualMinute(90)
    } else if (userMatchBefore) {
      const userIsHome = userMatchBefore.homeCode === USER_TEAM_CODE
      void track('match_started', {
        kind: 'group',
        round,
        userIsHome,
        oppCode: userIsHome ? userMatchBefore.awayCode : userMatchBefore.homeCode,
        initialSpeed: loadMatchSpeed(),
      })
    }
  }, [navigate, round, setVirtualMinute])

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
    if (wasAlreadyPlayedRef.current) return
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

  // onRestart/onSkipToEnd ainda vivem aqui porque tocam refs locais
  // (persistedRef, skippedRef) — onToggle/onClose/onShow vêm do hook.
  const onRestart = useCallback(() => {
    setVirtualMinute(0)
    setPlaying(true)
    persistedRef.current = false
    setOutcome(null)
  }, [setOutcome, setPlaying, setVirtualMinute])
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
  }, [round, setVirtualMinute, virtualMinuteRef])

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
    return finalEvents.filter((e) => e.type === 'goal')
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
      {outcome && outcomeOpen && (
        <OutcomeDrawer outcome={outcome} ctx={outcomeContext} onClose={onCloseOutcome} />
      )}
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
  penaltyPlacement,
  devForce,
}: {
  navigate: ReturnType<typeof useNavigate>
  matchId: string
  /** Local de render do card de pênaltis: aside (default), main (acima dos lances) ou hero (subheader do scoreboard). Toggle por ?p=top|hero. */
  penaltyPlacement: 'aside' | 'top' | 'hero'
  /** Dev-only: força o desfecho do tempo regulamentar pra cair em ET ou ET+pks. */
  devForce: 'et' | 'pks' | null
}) {
  const [bracket, setBracket] = useState<KnockoutBracket | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [stage, setStage] = useState<GroupStage | null>(null)
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
  /**
   * Fase atualmente exposta na UI. Avança em sequência conforme o relógio
   * cruza 90'/120' — o usuário só descobre que há prorrogação quando o
   * tempo regulamentar acaba empatado, e só descobre pênaltis quando a ET
   * também acabar empatada. Sem isso, a timeline já nasceria com 120'
   * spoilando o desfecho da partida.
   */
  type RevealedPhase = 'regulation' | 'extra-time' | 'penalties' | 'done'
  const [revealedPhase, setRevealedPhase] = useState<RevealedPhase>('regulation')
  const persistedRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)
  const skippedRef = useRef(false)
  const wasAlreadyPlayedRef = useRef(false)

  // totalMinutes do tick segue a fase exposta — 90 enquanto estamos só no
  // regulamentar, 120 a partir do momento em que entramos em ET.
  const goalMinute = revealedPhase === 'regulation' ? 90 : 120
  const {
    virtualMinute,
    wholeMinute,
    playing,
    speed,
    outcome,
    outcomeOpen,
    virtualMinuteRef,
    setVirtualMinute,
    setPlaying,
    setOutcome,
    setSpeed,
    onToggle,
    onCloseOutcome,
    onShowOutcome,
  } = useSimPlayback({
    enabled: bracket != null && simResult != null,
    totalMinutes: goalMinute,
    onSpeedChange: (from, to) => {
      void track('match_speed_changed', { kind: 'knockout', matchId, from, to })
    },
  })

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
    const userIsHome = match.homeCode === br.userCode

    // Se essa partida já foi jogada antes (user fechou a modal e voltou),
    // reaproveita o resultado salvo no bracket ao invés de re-simular — caso
    // contrário a narração e o vencedor mudariam a cada visita.
    if (match.result && match.winnerCode && match.events) {
      wasAlreadyPlayedRef.current = true
      setSimResult({
        events: match.events,
        extraTime: match.extraTime,
        penalties: match.penalties,
        winner: match.winnerCode === home.code ? 'home' : 'away',
      })
      setBracket(br)
      startedAtRef.current = Date.now()
      const fullMinutes = match.extraTime ? 120 : 90
      setVirtualMinute(fullMinutes)
      if (match.penalties) {
        setShootoutKicksRevealed(match.penalties.sequence.length)
      }
      // Sem mistério no replay: já se sabe o desfecho, pula direto pro
      // estado final.
      setRevealedPhase('done')
      return
    }

    // Pressure: fase (R32 +1, R16 +2, QF +3, SF +4, F +5) + tier do
    // adversário (S +3, A +2, B +1). Composição aditiva.
    const opponentCode = userIsHome ? match.awayCode : match.homeCode
    const pressure = matchPressure(match.round, opponentCode)
    const sim = fullySimulate(home, away, Math.random, {
      matchPressure: pressure,
      homeRoster,
      awayRoster,
    })
    // Dev override: força ET (et) ou ET + pênaltis (pks) pra testar UI sem
    // depender do RNG. Sobrescreve só campos relevantes; manter o `winner`
    // determinístico (home como referência) facilita debug.
    if (devForce === 'et' || devForce === 'pks') {
      sim.result = { homeGoals: 1, awayGoals: 1 }
      if (devForce === 'pks') {
        sim.extraTime = { homeGoals: 0, awayGoals: 0 }
        sim.penalties = simulatePenalties(home, away, Math.random, { homeRoster, awayRoster })
        sim.winner = sim.penalties.homeScored >= sim.penalties.awayScored ? 'home' : 'away'
      } else {
        sim.extraTime = { homeGoals: 1, awayGoals: 0 }
        sim.penalties = undefined
        sim.winner = 'home'
      }
    }
    const events = narrateMatch({
      home: homeRoster,
      away: awayRoster,
      result: sim.result,
      extraTime: sim.extraTime,
      hasPenalties: !!sim.penalties,
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
    void track('match_started', {
      kind: 'knockout',
      matchId,
      round: match.round,
      userIsHome,
      oppCode: userIsHome ? match.awayCode : match.homeCode,
      initialSpeed: loadMatchSpeed(),
    })
  }, [matchId, navigate, setVirtualMinute, devForce])

  const totalKicks = simResult?.penalties?.sequence.length ?? 0

  // Avança a fase exposta conforme o relógio cruza os limites de cada etapa.
  // Cada transição amplia o que a UI sabe: chegou em 90' → revela ET (se
  // houver) ou pênaltis (se direto); chegou em 120' → revela pênaltis (se
  // houver) ou encerra; todas as cobranças → encerra.
  useEffect(() => {
    if (!simResult) return
    if (revealedPhase === 'regulation' && virtualMinute >= 90) {
      if (simResult.extraTime) setRevealedPhase('extra-time')
      else if (simResult.penalties) setRevealedPhase('penalties')
      else setRevealedPhase('done')
      return
    }
    if (revealedPhase === 'extra-time' && virtualMinute >= 120) {
      if (simResult.penalties) setRevealedPhase('penalties')
      else setRevealedPhase('done')
    }
  }, [revealedPhase, virtualMinute, simResult])

  useEffect(() => {
    if (revealedPhase !== 'penalties') return
    if (totalKicks > 0 && shootoutKicksRevealed >= totalKicks) {
      setRevealedPhase('done')
    }
  }, [revealedPhase, shootoutKicksRevealed, totalKicks])

  /** Decisão em andamento — cobranças sendo reveladas uma a uma. */
  const shootoutActive = revealedPhase === 'penalties' && shootoutKicksRevealed < totalKicks
  /** "Finished" = tudo encerrado: tempo regulamentar + (se houver) todas as cobranças. */
  const finalShowing = revealedPhase === 'done'

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
    if (wasAlreadyPlayedRef.current) return
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

  // onRestart/onSkipToEnd tocam refs locais e o shootout — mantidos aqui.
  // onToggle/onClose/onShow vêm do hook.
  const onRestart = useCallback(() => {
    setVirtualMinute(0)
    setShootoutKicksRevealed(0)
    setRevealedPhase('regulation')
    setPlaying(true)
    persistedRef.current = false
    setOutcome(null)
  }, [setOutcome, setPlaying, setVirtualMinute])
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
    const finalMinute = simResult?.extraTime ? 120 : 90
    setVirtualMinute(finalMinute)
    if (totalKicks > 0) setShootoutKicksRevealed(totalKicks)
    setRevealedPhase('done')
  }, [bracket, matchId, simResult, totalKicks, setVirtualMinute, virtualMinuteRef])

  const match = bracket ? findKnockoutMatch(bracket, matchId) : null
  const homeTeam = bracket && match?.homeCode ? bracket.teams[match.homeCode] : null
  const awayTeam = bracket && match?.awayCode ? bracket.teams[match.awayCode] : null

  // Derivações dependem de wholeMinute (não virtualMinute) — só recalcula no
  // cruzamento de minuto inteiro. Reveals events até o minuto atual,
  // incluindo eventos de prorrogação (91-120') e marcadores de fase, mas
  // sem ultrapassar o limite revelado pela fase (regulation vê só ≤90,
  // ET vê ≤120, penalties/done vê tudo).
  const phaseCap = revealedPhase === 'regulation' ? 90 : 120
  const revealedRegular = useMemo(() => {
    if (!simResult) return [] as MatchEvent[]
    return simResult.events.filter((e) => e.minute <= Math.min(wholeMinute, phaseCap))
  }, [simResult, wholeMinute, phaseCap])

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

  // Score deriva direto dos eventos revelados — gols de ET agora estão
  // narrados com minutos em [91, 120], então aparecem aqui conforme o
  // relógio cruza cada minuto. (Antes era reg + chunk de ET somado de uma
  // vez, o que dava salto no placar e LANCES vazio.)
  const homeGoals = useMemo(() => {
    if (!homeTeam) return 0
    return revealedRegular.filter((e) => e.type === 'goal' && e.teamCode === homeTeam.code).length
  }, [revealedRegular, homeTeam])

  const awayGoals = useMemo(() => {
    if (!awayTeam) return 0
    return revealedRegular.filter((e) => e.type === 'goal' && e.teamCode === awayTeam.code).length
  }, [revealedRegular, awayTeam])

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
    return source.filter((e) => e.type === 'goal')
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
  // Pênaltis: visível assim que entramos na fase 'penalties' / 'done'.
  const penaltiesVisible =
    (revealedPhase === 'penalties' || revealedPhase === 'done') && !!simResult.penalties
  const penaltiesCard = penaltiesVisible ? (
    <PenaltiesCard
      penalties={simResult.penalties!}
      kicksRevealed={shootoutActive ? shootoutKicksRevealed : simResult.penalties!.sequence.length}
      home={{
        label: home.isUser ? 'SEU XI' : match.homeCode!.toUpperCase(),
        isUser: home.isUser,
      }}
      away={{
        label: away.isUser ? 'SEU XI' : match.awayCode!.toUpperCase(),
        isUser: away.isUser,
      }}
      active={shootoutActive}
    />
  ) : null

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
      belowScoreboard={penaltyPlacement === 'hero' ? penaltiesCard : undefined}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          flex: '5 1 360px',
          minWidth: 0,
        }}
      >
        {penaltyPlacement === 'top' && penaltiesCard}
        <LancesFeed events={revealed} home={home} away={away} />
      </div>
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
        // Card de pênaltis fica no aside só no modo default; nos outros
        // modos vai pro topo do main column (`top`) ou subheader do
        // scoreboard (`hero`).
        penalties={
          penaltyPlacement === 'aside' && penaltiesVisible ? simResult.penalties : undefined
        }
        penaltyHomeCode={match.homeCode!}
        penaltyAwayCode={match.awayCode!}
        home={home}
        away={away}
        draft={draft}
        userTeamCode={bracket.userCode}
        revealedEvents={revealed}
      />
      {outcome && outcomeOpen && (
        <OutcomeDrawer outcome={outcome} ctx={outcomeContext} onClose={onCloseOutcome} />
      )}
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
          GOLS
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
  // Marcador de fase: render minimalista — só uma linha com o texto entre
  // duas réguas, sem chip nem narração nem ícone. Quebra o feed em
  // capítulos cronológicos.
  if (ev.type === 'phase') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 12px',
          color: 'var(--color-d-mut)',
          fontFamily: 'Space Mono',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ flex: 1, height: 1, background: 'var(--color-d-line)' }} />
        <span>{ev.text}</span>
        <span style={{ flex: 1, height: 1, background: 'var(--color-d-line)' }} />
      </div>
    )
  }

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
    // Gol do adversário — tom neutro/cinza pra não tomar atenção visual
    // (a celebração lima fica reservada pros nossos).
    return {
      bg: 'rgba(255,255,255,0.03)',
      bd: 'var(--color-d-line)',
      minColor: 'var(--color-d-mut)',
      emoji: '⚽',
      textColor: 'var(--color-d-mut)',
      nameColor: 'var(--color-d-ink)',
      chip: { label: 'GOL DELES', bg: 'rgba(255,255,255,0.06)', fg: 'var(--color-d-mut)' },
    }
  }
  if (type === 'pen-scored') {
    if (byUser) {
      // Nosso pênalti convertido — celebração lima, chip explícito.
      return {
        bg: 'rgba(212,255,61,0.07)',
        bd: 'rgba(212,255,61,0.3)',
        minColor: 'var(--color-d-lime)',
        emoji: '⚽',
        textColor: 'var(--color-d-ink)',
        nameColor: 'var(--color-d-ink)',
        chip: { label: 'GOL DE PÊNALTI', bg: 'var(--color-d-lime)', fg: 'var(--color-d-bg)' },
      }
    }
    // Pênalti do adversário convertido — tom neutro/cinza pra não competir
    // com a celebração lima nem com a frustração vermelha dos meus erros.
    return {
      bg: 'rgba(255,255,255,0.03)',
      bd: 'var(--color-d-line)',
      minColor: 'var(--color-d-mut)',
      emoji: '⚽',
      textColor: 'var(--color-d-mut)',
      nameColor: 'var(--color-d-ink)',
      chip: { label: 'PÊNALTI DELES', bg: 'rgba(255,255,255,0.06)', fg: 'var(--color-d-mut)' },
    }
  }
  if (type === 'pen-missed') {
    if (byUser) {
      // Nossa cobrança perdida — vermelho destacado, chip "PERDI".
      return {
        bg: 'rgba(255,59,59,0.08)',
        bd: 'rgba(255,59,59,0.3)',
        minColor: 'var(--color-d-red)',
        emoji: '❌',
        textColor: 'var(--color-d-ink)',
        nameColor: 'var(--color-d-ink)',
        chip: { label: 'PERDI', bg: 'var(--color-d-red)', fg: '#fff' },
      }
    }
    // Adversário perdeu — âmbar quente (alívio), chip "DEFENDIDA".
    return {
      bg: 'rgba(255,138,59,0.07)',
      bd: 'rgba(255,138,59,0.3)',
      minColor: 'var(--color-d-warn)',
      emoji: '🧤',
      textColor: 'var(--color-d-ink)',
      nameColor: 'var(--color-d-ink)',
      chip: { label: 'DEFENDIDA', bg: 'rgba(255,138,59,0.22)', fg: 'var(--color-d-warn)' },
    }
  }
  // Fallback — qualquer tipo desconhecido cai numa linha neutra.
  return {
    bg: 'transparent',
    bd: 'var(--color-d-line)',
    minColor: 'var(--color-d-mut)',
    emoji: '·',
    textColor: 'var(--color-d-mut)',
    nameColor: 'var(--color-d-mut)',
    chip: null,
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

/** Ordem de pintura no card — GK em cima, depois DEF/MID/FWD, sem cabeçalhos. */
const POSITION_BUCKET_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }

function bucketOf(slot: DraftSlot): string {
  const b = slot.player?.player.position
  if (b) return b
  if (slot.pos === 'GK') return 'GK'
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(slot.pos)) return 'DEF'
  if (['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(slot.pos)) return 'MID'
  return 'FWD'
}

interface LineupRow {
  shirt: number | null
  name: string
  posLabel: string
  goals: number
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
  // Por-jogador, deriva gols dos eventos já revelados, matching por nome —
  // narrate.ts pesca os atletas direto do roster do user (rosterForKnockout /
  // playRound), então os nomes batem 1:1.
  const rows = useMemo(() => {
    const userEvents = revealedEvents.filter((e) => e.teamCode === userTeamCode)
    const goalsByPlayer = new Map<string, number>()
    for (const ev of userEvents) {
      if (ev.type !== 'goal') continue
      goalsByPlayer.set(ev.player, (goalsByPlayer.get(ev.player) ?? 0) + 1)
    }

    const decorated = draft.slots
      .filter((s) => s.player)
      .map((slot) => ({
        bucketRank: POSITION_BUCKET_ORDER[bucketOf(slot)] ?? 9,
        row: {
          shirt: slot.player!.player.shirt,
          name: slot.player!.player.name,
          posLabel: SLOT_LABEL[slot.pos].toUpperCase(),
          goals: goalsByPlayer.get(slot.player!.player.name) ?? 0,
        } satisfies LineupRow,
      }))
    // Ordem natural do XI: GK → DEF → MID → FWD, sem cabeçalhos de linha.
    decorated.sort((a, b) => a.bucketRank - b.bucketRank)
    return decorated.map((d) => d.row)
  }, [draft, userTeamCode, revealedEvents])

  if (rows.length === 0) return null

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
        </div>
      </div>
      <div style={{ padding: '8px 8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {rows.map((p, i) => (
          <LineupRowItem key={`${p.name}-${i}`} row={p} />
        ))}
      </div>
    </div>
  )
})

function LineupRowItem({ row }: { row: LineupRow }) {
  const accent = row.goals > 0 ? 'var(--color-d-lime)' : 'transparent'
  const rowBg = row.goals > 0 ? 'rgba(212,255,61,0.06)' : 'transparent'
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
            color: 'var(--color-d-ink)',
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
      </div>
    </div>
  )
}
