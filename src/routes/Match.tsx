import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  findTeam,
  playRound,
  USER_TEAM_CODE,
  type GroupMatch,
  type GroupStage,
} from '../lib/groups'
import {
  applyResult,
  findMatch as findKnockoutMatch,
  fullySimulate,
  ROUND_LABEL,
  simulateNonUserRound,
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

type MatchKind = 'group' | 'knockout'

export function Match() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const kind: MatchKind = params.get('kind') === 'knockout' ? 'knockout' : 'group'

  if (kind === 'knockout') return <KnockoutMatchRunner navigate={navigate} matchId={params.get('id') ?? ''} />
  return <GroupMatchRunner navigate={navigate} round={Number(params.get('round')) as 1 | 2 | 3} />
}

function GroupMatchRunner({
  navigate,
  round,
}: {
  navigate: ReturnType<typeof useNavigate>
  round: 1 | 2 | 3
}) {
  const [data, setData] = useState<{ stage: GroupStage; draft: DraftState } | null>(null)
  const [virtualMinute, setVirtualMinute] = useState(0)
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState<Speed>('normal')
  const finishedRef = useRef(false)

  // Carrega + simula a rodada uma vez
  useEffect(() => {
    const persisted = loadStage()
    if (!persisted || !round) {
      navigate('/copa', { replace: true })
      return
    }
    const played = playRound(persisted.stage, round, persisted.draft)
    setData({ stage: played, draft: persisted.draft })
  }, [navigate, round])

  // Timer virtual: 0 → 90 ao longo de SPEED_DURATION[speed]
  useEffect(() => {
    if (!data || !started || paused) return
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
  }, [data, paused, started, speed])

  const userMatch = useMemo(() => {
    if (!data) return null
    return (
      data.stage.matches.find(
        (m) => m.round === round && (m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE),
      ) ?? null
    )
  }, [data, round])

  const parallelMatch = useMemo(() => {
    if (!data) return null
    return (
      data.stage.matches.find(
        (m) => m.round === round && m.homeCode !== USER_TEAM_CODE && m.awayCode !== USER_TEAM_CODE,
      ) ?? null
    )
  }, [data, round])

  // Persiste e volta quando termina
  useEffect(() => {
    if (!data || virtualMinute < 90 || finishedRef.current) return
    finishedRef.current = true
    saveStage(data.draft, data.stage)
  }, [data, virtualMinute])

  if (!data || !userMatch) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-center text-ink-soft">Aquecendo…</div>
  }

  const home = findTeam(data.stage, userMatch.homeCode)!
  const away = findTeam(data.stage, userMatch.awayCode)!
  const wholeMinute = Math.floor(virtualMinute)
  const revealed = (userMatch.events ?? []).filter((e) => e.minute <= wholeMinute)
  const homeGoalsSoFar = revealed.filter((e) => e.type === 'goal' && e.teamCode === home.code).length
  const awayGoalsSoFar = revealed.filter((e) => e.type === 'goal' && e.teamCode === away.code).length
  const finished = virtualMinute >= 90

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-baseline justify-between mb-6">
        <button
          type="button"
          onClick={() => navigate('/copa')}
          className="text-xs text-ink-soft hover:text-ink"
        >
          ← Voltar
        </button>
        <p className="text-xs uppercase tracking-[0.18em] text-clay">
          Grupo {data.stage.letter} · Rodada {round}
        </p>
      </div>

      <div className="border border-rule rounded-lg p-6 mb-6 bg-paper">
        <div className="flex items-center justify-between gap-4">
          <TeamSide team={home} winning={homeGoalsSoFar > awayGoalsSoFar} />
          <div className="text-center">
            <div className="font-display text-6xl text-ink tabular-nums leading-none">
              {homeGoalsSoFar}
              <span className="text-ink-soft text-3xl mx-2">×</span>
              {awayGoalsSoFar}
            </div>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-clay text-paper text-xs font-mono">
              <span className={paused ? '' : 'animate-pulse'}>●</span>
              <span className="tabular-nums">{wholeMinute}'</span>
              {finished && <span className="ml-1">FIM</span>}
            </div>
          </div>
          <TeamSide team={away} winning={awayGoalsSoFar > homeGoalsSoFar} reverse />
        </div>

        {!started && !finished && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <SpeedSelector value={speed} onChange={setSpeed} />
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="h-12 px-8 rounded-md bg-clay text-paper text-sm font-medium hover:bg-ink transition-colors"
            >
              ▶ Iniciar partida
            </button>
          </div>
        )}

        {started && !finished && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center items-center">
            <SpeedSelector value={speed} onChange={setSpeed} compact />
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="text-xs px-3 py-1.5 rounded border border-rule hover:border-ink text-ink-soft hover:text-ink"
            >
              {paused ? '▶ Continuar' : '⏸ Pausar'}
            </button>
            <button
              type="button"
              onClick={() => setVirtualMinute(90)}
              className="text-xs px-3 py-1.5 rounded border border-rule hover:border-ink text-ink-soft hover:text-ink"
            >
              ⏭ Pular pro fim
            </button>
          </div>
        )}
      </div>

      <section>
        <h2 className="font-display text-lg text-ink mb-3">Lances</h2>
        <ul className="space-y-2">
          {[...revealed].reverse().map((e, i) => (
            <EventRow key={`${e.minute}-${i}`} event={e} stage={data.stage} userMatch={userMatch} />
          ))}
          {revealed.length === 0 && (
            <li className="text-sm text-ink-soft italic">Sem grandes acontecimentos ainda…</li>
          )}
        </ul>
      </section>

      {finished && parallelMatch && (
        <section className="mt-8 pt-6 border-t border-rule">
          <p className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-2">
            Outro jogo da rodada
          </p>
          <ParallelResult match={parallelMatch} stage={data.stage} />
        </section>
      )}

      {finished && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/copa')}
            className="h-11 px-6 rounded-md bg-ink text-paper text-sm font-medium hover:bg-clay transition-colors"
          >
            Voltar pra fase de grupos →
          </button>
        </div>
      )}
    </div>
  )
}

