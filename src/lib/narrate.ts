/**
 * Gera eventos minuto-a-minuto pra uma partida cujo placar já foi simulado.
 *
 * Não recalcula o resultado — só distribui os gols, cartões e narração
 * entre 1' e 90'.
 */
import type { MatchResult } from './simulate'
import type { Player } from '../data/squads'

export type EventType = 'goal' | 'pen-scored' | 'pen-missed'

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
  // pesos: ataque 60%, meio 30%, defesa 9%, goleiro 1%
  const r = rng()
  let pool: Player[]
  if (r < 0.6 && roster.attackers.length) pool = roster.attackers
  else if (r < 0.9 && roster.midfielders.length) pool = roster.midfielders
  else if (r < 0.99 && roster.defenders.length) pool = roster.defenders
  else pool = roster.goalkeeper ? [roster.goalkeeper] : roster.attackers
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

/** Gera N minutos únicos no range [1, 90], ordenados. */
function spreadMinutes(count: number, rng: () => number): number[] {
  const set = new Set<number>()
  while (set.size < count) {
    set.add(1 + Math.floor(rng() * 90))
  }
  return [...set].sort((a, b) => a - b)
}

export function narrateMatch(input: NarrationInput, rng: () => number = Math.random): MatchEvent[] {
  const events: MatchEvent[] = []
  const totalGoals = input.result.homeGoals + input.result.awayGoals

  // Minutos exclusivos só pra gols — narração não cobre cartões.
  const minutes = spreadMinutes(totalGoals, rng)

  // Distribui os gols seguindo a ordem cronológica
  let hLeft = input.result.homeGoals
  let aLeft = input.result.awayGoals
  for (const min of minutes) {
    const goesHome = (hLeft > 0 && aLeft === 0) || (hLeft > 0 && rng() < hLeft / (hLeft + aLeft))
    const team = goesHome ? input.home : input.away
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

  return events.sort((a, b) => a.minute - b.minute)
}
