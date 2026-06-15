/**
 * Preenche o XI automaticamente pra dev — escolhe o melhor jogador compatível
 * para cada slot, respeitando o cooldown de 5 países.
 */
import {
  COUNTRY_COOLDOWN,
  applyRoll,
  eligibleCountries,
  pickPlayer,
  type DraftState,
} from './draft'
import { compatiblePlayers } from './positions'

export function autoFillXI(state: DraftState): DraftState {
  let current = state

  for (let i = 0; i < current.slots.length; i++) {
    if (current.slots[i].player) continue
    const slotPos = current.slots[i].pos

    const pool = eligibleCountries(current)
    if (pool.length === 0) break

    // Score por país: melhor candidato pro slot dentro daquele país,
    // mais a média global de overall (recompensa seleções fortes).
    let bestSquad = pool[0]
    let bestPlayer = null as null | (typeof pool)[number]['players'][number]
    let bestScore = -Infinity

    for (const squad of pool) {
      const candidates = compatiblePlayers(slotPos, squad.players)
      if (candidates.length === 0) continue
      const top = candidates.reduce((a, b) => (b.overall > a.overall ? b : a))
      const score = top.overall + squad.averageOverall * 0.1
      if (score > bestScore) {
        bestScore = score
        bestSquad = squad
        bestPlayer = top
      }
    }

    if (!bestPlayer) {
      // Caiu num slot sem opção em nenhum país elegível — extremamente raro.
      // Avança o cooldown e tenta de novo na próxima volta.
      const fallback = pool[0]
      current = applyRoll(current, fallback.code)
      i--
      continue
    }

    current = applyRoll(current, bestSquad.code)
    current = pickPlayer(current, i, bestPlayer, bestSquad)
  }

  return current
}

/** Detalhe: o número aqui só existe pra o type-check não reclamar. */
void COUNTRY_COOLDOWN
