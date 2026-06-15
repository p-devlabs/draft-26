import { useState } from 'react'

import {
  DIFFICULTIES,
  FORMATION_OPTIONS,
  STYLES,
  type Difficulty,
  type Style,
} from '../lib/formations'

interface SetupDrawerProps {
  open: boolean
  onStart: (formationName: string, style: Style, difficulty: Difficulty) => void
}

export function SetupDrawer({ open, onStart }: SetupDrawerProps) {
  const [formationName, setFormationName] = useState<string>(FORMATION_OPTIONS[0]?.name ?? '4-3-3')
  const [style, setStyle] = useState<Style>('equilibrado')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')

  if (!open) return null

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6,7,5,0.72)',
          backdropFilter: 'blur(3px)',
          zIndex: 30,
          animation: 'd26-fade-in .25s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 31,
          display: 'flex',
          justifyContent: 'center',
          animation: 'd26-sheet-up .3s cubic-bezier(.2,.9,.3,1)',
          pointerEvents: 'none',
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="setup-drawer-title"
          className="az-sheet"
          style={{
            width: '100%',
            maxWidth: 680,
            background: 'var(--color-d-surface)',
            border: '1px solid var(--color-d-line)',
            borderBottom: 'none',
            borderRadius: '22px 22px 0 0',
            padding: '26px 30px 34px',
            boxShadow: '0 -30px 60px -20px rgba(0,0,0,0.6)',
            maxHeight: '92vh',
            overflowY: 'auto',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              width: 44,
              height: 5,
              borderRadius: 5,
              background: 'var(--color-d-line)',
              margin: '0 auto 22px',
            }}
          />
          <div
            style={{
              fontFamily: 'Space Mono',
              fontSize: 11,
              letterSpacing: '0.18em',
              color: 'var(--color-d-lime)',
              marginBottom: 8,
            }}
          >
            PASSO 1 · CONFIGURE
          </div>
          <h2
            id="setup-drawer-title"
            className="az-sheettitle"
            style={{
              fontFamily: 'Anton',
              fontSize: 36,
              margin: '0 0 4px',
              lineHeight: 0.95,
            }}
          >
            MONTE SEU TIME
          </h2>
          <p
            style={{
              color: 'var(--color-d-mut)',
              fontSize: 14,
              margin: '0 0 26px',
              maxWidth: 440,
            }}
          >
            Escolha a tática e o estilo. Depois, cada posição sorteia uma seleção e você escala 1
            craque dela. Posição fechada não muda.
          </p>

          <SectionLabel>TÁTICA</SectionLabel>
          <div
            role="radiogroup"
            aria-label="Tática"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 10,
              marginBottom: 24,
            }}
          >
            {FORMATION_OPTIONS.map((f) => {
              const on = formationName === f.name
              return (
                <button
                  key={f.name}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className="az-formbtn"
                  onClick={() => setFormationName(f.name)}
                  style={{
                    background: on ? 'var(--color-d-lime)' : 'var(--color-d-surface2)',
                    border: `1px solid ${on ? 'var(--color-d-lime)' : 'var(--color-d-line)'}`,
                    color: on ? 'var(--color-d-bg)' : 'var(--color-d-ink)',
                    borderRadius: 12,
                    padding: '16px 0',
                    fontFamily: 'Anton',
                    fontSize: 22,
                    letterSpacing: '0.02em',
                    cursor: 'pointer',
                    minWidth: 0,
                  }}
                  title={f.description}
                >
                  {f.name}
                </button>
              )
            })}
          </div>

          <SectionLabel>ESTILO</SectionLabel>
          <div role="radiogroup" aria-label="Estilo" style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
            {STYLES.map((s) => {
              const on = style === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setStyle(s.id)}
                  style={{
                    flex: 1,
                    background: on ? 'rgba(212,255,61,0.12)' : 'var(--color-d-surface2)',
                    border: `1px solid ${on ? 'var(--color-d-lime)' : 'var(--color-d-line)'}`,
                    color: on ? 'var(--color-d-lime)' : 'var(--color-d-mut)',
                    borderRadius: 11,
                    padding: '14px 0',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 11,
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <SectionLabel inline>DIFICULDADE</SectionLabel>
            <span
              style={{
                fontFamily: 'Space Mono',
                fontSize: 10,
                color: 'var(--color-d-mut)',
                textAlign: 'right',
              }}
            >
              define seus pulos de sorteio
            </span>
          </div>
          <div role="radiogroup" aria-label="Dificuldade" style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
            {DIFFICULTIES.map((d) => {
              const on = difficulty === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDifficulty(d.id)}
                  style={{
                    flex: 1,
                    background: on ? 'rgba(212,255,61,0.12)' : 'var(--color-d-surface2)',
                    border: `1px solid ${on ? 'var(--color-d-lime)' : 'var(--color-d-line)'}`,
                    color: on ? 'var(--color-d-lime)' : 'var(--color-d-mut)',
                    borderRadius: 11,
                    padding: '12px 0',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{d.label}</span>
                  <span
                    className="az-diffbtn-skips"
                    style={{ fontFamily: 'Space Mono', fontSize: 10 }}
                  >
                    ⚄ {d.skips} pulos
                  </span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => onStart(formationName, style, difficulty)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: 'var(--color-d-lime)',
              color: 'var(--color-d-bg)',
              border: 'none',
              borderRadius: 13,
              padding: 18,
              fontFamily: 'Anton',
              fontSize: 21,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              animation: 'd26-pulse 2.6s infinite',
            }}
          >
            COMEÇAR A MONTAR <span style={{ fontSize: 18 }}>→</span>
          </button>
        </div>
      </div>
    </>
  )
}

function SectionLabel({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <div
      style={{
        fontFamily: 'Space Mono',
        fontSize: 11,
        letterSpacing: '0.12em',
        color: 'var(--color-d-mut)',
        marginBottom: inline ? 0 : 11,
      }}
    >
      {children}
    </div>
  )
}
