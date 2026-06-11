/**
 * Compartilha a montagem de roster pra narração entre grupos e mata-mata.
 * Para o XI do user usa os 11 escolhidos; para uma seleção usa os top por bucket.
 */
import { squads, type Player } from '../data/squads'
import { USER_TEAM_CODE } from './groups'
import type { DraftState } from './draft'
import type { NarrationRoster } from './narrate'

export function rosterForKnockout(
  code: string,
  draft: DraftState,
  fallback: { name: string; flag: string },
): NarrationRoster {
  if (code === USER_TEAM_CODE) {
    const players = draft.slots.map((s) => s.player!.player).filter(Boolean)
    return {
      code,
      name: fallback.name,
      flag: fallback.flag,
      goalkeeper: players.find((p) => p.position === 'GK') ?? null,
      defenders: players.filter((p) => p.position === 'DEF'),
      midfielders: players.filter((p) => p.position === 'MID'),
      attackers: players.filter((p) => p.position === 'FWD'),
    }
  }
  const squad = squads.find((s) => s.code === code)
  if (!squad) {
    return {
      code,
      name: fallback.name,
      flag: fallback.flag,
      goalkeeper: null,
      defenders: [],
      midfielders: [],
      attackers: [],
    }
  }
  const byPos = (pos: Player['position']) =>
    squad.players.filter((p) => p.position === pos).sort((a, b) => b.overall - a.overall)
  return {
    code,
    name: squad.country,
    flag: squad.flag,
    goalkeeper: byPos('GK')[0] ?? null,
    defenders: byPos('DEF').slice(0, 4),
    midfielders: byPos('MID').slice(0, 4),
    attackers: byPos('FWD').slice(0, 3),
  }
}
