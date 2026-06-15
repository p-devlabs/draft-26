/**
 * Infra de anúncios: tipos, configuração, helpers de cooldown/frequência e
 * persistência leve do estado por sessão/run. Esta camada é provider-agnóstica:
 * o `provider: 'placeholder'` desenha caixas riscadas (igual ao mapa de ads do
 * design); um provider real (AdSense/AdMob/GAM) pluga-se aqui depois sem mexer
 * em quem consome `useAds()` (ver `src/components/ads/AdsProvider.tsx`).
 *
 * Princípios cravados no handoff e respeitados aqui:
 *   1. **O dado é sagrado** — nenhum interstitial dispara durante sorteio.
 *      O componente que monta o `RollingState` do PickDrawer não chama
 *      `showInterstitialIfDue`; e a config tampouco tem slot pra essa zona.
 *   2. **Rewarded > Interstitial > Banner** — rewarded é opt-in puro
 *      (`grantSkipReward` / `grantReplayReward` só são chamados no callback
 *      "earned"); interstitial limitado por cooldown + frequência; banner é
 *      passivo nas telas de leitura (Grupos / Chaveamento).
 *   3. **Slots no estado, não no layout** — cada uso referencia um `AdSlotId`
 *      conhecido, o que permite kill-switch global, A/B e remoção via IAP
 *      sem refatorar nenhum render.
 *   4. **IAP "remover ads"** — `removeAdsPurchased` desliga banner+interstitial
 *      mas mantém rewarded (que é opt-in).
 */

export type AdSlotId =
  // Banners — telas de leitura
  | 'grupos-leaderboard' // desktop top (728×90)
  | 'grupos-footer' // mobile bottom anchored (320×50)
  | 'grupos-rect' // desktop side rail (300×250)
  | 'bracket-leaderboard'
  | 'bracket-footer'
  | 'bracket-rect'
  // Rewarded — opt-in
  | 'rewarded-skip' // +1 pulo na Escalação
  | 'rewarded-replay' // rejogar último jogo no drawer Eliminado
  // Interstitial — só em transições
  | 'transition-groups-to-ko' // fim de grupos → mata-mata
  | 'transition-ko-round' // entre rodadas do mata-mata
  | 'transition-post-final' // após apito final

export type AdFormat = 'banner' | 'rewarded' | 'interstitial'

export const AD_SLOT_FORMAT: Record<AdSlotId, AdFormat> = {
  'grupos-leaderboard': 'banner',
  'grupos-footer': 'banner',
  'grupos-rect': 'banner',
  'bracket-leaderboard': 'banner',
  'bracket-footer': 'banner',
  'bracket-rect': 'banner',
  'rewarded-skip': 'rewarded',
  'rewarded-replay': 'rewarded',
  'transition-groups-to-ko': 'interstitial',
  'transition-ko-round': 'interstitial',
  'transition-post-final': 'interstitial',
}

export interface AdsConfig {
  /** Master kill-switch. Desligado: zero ad de qualquer tipo (nem rewarded). */
  enabled: boolean
  /**
   * IAP "remover ads": desliga banner + interstitial.
   * **Rewarded continua disponível** — é vantagem opt-in, não interfere em quem
   * pagou pra tirar a interrupção passiva.
   */
  removeAdsPurchased: boolean
  /** Pluggable. 'placeholder' = caixas riscadas (default antes de integrar rede). */
  provider: 'placeholder'
  /** Slots ligados/desligados individualmente — habilita kill-switch granular e A/B. */
  slots: Record<AdSlotId, boolean>
  /** Cooldown mínimo entre interstitials (ms). Default 60s (handoff sugere 60–90s). */
  interstitialCooldownMs: number
  /** 1 interstitial a cada N transições (handoff: 1 a cada 2–3). */
  interstitialEveryNTransitions: number
  /** Tempo até liberar o ✕ do interstitial (ms). */
  interstitialSkipAfterMs: number
}

const ALL_SLOTS_ON: Record<AdSlotId, boolean> = {
  'grupos-leaderboard': true,
  'grupos-footer': true,
  'grupos-rect': true,
  'bracket-leaderboard': true,
  'bracket-footer': true,
  'bracket-rect': true,
  'rewarded-skip': true,
  'rewarded-replay': true,
  'transition-groups-to-ko': true,
  'transition-ko-round': true,
  'transition-post-final': true,
}

export const DEFAULT_ADS_CONFIG: AdsConfig = {
  enabled: true,
  removeAdsPurchased: false,
  provider: 'placeholder',
  slots: ALL_SLOTS_ON,
  interstitialCooldownMs: 60_000,
  interstitialEveryNTransitions: 2,
  interstitialSkipAfterMs: 5_000,
}

/**
 * Estado mutável dos limites do handoff. Dividido em "session" (vive só
 * enquanto a aba está aberta — pulo +1) e "run" (vive entre rotas durante uma
 * campanha — replay; zera ao criar XI novo).
 */
export interface AdsSessionState {
  /** Pulo extra +1 já foi concedido nesta SESSÃO? */
  skipRewardUsed: boolean
  /** Timestamp (ms epoch) do último interstitial mostrado. 0 = nunca. */
  lastInterstitialAt: number
  /** Transições contadas desde o último interstitial mostrado. */
  transitionsSinceLast: number
}

