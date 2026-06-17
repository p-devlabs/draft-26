/**
 * Gera eventos minuto-a-minuto pra uma partida cujo placar já foi simulado.
 *
 * Não recalcula o resultado — só distribui os gols e marcadores de fase
 * entre 1' e 90' (regulamentar) ou 91' e 120' (prorrogação).
 */
import type { MatchResult } from './simulate'
import type { Player } from '../data/squads'

export type EventType =
  | 'goal'
  | 'pen-scored'
  | 'pen-missed'
  /** Marcador de fase: kickoff, intervalo, fim de tempo, prorrogação, pênaltis. */
  | 'phase'

export interface MatchEvent {
  minute: number
  type: EventType
  teamCode: string
  player: string
  text: string
  /**
   * Rótulo opcional pra substituir "{minute}'" no feed (ex: "PÊN", "PEN 3").
   * Usado por cobranças do shootout, onde "minuto" não faz sentido.
   */
  label?: string
}

/** Roster mínimo necessário pra narração. */
export interface NarrationRoster {
  code: string
  name: string
  flag: string
  /** Lista de jogadores em ordem ideal de "quem pode marcar". */
  attackers: Player[]
  midfielders: Player[]
  defenders: Player[]
  goalkeeper: Player | null
}

export interface NarrationInput {
  home: NarrationRoster
  away: NarrationRoster
  result: MatchResult
  /** Resultado da prorrogação (se houve). Gols dela são espalhados entre 91' e 120'. */
  extraTime?: { homeGoals: number; awayGoals: number }
  /** Se a partida foi decidida nos pênaltis (pro marcador "INÍCIO DA DISPUTA"). */
  hasPenalties?: boolean
}

/** Identificador semântico de fase pra ancorar o marcador (não vai pra UI). */
export type PhaseMarker =
  | 'kickoff'
  | 'halftime'
  | 'second-half'
  | 'full-time'
  | 'extra-start'
  | 'extra-halftime'
  | 'extra-second-half'
  | 'extra-full-time'
  | 'pen-start'
  | 'final-whistle'

/** Texto exibido por cada marcador, em ordem de minuto. */
const PHASE_LABEL: Record<PhaseMarker, string> = {
  kickoff: 'INÍCIO DO JOGO',
  halftime: 'INTERVALO',
  'second-half': 'INÍCIO DO 2º TEMPO',
  'full-time': 'FIM DO TEMPO REGULAMENTAR',
  'extra-start': 'INÍCIO DA PRORROGAÇÃO',
  'extra-halftime': 'INTERVALO DA PRORROGAÇÃO',
  'extra-second-half': '2º TEMPO DA PRORROGAÇÃO',
  'extra-full-time': 'FIM DA PRORROGAÇÃO',
  'pen-start': 'INÍCIO DA DISPUTA DE PÊNALTIS',
  'final-whistle': 'FIM DE JOGO',
}

const GOAL_NARRATION = [
  '%PLAYER% empurra pra rede!',
  'Gol! %PLAYER% no canto!',
  '%PLAYER% — bola na rede, %TEAM% vibra.',
  '%PLAYER% acerta um chutão e marca!',
  'Cabeçada de %PLAYER%! Goool!',
]

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