function KnockoutMatchRunner({
  navigate,
  matchId,
}: {
  navigate: ReturnType<typeof useNavigate>
  matchId: string
}) {
  const [bracket, setBracket] = useState<KnockoutBracket | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [virtualMinute, setVirtualMinute] = useState(0)
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState<Speed>('normal')
  // Resultado completo da partida (regulamentar + prorrogação + pênaltis)
  const [simResult, setSimResult] = useState<
    | { events: MatchEvent[]; extraTime?: MatchResultLike; penalties?: Penalties; winner: 'home' | 'away' }
    | null
  >(null)
  const persistedRef = useRef(false)

  useEffect(() => {
    const stageData = loadStage()
    const br = loadBracket()
    if (!stageData || !br) {
      navigate('/mata-mata', { replace: true })
      return
    }
    const match = findKnockoutMatch(br, matchId)
    if (!match || !match.homeCode || !match.awayCode) {
      navigate('/mata-mata', { replace: true })
      return
    }
    setDraft(stageData.draft)

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

    // Aplica o resultado no bracket: regulamentar + ET + pks + winnerCode
    const winnerCode = sim.winner === 'home' ? home.code : away.code
    let next = applyResult(br, matchId, {
      result: sim.result,
      extraTime: sim.extraTime,
      penalties: sim.penalties,
      winnerCode,
      events,
    })
    // Simula os outros jogos da mesma rodada (não-user)
    next = simulateNonUserRound(next, match.round)
    setBracket(next)
  }, [matchId, navigate])

  // Timer 0 → 90 (ou 120 se for pra prorrogação) na velocidade escolhida
  useEffect(() => {
    if (!bracket || !simResult || !started || paused) return
    const goalMinute = simResult.extraTime ? 120 : 90
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
  }, [bracket, simResult, started, paused, speed])

  // Persiste apenas quando o relógio termina (depois das pênaltis também)
  const finalShowing = useMemo(() => {
    if (!simResult) return false
    const target = simResult.extraTime ? 120 : 90
    return virtualMinute >= target
  }, [simResult, virtualMinute])

  useEffect(() => {
    if (!bracket || !draft || !finalShowing || persistedRef.current) return
    persistedRef.current = true
    saveBracket(bracket)
  }, [bracket, draft, finalShowing])

  if (!bracket || !simResult || !draft) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-center text-ink-soft">Aquecendo…</div>
  }

  const match = findKnockoutMatch(bracket, matchId)!
  const home = bracket.teams[match.homeCode!]
  const away = bracket.teams[match.awayCode!]
  const wholeMinute = Math.floor(virtualMinute)
  const revealed = simResult.events.filter((e) => e.minute <= Math.min(wholeMinute, 90))
  const homeGoalsSoFar = revealed.filter((e) => e.type === 'goal' && e.teamCode === home.code).length
  const awayGoalsSoFar = revealed.filter((e) => e.type === 'goal' && e.teamCode === away.code).length
  const inExtraTime = wholeMinute > 90
  const extraGoalsHome = inExtraTime ? (simResult.extraTime?.homeGoals ?? 0) : 0
  const extraGoalsAway = inExtraTime ? (simResult.extraTime?.awayGoals ?? 0) : 0
  const totalHomeGoals = homeGoalsSoFar + extraGoalsHome
  const totalAwayGoals = awayGoalsSoFar + extraGoalsAway

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-baseline justify-between mb-6">
        <button
          type="button"
          onClick={() => navigate('/mata-mata')}
          className="text-xs text-ink-soft hover:text-ink"
        >
          ← Voltar
        </button>
        <p className="text-xs uppercase tracking-[0.18em] text-clay">
          {ROUND_LABEL[match.round as KORound]}
        </p>
      </div>

      <div className="border border-rule rounded-lg p-6 mb-6 bg-paper">
        <div className="flex items-center justify-between gap-4">
          <TeamSide
            team={{
              name: home.name,
              flag: home.flag,
              averageOverall: home.averageOverall,
              isUser: home.isUser,
            }}
            winning={totalHomeGoals > totalAwayGoals}
          />
          <div className="text-center">
            <div className="font-display text-6xl text-ink tabular-nums leading-none">
              {totalHomeGoals}
              <span className="text-ink-soft text-3xl mx-2">×</span>
              {totalAwayGoals}
            </div>
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-clay text-paper text-xs font-mono">
              <span className={paused ? '' : 'animate-pulse'}>●</span>
              <span className="tabular-nums">{wholeMinute}'</span>
              {finalShowing && !simResult.penalties && <span className="ml-1">FIM</span>}
              {inExtraTime && !finalShowing && <span className="ml-1">PROR.</span>}
            </div>
          </div>
          <TeamSide
            team={{
              name: away.name,
              flag: away.flag,
              averageOverall: away.averageOverall,
              isUser: away.isUser,
            }}
            winning={totalAwayGoals > totalHomeGoals}
            reverse
          />
        </div>

        {!started && !finalShowing && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <SpeedSelector value={speed} onChange={setSpeed} />
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="h-12 px-8 rounded-md bg-clay text-paper text-sm font-medium hover:bg-ink transition-colors"
            >
              ▶ Iniciar partida
            </button>
          </div>
        )}

        {started && !finalShowing && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center items-center">
            <SpeedSelector value={speed} onChange={setSpeed} compact />
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="text-xs px-3 py-1.5 rounded border border-rule hover:border-ink text-ink-soft hover:text-ink"
            >
              {paused ? '▶ Continuar' : '⏸ Pausar'}
            </button>
            <button
              type="button"
              onClick={() => setVirtualMinute(simResult.extraTime ? 120 : 90)}
              className="text-xs px-3 py-1.5 rounded border border-rule hover:border-ink text-ink-soft hover:text-ink"
            >
              ⏭ Pular pro fim
            </button>
          </div>
        )}
      </div>

      <section>
        <h2 className="font-display text-lg text-ink mb-3">Lances</h2>
        <ul className="space-y-2">
          {[...revealed].reverse().map((e, i) => (
            <KnockoutEventRow key={`${e.minute}-${i}`} event={e} bracket={bracket} matchHomeCode={match.homeCode!} matchAwayCode={match.awayCode!} />
          ))}
          {inExtraTime && (
            <li className="text-sm text-ink-soft italic border-l-2 border-clay pl-3 py-2">
              Prorrogação · {simResult.extraTime!.homeGoals}-{simResult.extraTime!.awayGoals}
            </li>
          )}
          {revealed.length === 0 && !inExtraTime && (
            <li className="text-sm text-ink-soft italic">Sem grandes acontecimentos ainda…</li>
          )}
        </ul>
      </section>

      {finalShowing && simResult.penalties && (
        <PenaltiesPanel penalties={simResult.penalties} home={home} away={away} />
      )}

      {finalShowing && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/mata-mata')}
            className="h-11 px-6 rounded-md bg-ink text-paper text-sm font-medium hover:bg-clay transition-colors"
          >
            Voltar pro chaveamento →
          </button>
        </div>
      )}
    </div>
  )
}