export interface AdsRunState {
  /** Rejogar foi concedido nesta RUN? Reseta ao criar XI novo. */
  replayChanceUsed: boolean
}

export const INITIAL_SESSION_STATE: AdsSessionState = {
  skipRewardUsed: false,
  lastInterstitialAt: 0,
  transitionsSinceLast: 0,
}

export const INITIAL_RUN_STATE: AdsRunState = {
  replayChanceUsed: false,
}

// ============================================================
// Helpers puros (testáveis, sem efeito colateral)
// ============================================================

export function isSlotEnabled(slotId: AdSlotId, config: AdsConfig): boolean {
  if (!config.enabled) return false
  const format = AD_SLOT_FORMAT[slotId]
  // IAP só desliga formatos passivos. Rewarded é opt-in, segue ligado.
  if (config.removeAdsPurchased && format !== 'rewarded') return false
  return config.slots[slotId] !== false
}

/**
 * Decide se um interstitial pode ser mostrado AGORA.
 * Considera: slot habilitado + cooldown + contagem de transições.
 *
 * **Não muta estado** — quem chama é responsável por `recordInterstitialShown`
 * no callback de "ad fechado" (ou skip).
 */
export function shouldShowInterstitial(
  slotId: AdSlotId,
  state: AdsSessionState,
  config: AdsConfig,
  now: number,
): boolean {
  if (AD_SLOT_FORMAT[slotId] !== 'interstitial') return false
  if (!isSlotEnabled(slotId, config)) return false
  const sinceLast = now - state.lastInterstitialAt
  if (state.lastInterstitialAt > 0 && sinceLast < config.interstitialCooldownMs) return false
  // +1 porque a transição atual ainda não foi contabilizada.
  const transitionsIncludingThis = state.transitionsSinceLast + 1
  if (transitionsIncludingThis < config.interstitialEveryNTransitions) return false
  return true
}

export function recordInterstitialShown(state: AdsSessionState, now: number): AdsSessionState {
  return { ...state, lastInterstitialAt: now, transitionsSinceLast: 0 }
}

export function recordTransitionSkipped(state: AdsSessionState): AdsSessionState {
  return { ...state, transitionsSinceLast: state.transitionsSinceLast + 1 }
}

// ============================================================
// Persistência leve (localStorage)
// ============================================================

const KEY_SESSION = 'd26:ads-session'
const KEY_RUN = 'd26:ads-run'
const KEY_CONFIG_OVERRIDES = 'd26:ads-config'

function safeRead<T>(key: string, storage: 'session' | 'local'): T | null {
  try {
    const s = storage === 'session' ? window.sessionStorage : window.localStorage
    const v = s.getItem(key)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}

function safeWrite(key: string, val: unknown, storage: 'session' | 'local'): void {
  try {
    const s = storage === 'session' ? window.sessionStorage : window.localStorage
    s.setItem(key, JSON.stringify(val))
  } catch {
    /* quota / browser */
  }
}

export function loadAdsSession(): AdsSessionState {
  return safeRead<AdsSessionState>(KEY_SESSION, 'session') ?? INITIAL_SESSION_STATE
}

export function saveAdsSession(state: AdsSessionState): void {
  safeWrite(KEY_SESSION, state, 'session')
}

export function loadAdsRun(): AdsRunState {
  return safeRead<AdsRunState>(KEY_RUN, 'local') ?? INITIAL_RUN_STATE
}

export function saveAdsRun(state: AdsRunState): void {
  safeWrite(KEY_RUN, state, 'local')
}

/**
 * Zera o estado de RUN. Quem cria um XI novo (Draft/handleReset, ou Copa quando
 * detecta draft fresh, ou MataMata no "TENTAR DE NOVO") deve chamar isto.
 * **Não** zera session — o pulo +1 continua valendo a sessão inteira (handoff).
 */
export function resetAdsRun(): void {
  try {
    window.localStorage.removeItem(KEY_RUN)
  } catch {
    /* ignore */
  }
}

/**
 * Lê overrides de config via localStorage (chave `d26:ads-config`) ou query
 * params (`?noads=1` desliga master, `?ads=0` idem, `?iap=1` simula IAP).
 * Útil pra QA sem rebuild.
 */
export function readConfigOverrides(): Partial<AdsConfig> {
  const overrides = safeRead<Partial<AdsConfig>>(KEY_CONFIG_OVERRIDES, 'local') ?? {}
  if (typeof window === 'undefined') return overrides
  const url = new URLSearchParams(window.location.search)
  if (url.get('noads') === '1' || url.get('ads') === '0') {
    overrides.enabled = false
  }
  if (url.get('iap') === '1') {
    overrides.removeAdsPurchased = true
  }
  return overrides
}

export function resolveConfig(overrides: Partial<AdsConfig> = {}): AdsConfig {
  return {
    ...DEFAULT_ADS_CONFIG,
    ...overrides,
    slots: { ...DEFAULT_ADS_CONFIG.slots, ...(overrides.slots ?? {}) },
  }
}
