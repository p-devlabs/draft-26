/**
 * Sandbox de pênaltis — só pra desenvolver/testar a animação tiro-a-tiro
 * isoladamente, sem precisar jogar uma campanha inteira até cair num
 * shootout real.
 *
 * Como rodar:
 *   - Em dev (`pnpm dev`): abrir /dev/penalties (qualquer momento, sem
 *     localStorage)
 *   - Em prod: rota inexistente — route só é registrada quando features.dev.
 *
 * Permite escolher duas seleções da base + seed, e dispara uma disputa
 * usando exatamente o mesmo `simulatePenalties` + `PenaltiesCard` da
 * partida real, com playback controlável (speed/pause/skip/restart).
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { PenaltiesCard } from '../components/PenaltiesCard'
import { squads } from '../data/squads'
import { simulatePenalties, type Penalties } from '../lib/bracket'
import { createDraft } from '../lib/draft'
import { features } from '../lib/features'
import { rosterForKnockout } from '../lib/rosters'
import { seededRng } from '../lib/simulate'

type Speed = 'slow' | 'normal' | 'fast'
const SPEED_LABEL: Record<Speed, string> = { slow: '1×', normal: '2×', fast: '4×' }
const SPEED_ORDER: Speed[] = ['slow', 'normal', 'fast']
const KICK_MS: Record<Speed, number> = { slow: 1500, normal: 850, fast: 380 }

const DEFAULT_HOME = 'BRA'
const DEFAULT_AWAY = 'ARG'

export function PenaltiesDev() {
  // Bloqueio defensivo — se alguém bater a rota direto em prod, manda pra home.
  if (!features.dev) {
    return (
      <div className="d26-scope" style={{ padding: 40, minHeight: '60vh' }}>
        <p style={{ fontFamily: 'Space Mono', color: 'var(--color-d-mut)' }}>
          Esta rota só existe em dev mode. Adicione <code>?dev=1</code> em qualquer URL do app pra
          ligar o flag.
        </p>
        <Link to="/" style={{ color: 'var(--color-d-lime)' }}>
          ← voltar
        </Link>
      </div>
    )
  }

  const [homeCode, setHomeCode] = useState(DEFAULT_HOME)
  const [awayCode, setAwayCode] = useState(DEFAULT_AWAY)
  const [seedInput, setSeedInput] = useState('1')
  const [speed, setSpeed] = useState<Speed>('normal')
  const [playing, setPlaying] = useState(true)
  const [runId, setRunId] = useState(0)
  const [kicksRevealed, setKicksRevealed] = useState(0)

  // Recompute somente quando runId muda — congela a sim até o usuário rodar de novo.
  const sim = useMemo(() => {
    const homeSquad = squads.find((s) => s.code === homeCode) ?? squads[0]
    const awaySquad = squads.find((s) => s.code === awayCode) ?? squads[1]
    const seed = Math.max(1, Number(seedInput) || 1)
    const rng = seededRng(seed + runId * 31)
    // Cria um draft falso só pra satisfazer a assinatura de rosterForKnockout
    // (fica-se com squad roster real, draft não importa quando code != USER).
    const fakeDraft = createDraft('4-3-3', 'equilibrado', 'easy')
    const homeRoster = rosterForKnockout(homeSquad.code, fakeDraft, {
      name: homeSquad.country,
      flag: homeSquad.flag,
    })
    const awayRoster = rosterForKnockout(awaySquad.code, fakeDraft, {
      name: awaySquad.country,
      flag: awaySquad.flag,
    })
    const penalties = simulatePenalties(
      { code: homeSquad.code, averageOverall: homeSquad.averageOverall },
      { code: awaySquad.code, averageOverall: awaySquad.averageOverall },
      rng,
      { homeRoster, awayRoster },
    )
    return { home: homeSquad, away: awaySquad, penalties }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId])

  const total = sim.penalties.sequence.length
  const active = kicksRevealed < total

  // Timer de revelação tiro-a-tiro.
  useEffect(() => {
    if (!active || !playing) return
    const id = window.setTimeout(() => {
      setKicksRevealed((n) => Math.min(n + 1, total))
    }, KICK_MS[speed])
    return () => window.clearTimeout(id)
  }, [active, playing, speed, kicksRevealed, total])

  // Reset reveal ao mudar sim.
  useEffect(() => {
    setKicksRevealed(0)
    setPlaying(true)
  }, [runId])

  const homeScored = sim.penalties.sequence
    .slice(0, kicksRevealed)
    .filter((k) => k.team === 'home' && k.scored).length
  const awayScored = sim.penalties.sequence
    .slice(0, kicksRevealed)
    .filter((k) => k.team === 'away' && k.scored).length

  const winnerSide: 'home' | 'away' | null = active
    ? null
    : sim.penalties.homeScored > sim.penalties.awayScored
      ? 'home'
      : 'away'

  return (
    <div className="d26-scope" style={{ minHeight: '100vh' }}>
      <header
        style={{
          padding: '14px clamp(16px, 4vw, 28px)',
          borderBottom: '1px solid var(--color-d-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: 'Space Mono',
            color: 'var(--color-d-mut)',
            fontSize: 11,
            letterSpacing: '0.08em',
          }}
        >
          ← HOME
        </Link>
        <div
          style={{
            fontFamily: 'Anton',
            fontSize: 22,
            letterSpacing: '0.04em',
          }}
        >
          DEV · PÊNALTIS
        </div>
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 10,
            color: 'var(--color-d-lime)',
            letterSpacing: '0.1em',
          }}
        >
          SANDBOX
        </span>
      </header>

      <main
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '20px clamp(16px, 4vw, 28px) 40px',
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        <section
          style={{
            flex: '2 1 360px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <ConfigCard
            homeCode={homeCode}
            awayCode={awayCode}
            seedInput={seedInput}
            onHome={setHomeCode}
            onAway={setAwayCode}
            onSeed={setSeedInput}
            onRun={() => setRunId((id) => id + 1)}
          />

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
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: 12,
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Anton', fontSize: 18, lineHeight: 0.95 }}>
                  {sim.home.country.toUpperCase()}
                </div>
                <div
                  style={{
                    fontFamily: 'Space Mono',
                    fontSize: 10,
                    color: 'var(--color-d-mut)',
                  }}
                >
                  OVR {Math.round(sim.home.averageOverall)}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  fontFamily: 'Anton',
                  fontSize: 36,
                  lineHeight: 1,
                }}
              >
                <span
                  style={{
                    color: winnerSide === 'home' ? 'var(--color-d-lime)' : 'var(--color-d-ink)',
                  }}
                >
                  {homeScored}
                </span>
                <span style={{ fontSize: 22, color: 'var(--color-d-mut)' }}>—</span>
                <span
                  style={{
                    color: winnerSide === 'away' ? 'var(--color-d-lime)' : 'var(--color-d-ink)',
                  }}
                >
                  {awayScored}
                </span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'Anton', fontSize: 18, lineHeight: 0.95 }}>
                  {sim.away.country.toUpperCase()}
                </div>
                <div
                  style={{
                    fontFamily: 'Space Mono',
                    fontSize: 10,
                    color: 'var(--color-d-mut)',
                  }}
                >
                  OVR {Math.round(sim.away.averageOverall)}
                </div>
              </div>
            </div>

            <Controls
              playing={playing}
              active={active}
              speed={speed}
              onToggle={() => setPlaying((p) => !p)}
              onSpeed={setSpeed}
              onSkip={() => setKicksRevealed(total)}
              onRestart={() => {
                setKicksRevealed(0)
                setPlaying(true)
              }}
            />
          </div>

          <KicksFeed
            kicks={sim.penalties.sequence.slice(0, kicksRevealed)}
            home={sim.home}
            away={sim.away}
          />
        </section>

        <aside style={{ flex: '1 1 280px', minWidth: 0 }}>
          <PenaltiesCard
            penalties={sim.penalties}
            kicksRevealed={kicksRevealed}
            home={{ label: sim.home.code.toUpperCase(), isUser: false }}
            away={{ label: sim.away.code.toUpperCase(), isUser: false }}
            active={active}
          />
        </aside>
      </main>
    </div>
  )
}

function ConfigCard({
  homeCode,
  awayCode,
  seedInput,
  onHome,
  onAway,
  onSeed,
  onRun,
}: {
  homeCode: string
  awayCode: string
  seedInput: string
  onHome: (c: string) => void
  onAway: (c: string) => void
  onSeed: (s: string) => void
  onRun: () => void
}) {
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
          fontFamily: 'Space Mono',
          fontSize: 11,
          letterSpacing: '0.12em',
          color: 'var(--color-d-mut)',
          marginBottom: 14,
        }}
      >
        CONFIGURAÇÃO
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="MANDANTE">
          <TeamSelect value={homeCode} onChange={onHome} />
        </Field>
        <Field label="VISITANTE">
          <TeamSelect value={awayCode} onChange={onAway} />
        </Field>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
        <Field label="SEED">
          <input
            type="number"
            value={seedInput}
            onChange={(e) => onSeed(e.target.value)}
            min={1}
            style={inputStyle}
          />
        </Field>
        <button onClick={onRun} style={runBtnStyle}>
          ↻ RODAR
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize: 9,
          color: 'var(--color-d-mut)',
          letterSpacing: '0.1em',
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function TeamSelect({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const sorted = useMemo(() => [...squads].sort((a, b) => a.country.localeCompare(b.country)), [])
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {sorted.map((s) => (
        <option key={s.code} value={s.code}>
          {s.country} ({Math.round(s.averageOverall)})
        </option>
      ))}
    </select>
  )
}

const inputStyle: CSSProperties = {
  background: 'var(--color-d-surface2)',
  border: '1px solid var(--color-d-line)',
  borderRadius: 8,
  padding: '9px 10px',
  fontFamily: 'Space Mono',
  fontSize: 12,
  color: 'var(--color-d-ink)',
  width: '100%',
}

const runBtnStyle: CSSProperties = {
  alignSelf: 'flex-end',
  background: 'var(--color-d-lime)',
  border: 'none',
  borderRadius: 9,
  padding: '10px 18px',
  fontFamily: 'Anton',
  fontSize: 14,
  color: 'var(--color-d-bg)',
  cursor: 'pointer',
  letterSpacing: '0.04em',
}

function Controls({
  playing,
  active,
  speed,
  onToggle,
  onSpeed,
  onSkip,
  onRestart,
}: {
  playing: boolean
  active: boolean
  speed: Speed
  onToggle: () => void
  onSpeed: (s: Speed) => void
  onSkip: () => void
  onRestart: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button
        onClick={onToggle}
        disabled={!active}
        style={{
          background: active ? 'var(--color-d-lime)' : 'var(--color-d-surface2)',
          color: active ? 'var(--color-d-bg)' : 'var(--color-d-mut)',
          border: 'none',
          borderRadius: 10,
          padding: 13,
          fontFamily: 'Anton',
          fontSize: 16,
          cursor: active ? 'pointer' : 'default',
          letterSpacing: '0.02em',
        }}
      >
        {active ? (playing ? '❚❚ PAUSAR' : '▶ CONTINUAR') : 'DISPUTA ENCERRADA'}
      </button>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={onRestart} style={smallBtn} title="Reiniciar revelação">
          ↻
        </button>
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: 6,
            background: 'var(--color-d-surface2)',
            border: '1px solid var(--color-d-line)',
            borderRadius: 9,
            padding: 4,
          }}
        >
          {SPEED_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => onSpeed(s)}
              style={{
                flex: 1,
                background: speed === s ? 'var(--color-d-lime)' : 'transparent',
                color: speed === s ? 'var(--color-d-bg)' : 'var(--color-d-mut)',
                border: 'none',
                borderRadius: 6,
                padding: '8px 0',
                fontFamily: 'Space Mono',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {SPEED_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <button onClick={onSkip} disabled={!active} style={skipBtn(active)}>
        ⏭ PULAR PRO FIM
      </button>
    </div>
  )
}

const smallBtn: CSSProperties = {
  background: 'var(--color-d-surface2)',
  border: '1px solid var(--color-d-line)',
  color: 'var(--color-d-ink)',
  borderRadius: 9,
  padding: '11px 14px',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
}

function skipBtn(active: boolean): CSSProperties {
  return {
    background: 'transparent',
    border: '1px solid var(--color-d-line)',
    color: active ? 'var(--color-d-mut)' : 'var(--color-d-line)',
    borderRadius: 9,
    padding: '9px 0',
    fontFamily: 'Space Mono',
    fontSize: 11,
    letterSpacing: '0.06em',
    fontWeight: 700,
    cursor: active ? 'pointer' : 'default',
  }
}

function KicksFeed({
  kicks,
  home,
  away,
}: {
  kicks: Penalties['sequence']
  home: { code: string; country: string }
  away: { code: string; country: string }
}) {
  return (
    <div
      style={{
        background: 'var(--color-d-surface)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-d-line)',
        }}
      >
        <div style={{ fontFamily: 'Anton', fontSize: 16 }}>LANCES</div>
        <div style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'var(--color-d-mut)' }}>
          {kicks.length} COBRANÇA{kicks.length === 1 ? '' : 'S'}
        </div>
      </div>
      <div
        style={{
          maxHeight: 360,
          overflowY: 'auto',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
        }}
      >
        {kicks.length === 0 ? (
          <div
            style={{
              padding: '40px 12px',
              textAlign: 'center',
              fontFamily: 'Space Mono',
              fontSize: 11,
              color: 'var(--color-d-mut)',
              letterSpacing: '0.08em',
            }}
          >
            CLIQUE EM RODAR PRA COMEÇAR
          </div>
        ) : (
          [...kicks]
            .reverse()
            .map((k, i) => (
              <KickRow
                key={kicks.length - 1 - i}
                kick={k}
                index={kicks.length - 1 - i}
                homeCountry={home.country}
                awayCountry={away.country}
              />
            ))
        )}
      </div>
    </div>
  )
}

function KickRow({
  kick,
  index,
  homeCountry,
  awayCountry,
}: {
  kick: Penalties['sequence'][number]
  index: number
  homeCountry: string
  awayCountry: string
}) {
  const round = Math.floor(index / 2) + 1
  const scoredColor = kick.scored ? 'var(--color-d-lime)' : 'var(--color-d-red)'
  const teamName = kick.team === 'home' ? homeCountry : awayCountry
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 10,
        background: kick.scored ? 'rgba(212,255,61,0.06)' : 'rgba(255,59,59,0.05)',
        border: `1px solid ${kick.scored ? 'rgba(212,255,61,0.25)' : 'rgba(255,59,59,0.2)'}`,
      }}
    >
      <div
        style={{
          width: 44,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <span style={{ fontFamily: 'Anton', fontSize: 13, color: scoredColor }}>{round}ª</span>
        <span style={{ fontSize: 15 }}>{kick.scored ? '⚽' : '🧤'}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: 'Space Mono',
              fontSize: 10,
              fontWeight: 700,
              background: scoredColor,
              color: kick.scored ? 'var(--color-d-bg)' : '#fff',
              padding: '3px 8px',
              borderRadius: 5,
              letterSpacing: '0.06em',
            }}
          >
            {kick.scored ? 'CONVERTEU' : 'PERDEU'}
          </span>
          <span style={{ fontFamily: 'Space Mono', fontSize: 11, fontWeight: 700 }}>
            {(kick.kicker ?? 'Batedor').toUpperCase()}
          </span>
          <span style={{ fontFamily: 'Space Mono', fontSize: 10, color: 'var(--color-d-mut)' }}>
            {teamName.toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-d-mut)' }}>
          {kick.kickerShirt != null ? `Camisa ${kick.kickerShirt} · ` : ''}
          {kick.kickerBucket ?? ''}
        </div>
      </div>
    </div>
  )
}