type MatchResultLike = { homeGoals: number; awayGoals: number }

function PenaltiesPanel({
  penalties,
  home,
  away,
}: {
  penalties: Penalties
  home: { code: string; name: string; flag: string }
  away: { code: string; name: string; flag: string }
}) {
  return (
    <section className="mt-6 p-4 border border-clay/40 rounded-lg bg-clay-soft/30">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-[0.14em] text-clay font-medium">
          Decisão por pênaltis
        </span>
        <span className="font-display text-xl tabular-nums text-ink">
          {penalties.homeScored} × {penalties.awayScored}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <PenaltyColumn label={home.flag + ' ' + home.name} side="home" sequence={penalties.sequence} />
        <PenaltyColumn label={away.flag + ' ' + away.name} side="away" sequence={penalties.sequence} />
      </div>
    </section>
  )
}

function PenaltyColumn({
  label,
  side,
  sequence,
}: {
  label: string
  side: 'home' | 'away'
  sequence: Penalties['sequence']
}) {
  const ours = sequence.filter((s) => s.team === side)
  return (
    <div>
      <div className="text-ink-soft mb-2">{label}</div>
      <div className="flex flex-wrap gap-1">
        {ours.map((kick, i) => (
          <span
            key={i}
            className={`w-6 h-6 rounded-full text-xs flex items-center justify-center border ${
              kick.scored
                ? 'bg-moss/20 border-moss text-moss'
                : 'bg-clay/20 border-clay text-clay'
            }`}
            title={`${i + 1}ª cobrança: ${kick.scored ? 'gol' : 'perdeu'}`}
          >
            {kick.scored ? '⚽' : '✗'}
          </span>
        ))}
      </div>
    </div>
  )
}

