import { describe, expect, it } from 'vitest'
import {
  COUNTRY_COOLDOWN,
  applyRoll,
  averageOverall,
  createDraft,
  eligibleCountries,
  isComplete,
  pickPlayer,
  rollUntilCompatible,
  setPendingRoll,
  useSkip,
} from './draft'
import { squads } from '../data/squads'
import { seededRng } from './simulate'

describe('createDraft', () => {
  it('inicia state válido pra 4-3-3 easy', () => {
    const state = createDraft('4-3-3', 'equilibrado', 'easy')
    expect(state.slots).toHaveLength(11)
    expect(state.slots.every((s) => !s.player)).toBe(true)
    expect(state.rolledCountries).toEqual([])
    expect(state.pickedCountries).toEqual([])
    expect(state.skipsRemaining).toBe(5)
    expect(state.skipsTotal).toBe(5)
    expect(state.formationName).toBe('4-3-3')
  })

  it('respeita skips por dificuldade', () => {
    expect(createDraft('4-3-3', 'equilibrado', 'easy').skipsRemaining).toBe(5)
    expect(createDraft('4-3-3', 'equilibrado', 'medium').skipsRemaining).toBe(3)
    expect(createDraft('4-3-3', 'equilibrado', 'hard').skipsRemaining).toBe(1)
  })

  it('lança erro pra formação desconhecida', () => {
    expect(() => createDraft('9-9-9', 'equilibrado', 'easy')).toThrow()
  })
})

describe('useSkip', () => {
  it('decrementa o contador', () => {
    const state = createDraft('4-3-3', 'equilibrado', 'easy')
    const after = useSkip(state)
    expect(after.skipsRemaining).toBe(4)
    expect(after.skipsTotal).toBe(5) // não muda
  })

  it('lança quando 0', () => {
    const state = createDraft('4-3-3', 'equilibrado', 'hard')
    const after = useSkip(state)
    expect(after.skipsRemaining).toBe(0)
    expect(() => useSkip(after)).toThrow(/sem skips/)
  })
})

describe('eligibleCountries — cooldown', () => {
  it('exclui as últimas COUNTRY_COOLDOWN seleções sorteadas', () => {
    let state = createDraft('4-3-3', 'equilibrado', 'easy')
    expect(eligibleCountries(state)).toHaveLength(squads.length)

    // Sorteia 5 países distintos
    const sample = squads.slice(0, 5).map((s) => s.code)
    for (const code of sample) state = applyRoll(state, code)

    const eligible = eligibleCountries(state)
    expect(eligible).toHaveLength(squads.length - COUNTRY_COOLDOWN)
    for (const code of sample) {
      expect(eligible.find((s) => s.code === code)).toBeUndefined()
    }
  })

  it('libera a seleção mais antiga quando passa do cooldown', () => {
    let state = createDraft('4-3-3', 'equilibrado', 'easy')
    const sample = squads.slice(0, 7).map((s) => s.code)
    for (const code of sample) state = applyRoll(state, code)

    const eligible = eligibleCountries(state)
    const codes = new Set(eligible.map((s) => s.code))
    // sample[0] e sample[1] foram empurrados pra fora da janela de 5
    expect(codes.has(sample[0])).toBe(true)
    expect(codes.has(sample[1])).toBe(true)
    // últimos 5 ainda em cooldown
    for (let i = 2; i < 7; i++) expect(codes.has(sample[i])).toBe(false)
  })

  it('exclui países já escolhidos (picked)', () => {
    let state = createDraft('4-3-3', 'equilibrado', 'easy')
    const brazil = squads.find((s) => s.code === 'BRA')!
    state = applyRoll(state, brazil.code)
    state = pickPlayer(state, 0, brazil.players[0], brazil)
    const eligible = eligibleCountries(state)
    expect(eligible.find((s) => s.code === 'BRA')).toBeUndefined()
  })
})

