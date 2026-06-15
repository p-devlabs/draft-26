/**
 * Tests dos helpers puros do sistema de ads. Cobre:
 *   - isSlotEnabled: master switch, IAP, kill switch granular, formato.
 *   - shouldShowInterstitial: cooldown, frequência, slot-type, slot-enabled.
 *   - record helpers preservam o resto do state.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ADS_CONFIG,
  INITIAL_SESSION_STATE,
  isSlotEnabled,
  recordInterstitialShown,
  recordTransitionSkipped,
  shouldShowInterstitial,
  type AdsConfig,
} from './ads'

const NOW = 1_000_000_000

describe('isSlotEnabled', () => {
  it('master switch desliga tudo, inclusive rewarded', () => {
    const cfg: AdsConfig = { ...DEFAULT_ADS_CONFIG, enabled: false }
    expect(isSlotEnabled('rewarded-skip', cfg)).toBe(false)
    expect(isSlotEnabled('grupos-footer', cfg)).toBe(false)
    expect(isSlotEnabled('transition-ko-round', cfg)).toBe(false)
  })

  it('IAP "remover ads" desliga banner+interstitial mas mantém rewarded', () => {
    const cfg: AdsConfig = { ...DEFAULT_ADS_CONFIG, removeAdsPurchased: true }
    expect(isSlotEnabled('grupos-footer', cfg)).toBe(false)
    expect(isSlotEnabled('grupos-leaderboard', cfg)).toBe(false)
    expect(isSlotEnabled('transition-ko-round', cfg)).toBe(false)
    expect(isSlotEnabled('rewarded-skip', cfg)).toBe(true)
    expect(isSlotEnabled('rewarded-replay', cfg)).toBe(true)
  })

  it('slot-level kill switch funciona granular sem afetar outros', () => {
    const cfg: AdsConfig = {
      ...DEFAULT_ADS_CONFIG,
      slots: { ...DEFAULT_ADS_CONFIG.slots, 'grupos-footer': false },
    }
    expect(isSlotEnabled('grupos-footer', cfg)).toBe(false)
    expect(isSlotEnabled('grupos-leaderboard', cfg)).toBe(true)
    expect(isSlotEnabled('rewarded-skip', cfg)).toBe(true)
  })
})

describe('shouldShowInterstitial', () => {
  it('só responde true pra slots de tipo interstitial', () => {
    expect(
      shouldShowInterstitial('grupos-footer', INITIAL_SESSION_STATE, DEFAULT_ADS_CONFIG, NOW),
    ).toBe(false)
    expect(
      shouldShowInterstitial('rewarded-skip', INITIAL_SESSION_STATE, DEFAULT_ADS_CONFIG, NOW),
    ).toBe(false)
  })

  it('na primeira transição (lastInterstitialAt=0) mostra após N=2 transições', () => {
    // Default everyNTransitions=2: a primeira chamada tem transitionsSinceLast=0,
    // computa 0+1=1, < 2, então NÃO mostra. Depois de uma skip, vira 1; +1=2, mostra.
    const fresh = { ...INITIAL_SESSION_STATE }
    expect(
      shouldShowInterstitial('transition-groups-to-ko', fresh, DEFAULT_ADS_CONFIG, NOW),
    ).toBe(false)
    const after1 = recordTransitionSkipped(fresh)
    expect(
      shouldShowInterstitial('transition-groups-to-ko', after1, DEFAULT_ADS_CONFIG, NOW),
    ).toBe(true)
  })

  it('respeita o cooldown depois do primeiro interstitial mostrado', () => {
    const justShown = recordInterstitialShown(
      { ...INITIAL_SESSION_STATE, transitionsSinceLast: 5 },
      NOW,
    )
    expect(justShown.transitionsSinceLast).toBe(0)
    expect(justShown.lastInterstitialAt).toBe(NOW)
    // Mesmo após várias transições, se o cooldown não passou, não mostra.
    const after = {
      ...justShown,
      transitionsSinceLast: 10,
    }
    const stillInCooldown = NOW + DEFAULT_ADS_CONFIG.interstitialCooldownMs - 1
    expect(
      shouldShowInterstitial('transition-ko-round', after, DEFAULT_ADS_CONFIG, stillInCooldown),
    ).toBe(false)
    const past = NOW + DEFAULT_ADS_CONFIG.interstitialCooldownMs + 1
    expect(shouldShowInterstitial('transition-ko-round', after, DEFAULT_ADS_CONFIG, past)).toBe(
      true,
    )
  })

  it('slot interstitial desligado individualmente bloqueia mesmo elegível', () => {
    const cfg: AdsConfig = {
      ...DEFAULT_ADS_CONFIG,
      slots: { ...DEFAULT_ADS_CONFIG.slots, 'transition-ko-round': false },
    }
    const elig = { ...INITIAL_SESSION_STATE, transitionsSinceLast: 5 }
    expect(shouldShowInterstitial('transition-ko-round', elig, cfg, NOW + 999_999)).toBe(false)
    // Outro slot do mesmo tipo continua ok
    expect(shouldShowInterstitial('transition-groups-to-ko', elig, cfg, NOW + 999_999)).toBe(true)
  })
})

describe('recordTransitionSkipped', () => {
  it('preserva o resto do state', () => {
    const s = { skipRewardUsed: true, lastInterstitialAt: 123, transitionsSinceLast: 4 }
    const next = recordTransitionSkipped(s)
    expect(next.skipRewardUsed).toBe(true)
    expect(next.lastInterstitialAt).toBe(123)
    expect(next.transitionsSinceLast).toBe(5)
  })
})