function KnockoutEventRow({
  event,
  bracket,
  matchHomeCode,
  matchAwayCode,
}: {
  event: MatchEvent
  bracket: KnockoutBracket
  matchHomeCode: string
  matchAwayCode: string
}) {
  const team = bracket.teams[event.teamCode]
  if (!team) return null
  if (event.teamCode !== matchHomeCode && event.teamCode !== matchAwayCode) return null
  const icon = event.type === 'goal' ? '⚽' : event.type === 'yellow' ? '🟨' : '🟥'
  const tone =
    event.type === 'goal'
      ? 'border-l-clay bg-clay-soft/30'
      : event.type === 'red'
        ? 'border-l-clay/60 bg-paper'
        : 'border-l-rule bg-paper'
  return (
    <li className={`border-l-2 ${tone} pl-3 py-2 flex items-start gap-3`}>
      <span className="font-mono text-xs text-ink-soft tabular-nums w-9 pt-0.5">
        {event.minute}'
      </span>
      <span className="text-lg leading-none pt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${event.type === 'goal' ? 'text-ink font-medium' : 'text-ink'}`}>
          {event.text}
        </div>
        <div className="text-[10px] text-ink-soft uppercase tracking-wider">
          {team.flag} {team.isUser ? 'XI' : team.name}
        </div>
      </div>
    </li>
  )
}