describe('rollUntilCompatible', () => {
  it('retorna candidatos compatíveis com o slot', () => {
    const state = createDraft('4-3-3', 'equilibrado', 'easy')
    const rng = seededRng(42)
    // slot 0 do 4-3-3 é GK
    const { squad, candidates } = rollUntilCompatible(state, 0, rng)
    expect(squad).toBeDefined()
    expect(candidates.length).toBeGreaterThan(0)
    for (const p of candidates) {
      expect(p.primaryPosition).toBe('GK')
    }
  })

  it('avança o cooldown a cada tentativa (skipped + final)', () => {
    const state = createDraft('4-3-3', 'equilibrado', 'easy')
    const rng = seededRng(42)
    const { state: after, skipped } = rollUntilCompatible(state, 0, rng)
    expect(after.rolledCountries).toHaveLength(skipped.length + 1)
  })

  it('marca pendingSquadCode no slot pra sobreviver fechar/reabrir', () => {
    const state = createDraft('4-3-3', 'equilibrado', 'easy')
    const rng = seededRng(42)
    const { state: after, squad } = rollUntilCompatible(state, 0, rng)
    expect(after.slots[0].pendingSquadCode).toBe(squad.code)
  })

  it('é reprodutível com mesma seed', () => {
    const s1 = createDraft('4-3-3', 'equilibrado', 'easy')
    const s2 = createDraft('4-3-3', 'equilibrado', 'easy')
    const r1 = rollUntilCompatible(s1, 0, seededRng(123))
    const r2 = rollUntilCompatible(s2, 0, seededRng(123))
    expect(r1.squad.code).toBe(r2.squad.code)
  })
})

describe('pickPlayer', () => {
  it('preenche o slot e registra o país como picked', () => {
    let state = createDraft('4-3-3', 'equilibrado', 'easy')
    const brazil = squads.find((s) => s.code === 'BRA')!
    const gk = brazil.players.find((p) => p.primaryPosition === 'GK')!
    state = pickPlayer(state, 0, gk, brazil)
    expect(state.slots[0].player?.player.name).toBe(gk.name)
    expect(state.slots[0].player?.countryCode).toBe('BRA')
    expect(state.pickedCountries).toContain('BRA')
  })

  it('lança ao picar slot já preenchido', () => {
    let state = createDraft('4-3-3', 'equilibrado', 'easy')
    const brazil = squads.find((s) => s.code === 'BRA')!
    const gk = brazil.players.find((p) => p.primaryPosition === 'GK')!
    state = pickPlayer(state, 0, gk, brazil)
    expect(() => pickPlayer(state, 0, gk, brazil)).toThrow()
  })

  it('limpa pendingSquadCode do slot', () => {
    let state = createDraft('4-3-3', 'equilibrado', 'easy')
    state = setPendingRoll(state, 0, 'BRA')
    const brazil = squads.find((s) => s.code === 'BRA')!
    const gk = brazil.players.find((p) => p.primaryPosition === 'GK')!
    state = pickPlayer(state, 0, gk, brazil)
    expect(state.slots[0].pendingSquadCode).toBeUndefined()
  })
})

describe('isComplete e averageOverall', () => {
  it('isComplete=false quando tem slot vazio', () => {
    const state = createDraft('4-3-3', 'equilibrado', 'easy')
    expect(isComplete(state)).toBe(false)
  })

  it('averageOverall=0 sem picks', () => {
    const state = createDraft('4-3-3', 'equilibrado', 'easy')
    expect(averageOverall(state)).toBe(0)
  })

  it('averageOverall= média dos picks atuais', () => {
    let state = createDraft('4-3-3', 'equilibrado', 'easy')
    const brazil = squads.find((s) => s.code === 'BRA')!
    const gk = brazil.players.find((p) => p.primaryPosition === 'GK')!
    state = pickPlayer(state, 0, gk, brazil)
    expect(averageOverall(state)).toBe(Math.round(gk.overall * 10) / 10)
  })
})
