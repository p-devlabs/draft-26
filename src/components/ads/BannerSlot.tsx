/**
 * Banner / Nativo placeholder. Quatro variantes pegáveis pelos `kind`:
 *
 *   - `mobile-footer` — 320×50 ancorado no rodapé (sticky bottom)
 *   - `desktop-leaderboard` — 728×90 no topo
 *   - `desktop-rectangle` — 300×250 lateral
 *   - `inline` — variante genérica (largura herda, altura definida pelo caller)
 *
 * O componente checa `isBannerEnabled(slotId)` automaticamente; se desligado,
 * retorna `null`. Quem chama não precisa fazer guard.
 */
import { useAds } from './AdsProvider'
import type { AdSlotId } from '../../lib/ads'

type BannerKind = 'mobile-footer' | 'desktop-leaderboard' | 'desktop-rectangle' | 'inline'

interface Props {
  slotId: AdSlotId
  kind: BannerKind
  /** Esconde o slot completamente (ex: tela móvel mostrando o desktop variant). */
  hidden?: boolean
}

export function BannerSlot({ slotId, kind, hidden }: Props) {
  const ads = useAds()
  if (hidden) return null
  if (!ads.isBannerEnabled(slotId)) return null

  if (kind === 'mobile-footer') return <MobileFooter slotId={slotId} />
  if (kind === 'desktop-leaderboard') return <Leaderboard slotId={slotId} />
  if (kind === 'desktop-rectangle') return <Rectangle slotId={slotId} />
  return <Inline slotId={slotId} />
}

const dashedBg =
  'repeating-linear-gradient(45deg, rgba(136,140,128,0.08) 0 9px, transparent 9px 18px)'

function Placeholder({
  slotId,
  label,
  dimensions,
}: {
  slotId: AdSlotId
  label: string
  dimensions: string
}) {
  return (
    <div
      role="complementary"
      aria-label={`Anúncio · ${slotId}`}
      style={{
        width: '100%',
        height: '100%',
        border: '1.5px dashed #4a4d42',
        borderRadius: 9,
        background: dashedBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '6px 8px',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize: 9,
          fontWeight: 700,
          color: '#c9cdbf',
          background: '#2a2e26',
          borderRadius: 4,
          padding: '3px 7px',
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: '#888c80' }}>
        {dimensions}
      </span>
    </div>
  )
}

/**
 * Banner ancorado no rodapé pra viewport mobile. Fica `position: fixed` em
 * cima da SimBar/footer — quem usa precisa garantir padding inferior no
 * conteúdo principal pra não tampar.
 */
function MobileFooter({ slotId }: { slotId: AdSlotId }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        background: '#101310',
        borderTop: '1px solid #2a2e26',
        padding: '8px 10px',
        zIndex: 12,
        height: 70,
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto', height: 54 }}>
        <Placeholder slotId={slotId} label="BANNER" dimensions="320×50 adaptive · ancorado" />
      </div>
    </div>
  )
}

function Leaderboard({ slotId }: { slotId: AdSlotId }) {
  return (
    <div style={{ padding: '11px 0 0', width: '100%' }}>
      <div style={{ height: 64 }}>
        <Placeholder slotId={slotId} label="LEADERBOARD" dimensions="728×90 · topo" />
      </div>
    </div>
  )
}

function Rectangle({ slotId }: { slotId: AdSlotId }) {
  return (
    <div style={{ width: 200, height: 250, flexShrink: 0 }}>
      <Placeholder slotId={slotId} label="RECTANGLE" dimensions="300×250" />
    </div>
  )
}

function Inline({ slotId }: { slotId: AdSlotId }) {
  return (
    <div style={{ width: '100%', height: 96 }}>
      <Placeholder slotId={slotId} label="NATIVO" dimensions="card patrocinado" />
    </div>
  )
}
