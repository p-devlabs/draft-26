import { describe, expect, it } from 'vitest'
import { compatiblePlayers, isCompatible } from './positions'

describe('isCompatible', () => {
  it('aceita primary igual ao slot', () => {
    expect(isCompatible('LB', 'LB', undefined)).toBe(true)
    expect(isCompatible('GK', 'GK', undefined)).toBe(true)
    expect(isCompatible('ST', 'ST', undefined)).toBe(true)
  })

  it('rejeita primary que não cabe no slot', () => {
    expect(isCompatible('GK', 'CB', undefined)).toBe(false)
    expect(isCompatible('CB', 'ST', undefined)).toBe(false)
    expect(isCompatible('CDM', 'CAM', undefined)).toBe(false)
  })

  describe('bridges no COMPAT (sem precisar de alt no jogador)', () => {
    it('LB ↔ LWB', () => {
      expect(isCompatible('LB', 'LWB', undefined)).toBe(true)
      expect(isCompatible('LWB', 'LB', undefined)).toBe(true)
    })

    it('RB ↔ RWB', () => {
      expect(isCompatible('RB', 'RWB', undefined)).toBe(true)
      expect(isCompatible('RWB', 'RB', undefined)).toBe(true)
    })

    it('LM ↔ LW', () => {
      expect(isCompatible('LM', 'LW', undefined)).toBe(true)
      expect(isCompatible('LW', 'LM', undefined)).toBe(true)
    })

    it('RM ↔ RW', () => {
      expect(isCompatible('RM', 'RW', undefined)).toBe(true)
      expect(isCompatible('RW', 'RM', undefined)).toBe(true)
    })

    it('CF ↔ ST', () => {
      expect(isCompatible('CF', 'ST', undefined)).toBe(true)
      // ST não aceita CF primary (intencional — falso 9 vs centroavante reto)
      expect(isCompatible('ST', 'CF', undefined)).toBe(false)
    })

    it('não tem bridge entre CDM/CM/CAM', () => {
      // versatilidade entre estes precisa vir do dado, não do bridge
      expect(isCompatible('CDM', 'CM', undefined)).toBe(false)
      expect(isCompatible('CAM', 'CM', undefined)).toBe(false)
      expect(isCompatible('CM', 'CDM', undefined)).toBe(false)
    })
  })

  describe('altPositions', () => {
    it('aceita alt no slot quando primary não bate', () => {
      // CB com alt CDM serve num slot CDM
      expect(isCompatible('CDM', 'CB', ['CDM'])).toBe(true)
      // CM com alt CAM serve num slot CAM
      expect(isCompatible('CAM', 'CM', ['CAM'])).toBe(true)
    })

    it('aceita alt via bridge', () => {
      // primary CB, alt LB → cabe em LWB (via bridge LB↔LWB)
      expect(isCompatible('LWB', 'CB', ['LB'])).toBe(true)
    })

    it('rejeita quando nem primary nem alt cabem', () => {
      expect(isCompatible('ST', 'CB', ['CM'])).toBe(false)
    })

    it('alt vazia é equivalente a sem alt', () => {
      expect(isCompatible('CDM', 'CB', [])).toBe(false)
    })
  })
})

describe('compatiblePlayers', () => {
  const squad = [
    { primaryPosition: 'GK', altPositions: [] },
    { primaryPosition: 'CB', altPositions: ['CDM'] },
    { primaryPosition: 'LB', altPositions: [] },
    { primaryPosition: 'CM', altPositions: ['CDM', 'CAM'] },
    { primaryPosition: 'LW', altPositions: ['LM'] },
  ]

  it('filtra por primary', () => {
    const cbs = compatiblePlayers('CB', squad)
    expect(cbs.map((p) => p.primaryPosition)).toEqual(['CB'])
  })

  it('inclui matches via alt', () => {
    const cdms = compatiblePlayers('CDM', squad)
    // CB com alt CDM + CM com alt CDM
    expect(cdms.map((p) => p.primaryPosition)).toEqual(['CB', 'CM'])
  })

  it('inclui matches via bridge', () => {
    // LM aceita LW primary via bridge
    const lms = compatiblePlayers('LM', squad)
    expect(lms.map((p) => p.primaryPosition)).toEqual(['LW'])
  })
})
