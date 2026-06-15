/**
 * Card de pênaltis com revelação tiro-a-tiro. Mostra placar agregado,
 * círculos por cobrança (preenchidos = gol, contorno vermelho = perdeu,
 * tracejado = pendente) e uma linha "AO VIVO" com o último batedor.
 *
 * Usado em /match (knockout) e na sandbox /dev/penalties.
 */
import type { Penalties } from '../lib/bracket'

export interface PenaltiesCardSide {
  /** Rótulo curto no card (ex: "SEU XI", "BRA"). */
  label: string
  isUser: boolean
}

export function PenaltiesCard({
  penalties,
  kicksRevealed,
  home,
  away,
  active,
}: {
  penalties: Penalties
  /** Quantas cobranças (do início da sequência) já são visíveis. */
  kicksRevealed: number
  home: PenaltiesCardSide
  away: PenaltiesCardSide
  /** True enquanto a disputa está em andamento. Mostra batedor atual. */
  active: boolean
}) {
  const visible = penalties.sequence.slice(0, kicksRevealed)
  const homeKicks = visible.filter((s) => s.team === 'home')
  const awayKicks = visible.filter((s) => s.team === 'away')
  const homeScored = homeKicks.filter((k) => k.scored).length
  const awayScored = awayKicks.filter((k) => k.scored).length
  const lastIdx = visible.length - 1
  const lastKick = lastIdx >= 0 ? visible[lastIdx] : null
  const justKickedNote =
    active && lastKick?.kicker
      ? `${lastKick.kicker.toUpperCase()} ${lastKick.scored ? 'CONVERTEU' : 'PERDEU'}`
      : null
  // Slots por lateral: sempre 5 (regulamentar) + 1 por par de morte súbita já iniciado.
  // Mesmo quando a disputa encerra cedo (ex: 4-1 na R4), continuamos mostrando os 5
  // — os não cobrados ficam pontilhados como "não precisou bater".
  const totalSlotsPerSide = 5 + Math.ceil(Math.max(0, kicksRevealed - 10) / 2)

  return (
    <div
      style={{
        background: 'var(--color-d-surface)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'Space Mono',
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--color-d-mut)',
          marginBottom: 12,
        }}
      >
        <span>{active ? 'DISPUTA POR PÊNALTIS' : 'DECISÃO POR PÊNALTIS'}</span>
        {active && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              color: 'var(--color-d-red)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--color-d-red)',
                animation: 'd26-blink 1s infinite',
              }}
            />
            AO VIVO
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 12,
          fontFamily: 'Anton',
          fontSize: 22,
        }}
      >
        <span style={{ color: home.isUser ? 'var(--color-d-lime)' : 'var(--color-d-ink)' }}>
          {homeScored}
        </span>
        <span style={{ color: 'var(--color-d-mut)' }}>—</span>
        <span style={{ color: away.isUser ? 'var(--color-d-lime)' : 'var(--color-d-ink)' }}>
          {awayScored}
        </span>
      </div>
      <PenRow
        label={home.label}
        kicks={homeKicks}
        totalRounds={totalSlotsPerSide}
        activeSide={active && lastKick?.team === 'home'}
        isUserSide={home.isUser}
      />
      <div style={{ height: 8 }} />
      <PenRow
        label={away.label}
        kicks={awayKicks}
        totalRounds={totalSlotsPerSide}
        activeSide={active && lastKick?.team === 'away'}
        isUserSide={away.isUser}
      />
      {justKickedNote && (
        <div
          style={{
            marginTop: 12,
            padding: '8px 10px',
            borderRadius: 8,
            background: lastKick?.scored ? 'rgba(212,255,61,0.08)' : 'rgba(255,59,59,0.07)',
            border: `1px solid ${lastKick?.scored ? 'rgba(212,255,61,0.3)' : 'rgba(255,59,59,0.28)'}`,
            fontFamily: 'Space Mono',
            fontSize: 10,
            letterSpacing: '0.08em',
            color: lastKick?.scored ? 'var(--color-d-lime)' : 'var(--color-d-red)',
            fontWeight: 700,
            animation: 'd26-pop-in .25s ease',
          }}
        >
          {justKickedNote}
        </div>
      )}
    </div>
  )
}

function PenRow({
  label,
  kicks,
  totalRounds,
  activeSide,
  isUserSide,
}: {
  label: string
  kicks: Penalties['sequence']
  totalRounds: number
  activeSide: boolean
  isUserSide: boolean
}) {
  const lastIdx = kicks.length - 1
  const pending = Math.max(0, totalRounds - kicks.length)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize: 10,
          color: isUserSide ? 'var(--color-d-lime)' : 'var(--color-d-mut)',
          width: 60,
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {kicks.map((k, i) => (
          <span
            key={`shot-${i}`}
            title={k.kicker ? `${k.kicker}${k.scored ? ' — gol' : ' — perdeu'}` : undefined}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: k.scored ? 'var(--color-d-lime)' : 'transparent',
              border: `1.5px solid ${k.scored ? 'var(--color-d-lime)' : 'var(--color-d-red)'}`,
              boxShadow:
                activeSide && i === lastIdx
                  ? `0 0 0 3px ${k.scored ? 'rgba(212,255,61,0.25)' : 'rgba(255,59,59,0.2)'}`
                  : 'none',
              animation: activeSide && i === lastIdx ? 'd26-pop-in .25s ease' : 'none',
            }}
          />
        ))}
        {Array.from({ length: pending }).map((_, i) => (
          <span
            key={`pending-${i}`}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'transparent',
              border: '1.5px dashed var(--color-d-line)',
              opacity: 0.6,
            }}
          />
        ))}
      </div>
    </div>
  )
}
