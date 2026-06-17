/**
 * Regressão: goleiro não deve marcar. A simulação não modela pênalti no
 * tempo corrido nem cobranças de falta, então qualquer gol de GK só
 * estraga a narrativa (ex.: Mathew Ryan 2x num único jogo).
 */
import { narrateMatch, type NarrationRoster } from './narrate'

import type { Player } from '../data/squads'

function player(name: string, overall = 80): Player {
  return {
    name,
    position: 'FWD',
    primaryPosition: 'ST',
    overall,
    age: 25,
    caps: 0,
  } as Player
}

function gk(name: string, overall = 80): Player {
  return {
    name,
    position: 'GK',
    primaryPosition: 'GK',
    overall,
    age: 25,
    caps: 0,
  } as Player
}

function roster(code: string, name: string, hasGK = true): NarrationRoster {
  return {
    code,
    name,
    flag: '🏳️',
    attackers: [player(`${code} FWD1`), player(`${code} FWD2`)],
    midfielders: [player(`${code} MID1`), player(`${code} MID2`)],
    defenders: [player(`${code} DEF1`), player(`${code} DEF2`)],
    goalkeeper: hasGK ? gk(`${code} GK`) : null,
  }
}

// Mulberry32 — RNG determinístico (mesmo usado em simulate.ts).
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('narrateMatch — escalação de marcadores', () => {
  it('goleiro nunca aparece como marcador, mesmo em milhares de gols', () => {
    const home = roster('BRA', 'Brasil')
    const away = roster('NOR', 'Noruega')
    const gkNames = new Set([home.goalkeeper!.name, away.goalkeeper!.name])

    // 2000 jogos com placares aleatórios — varre todas as seeds possíveis pro
    // pickScorer e elimina a faixa de 1% que causava o bug do Mathew Ryan.
    let totalGoals = 0
    for (let seed = 1; seed <= 2000; seed++) {
      const rng = seededRng(seed)
      const homeGoals = Math.floor(rng() * 5)
      const awayGoals = Math.floor(rng() * 5)
      const events = narrateMatch({ home, away, result: { homeGoals, awayGoals } }, rng)
      for (const e of events) {
        if (e.type === 'goal') {
          totalGoals++
          expect(gkNames.has(e.player)).toBe(false)
        }
      }
    }
    // Sanidade: garante que a varredura realmente gerou gols suficientes.
    expect(totalGoals).toBeGreaterThan(2000)
  })

  it('quando só sobra GK (defesa vazia), o gol degrada pra null, não pra GK', () => {
    // Edge case sintético: roster só com GK. Antes, o else final usava o GK
    // como fallback — agora cai pra atacantes/meio/defesa, e se TODAS as três
    // faixas tiverem 0, retorna null e o gol é silenciado.
    const onlyGK: NarrationRoster = {
      code: 'XXX',
      name: 'XXX',
      flag: '🏳️',
      attackers: [],
      midfielders: [],
      defenders: [],
      goalkeeper: gk('XXX GK'),
    }
    const opponent = roster('YYY', 'YYY')
    const events = narrateMatch(
      { home: onlyGK, away: opponent, result: { homeGoals: 5, awayGoals: 0 } },
      seededRng(42),
    )
    const goals = events.filter((e) => e.type === 'goal')
    for (const g of goals) {
      expect(g.player).not.toBe('XXX GK')
    }
  })
})
