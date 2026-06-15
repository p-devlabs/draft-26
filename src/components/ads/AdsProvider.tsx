/**
 * AdsProvider: ponto central do sistema de anúncios.
 *
 * Faz três coisas:
 *   1. Mantém `config` + `session`/`run` em React state, persiste pra storage.
 *   2. Expõe `useAds()` com helpers prontos pros call-sites
 *      (`isBannerEnabled`, `showInterstitial`, `grantSkipReward` etc).
 *   3. Renderiza um único `<InterstitialModal>` global (singleton) que qualquer
 *      consumidor dispara via Promise — o consumidor só precisa
 *      `await showInterstitial(slot)` antes de navegar.
 *
 * Quem renderiza Rewarded UI: o **call-site** (PickDrawer, drawer Eliminado),
 * porque a UI rewarded é parte da tela contextual (sheet ancorado no flow).
 * Aqui só vem o estado + callbacks `grantSkipReward`/`grantReplayReward`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AD_SLOT_FORMAT,
  DEFAULT_ADS_CONFIG,
  INITIAL_RUN_STATE,
  INITIAL_SESSION_STATE,
  isSlotEnabled,
  loadAdsRun,
  loadAdsSession,
  readConfigOverrides,
  recordInterstitialShown,
  recordTransitionSkipped,
  resetAdsRun,
  resolveConfig,
  saveAdsRun,
  saveAdsSession,
  shouldShowInterstitial,
  type AdSlotId,
  type AdsConfig,
  type AdsRunState,
  type AdsSessionState,
} from '../../lib/ads'
import { InterstitialModal } from './InterstitialModal'

export interface AdsContextValue {
  config: AdsConfig
  session: AdsSessionState
  run: AdsRunState
  /** Banner/nativo: pode renderizar o slot? */
  isBannerEnabled: (slotId: AdSlotId) => boolean
  /** Rewarded +1 pulo: pode oferecer? */
  canShowSkipReward: boolean
  /** Marca o pulo como concedido (chamar no callback "earned reward"). */
  grantSkipReward: () => void
  /** Rewarded rejogar: pode oferecer? */
  canShowReplayReward: boolean
  /** Marca o replay como concedido. */
  grantReplayReward: () => void
  /**
   * Mostra interstitial se elegível. Resolve quando o ad fecha (ou imediato
   * se não era elegível). O retorno é só pra debug — o caller geralmente
   * faz `await ads.showInterstitial(slot); navigate(...)` independente do
   * resultado.
   */
  showInterstitial: (slotId: AdSlotId) => Promise<boolean>
  /** Zera o estado de RUN. Chamado ao criar XI novo. */
  resetRun: () => void
}

const AdsContext = createContext<AdsContextValue | null>(null)

export function useAds(): AdsContextValue {
  const ctx = useContext(AdsContext)
  if (!ctx) {
    // Fallback inerte: se algum lugar consumir useAds() fora do provider
    // (testes, SSR, story isolado), nada quebra — todo slot fica desligado.
    return INERT_VALUE
  }
  return ctx
}

const INERT_VALUE: AdsContextValue = {
  config: { ...DEFAULT_ADS_CONFIG, enabled: false },
  session: INITIAL_SESSION_STATE,
  run: INITIAL_RUN_STATE,
  isBannerEnabled: () => false,
  canShowSkipReward: false,
  grantSkipReward: () => {},
  canShowReplayReward: false,
  grantReplayReward: () => {},
  showInterstitial: () => Promise.resolve(false),
  resetRun: () => {},
}

export function AdsProvider({ children }: { children: ReactNode }) {
  const [config] = useState<AdsConfig>(() => resolveConfig(readConfigOverrides()))
  const [session, setSession] = useState<AdsSessionState>(() => loadAdsSession())
  const [run, setRun] = useState<AdsRunState>(() => loadAdsRun())

  // Estado da modal de interstitial. Quando `pending` está setado, o modal
  // monta; ao resolver, ele chama `pending.resolve(shown)` e limpa.
  const [pending, setPending] = useState<{
    slotId: AdSlotId
    resolve: (shown: boolean) => void
  } | null>(null)
  // Guarda a config pra timing do skip — evita re-pegar config no render do modal.
  const skipAfterMs = config.interstitialSkipAfterMs

  // Persist quando muda.
  useEffect(() => {
    saveAdsSession(session)
  }, [session])
  useEffect(() => {
    saveAdsRun(run)
  }, [run])

  const isBannerEnabled = useCallback(
    (slotId: AdSlotId) => {
      if (AD_SLOT_FORMAT[slotId] !== 'banner') return false
      return isSlotEnabled(slotId, config)
    },
    [config],
  )

  const canShowSkipReward = useMemo(() => {
    if (!isSlotEnabled('rewarded-skip', config)) return false
    return !session.skipRewardUsed
  }, [config, session.skipRewardUsed])

  const canShowReplayReward = useMemo(() => {
    if (!isSlotEnabled('rewarded-replay', config)) return false
    return !run.replayChanceUsed
  }, [config, run.replayChanceUsed])

  const grantSkipReward = useCallback(() => {
    setSession((s) => ({ ...s, skipRewardUsed: true }))
  }, [])
  const grantReplayReward = useCallback(() => {
    setRun((r) => ({ ...r, replayChanceUsed: true }))
  }, [])
  const resetRun = useCallback(() => {
    resetAdsRun()
    setRun(INITIAL_RUN_STATE)
  }, [])

  // `sessionRef` evita capturar uma versão velha de `session` dentro do callback
  // de `showInterstitial` — o consumer típico chama várias transições em sequência.
  const sessionRef = useRef(session)
  sessionRef.current = session

  const showInterstitial = useCallback(
    (slotId: AdSlotId): Promise<boolean> => {
      const now = Date.now()
      if (!shouldShowInterstitial(slotId, sessionRef.current, config, now)) {
        // Contabiliza transição mas não mostra (frequência ou cooldown).
        const next = recordTransitionSkipped(sessionRef.current)
        sessionRef.current = next
        setSession(next)
        return Promise.resolve(false)
      }
      return new Promise<boolean>((resolve) => {
        setPending({
          slotId,
          resolve: (shown) => {
            const next = recordInterstitialShown(sessionRef.current, Date.now())
            sessionRef.current = next
            setSession(next)
            resolve(shown)
          },
        })
      })
    },
    [config],
  )

  const value = useMemo<AdsContextValue>(
    () => ({
      config,
      session,
      run,
      isBannerEnabled,
      canShowSkipReward,
      grantSkipReward,
      canShowReplayReward,
      grantReplayReward,
      showInterstitial,
      resetRun,
    }),
    [
      config,
      session,
      run,
      isBannerEnabled,
      canShowSkipReward,
      grantSkipReward,
      canShowReplayReward,
      grantReplayReward,
      showInterstitial,
      resetRun,
    ],
  )

  return (
    <AdsContext.Provider value={value}>
      {children}
      {pending && (
        <InterstitialModal
          slotId={pending.slotId}
          skipAfterMs={skipAfterMs}
          onClose={() => {
            const r = pending.resolve
            setPending(null)
            r(true)
          }}
        />
      )}
    </AdsContext.Provider>
  )
}