function pickScorer(roster: NarrationRoster, rng: () => number): Player | null {
  // pesos: ataque ~60%, meio ~30%, defesa ~10%. Goleiro nunca marca — a
  // simulação não modela pênalti no tempo corrido nem cobranças de falta,
  // então gol de GK só viraria "loucura" narrativa (Mathew Ryan 2x num
  // jogo). Quando uma das faixas tá vazia, cai pra próxima disponível.
  const r = rng()
  let pool: Player[] = []
  if (r < 0.6) pool = roster.attackers
  else if (r < 0.9) pool = roster.midfielders
  else pool = roster.defenders
  if (pool.length === 0) pool = roster.attackers
  if (pool.length === 0) pool = roster.midfielders
  if (pool.length === 0) pool = roster.defenders
  if (pool.length === 0) return null
  // ponderado por overall: jogador melhor tem mais chance
  const weights = pool.map((p) => p.overall)
  const total = weights.reduce((s, w) => s + w, 0)
  let acc = rng() * total
  for (let i = 0; i < pool.length; i++) {
    acc -= weights[i]
    if (acc <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

/** Gera N minutos únicos num intervalo [lo, hi] (inclusivo), ordenados. */
function spreadMinutes(count: number, lo: number, hi: number, rng: () => number): number[] {
  const set = new Set<number>()
  const span = hi - lo + 1
  // Se contagem ≥ span, satura o intervalo. Evita loop infinito.
  const target = Math.min(count, span)
  while (set.size < target) {
    set.add(lo + Math.floor(rng() * span))
  }
  return [...set].sort((a, b) => a - b)
}

function distributeGoals(
  events: MatchEvent[],
  minutes: number[],
  home: NarrationRoster,
  away: NarrationRoster,
  homeGoals: number,
  awayGoals: number,
  rng: () => number,
): void {
  let hLeft = homeGoals
  let aLeft = awayGoals
  for (const min of minutes) {
    if (hLeft + aLeft === 0) break
    const goesHome = (hLeft > 0 && aLeft === 0) || (hLeft > 0 && rng() < hLeft / (hLeft + aLeft))
    const team = goesHome ? home : away
    if (goesHome) hLeft--
    else aLeft--
    const scorer = pickScorer(team, rng)
    if (!scorer) continue
    events.push({
      minute: min,
      type: 'goal',
      teamCode: team.code,
      player: scorer.name,
      text: pick(GOAL_NARRATION, rng).replace('%PLAYER%', scorer.name).replace('%TEAM%', team.name),
    })
  }
}

function phaseEvent(minute: number, marker: PhaseMarker): MatchEvent {
  return {
    minute,
    type: 'phase',
    teamCode: '',
    player: marker,
    text: PHASE_LABEL[marker],
  }
}

export function narrateMatch(input: NarrationInput, rng: () => number = Math.random): MatchEvent[] {
  const events: MatchEvent[] = []

  // ---------- Tempo regulamentar (0–90) ----------
  const regGoals = input.result.homeGoals + input.result.awayGoals
  const regMinutes = spreadMinutes(regGoals, 1, 90, rng)
  distributeGoals(
    events,
    regMinutes,
    input.home,
    input.away,
    input.result.homeGoals,
    input.result.awayGoals,
    rng,
  )

  // ---------- Prorrogação (91–120), se houver ----------
  if (input.extraTime) {
    const etGoals = input.extraTime.homeGoals + input.extraTime.awayGoals
    if (etGoals > 0) {
      const etMinutes = spreadMinutes(etGoals, 91, 120, rng)
      distributeGoals(
        events,
        etMinutes,
        input.home,
        input.away,
        input.extraTime.homeGoals,
        input.extraTime.awayGoals,
        rng,
      )
    }
  }

  // ---------- Marcadores de fase ----------
  // Enxutos: só pontos de inflexão (inicio, intervalo, fim regulamentar,
  // intervalo da ET, fim da ET, fim de jogo). "Início do 2º tempo" sai
  // implícito pelo INTERVALO; idem pra "início da prorrogação" (FIM REG)
  // e "início da disputa de pênaltis" (FIM DA PRORROGAÇÃO + card de pks).
  const hasEt = !!input.extraTime
  events.push(phaseEvent(0, 'kickoff'))
  events.push(phaseEvent(45, 'halftime'))
  if (hasEt) {
    // FIM REG só aparece quando seguido de ET — sem ET, FIM DE JOGO no 90'
    // já cumpre o papel sem duplicar info.
    events.push(phaseEvent(90, 'full-time'))
    events.push(phaseEvent(105, 'extra-halftime'))
    events.push(phaseEvent(120, 'extra-full-time'))
  }
  events.push(phaseEvent(hasEt ? 120 : 90, 'final-whistle'))

  // Ordena por minuto; mantém ordem inserida pra empates (kickoff < halftime
  // < second-half no minuto 45, etc.) usando sort estável.
  return events.sort((a, b) => a.minute - b.minute)
}