function SpeedSelector({
  value,
  onChange,
  compact,
}: {
  value: Speed
  onChange: (s: Speed) => void
  compact?: boolean
}) {
  const opts: { id: Speed; label: string }[] = [
    { id: 'slow', label: 'Lento' },
    { id: 'normal', label: 'Normal' },
    { id: 'fast', label: 'Rápido' },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Velocidade dos lances"
      className={`inline-flex rounded-md border border-rule overflow-hidden ${
        compact ? 'text-xs' : 'text-sm'
      }`}
    >
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`${compact ? 'px-3 py-1.5' : 'px-4 py-2'} transition-colors
            ${value === o.id ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink hover:bg-sand'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function TeamSide({
  team,
  winning,
  reverse,
}: {
  team: { name: string; flag: string; averageOverall: number; isUser: boolean }
  winning: boolean
  reverse?: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 flex-1 ${reverse ? 'flex-row-reverse text-right' : ''}`}
    >
      <span className="text-5xl">{team.flag}</span>
      <div className="min-w-0">
        <div className={`font-display text-lg truncate ${winning ? 'text-ink' : 'text-ink-soft'}`}>
          {team.name}
        </div>
        <div className="text-xs text-ink-soft tabular-nums">OVR {team.averageOverall.toFixed(1)}</div>
      </div>
    </div>
  )
}

function EventRow({
  event,
  stage,
  userMatch,
}: {
  event: MatchEvent
  stage: GroupStage
  userMatch: GroupMatch
}) {
  const team = findTeam(stage, event.teamCode)
  const isUserTeam = event.teamCode === USER_TEAM_CODE
  const isUserMatch =
    event.teamCode === userMatch.homeCode || event.teamCode === userMatch.awayCode
  if (!team || !isUserMatch) return null

  const icon =
    event.type === 'goal' ? '⚽' : event.type === 'yellow' ? '🟨' : '🟥'
  const tone =
    event.type === 'goal'
      ? 'border-l-clay bg-clay-soft/30'
      : event.type === 'red'
        ? 'border-l-clay/60 bg-paper'
        : 'border-l-rule bg-paper'

  return (
    <li className={`border-l-2 ${tone} pl-3 py-2 flex items-start gap-3`}>
      <span className="font-mono text-xs text-ink-soft tabular-nums w-9 pt-0.5">
        {event.minute}'
      </span>
      <span className="text-lg leading-none pt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm ${event.type === 'goal' ? 'text-ink font-medium' : 'text-ink'}`}>
          {event.text}
        </div>
        <div className="text-[10px] text-ink-soft uppercase tracking-wider">
          {team.flag} {isUserTeam ? 'XI' : team.name}
        </div>
      </div>
    </li>
  )
}

function ParallelResult({ match, stage }: { match: GroupMatch; stage: GroupStage }) {
  const home = findTeam(stage, match.homeCode)!
  const away = findTeam(stage, match.awayCode)!
  if (!match.result) return null
  return (
    <div className="flex items-center justify-between gap-3 p-3 border border-rule rounded">
      <div className="flex items-center gap-2 flex-1">
        <span className="text-2xl">{home.flag}</span>
        <span className="text-sm text-ink">{home.name}</span>
      </div>
      <div className="font-display text-xl text-ink tabular-nums">
        {match.result.homeGoals}{' '}
        <span className="text-ink-soft text-base">×</span>{' '}
        {match.result.awayGoals}
      </div>
      <div className="flex items-center gap-2 flex-1 flex-row-reverse">
        <span className="text-2xl">{away.flag}</span>
        <span className="text-sm text-ink">{away.name}</span>
      </div>
    </div>
  )
}
