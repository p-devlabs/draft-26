/**
 * /dev/outcomes — galeria das 7 variantes do OutcomeDrawer.
 *
 * Renderiza cada outcome aberto em sequência pra dar pra iterar
 * visualmente sem precisar simular uma campanha inteira. Mock estático
 * (ctx fabricado), gated pelo `features.dev` igual ao PenaltiesDev.
 */
import { useMemo, useState } from 'react'

import {
  OutcomeDrawer,
  type OutcomeContext,
  type OutcomeKind,
} from '../components/match/OutcomeDrawer'
import { autoFillXI } from '../lib/autofill'
import { createDraft } from '../lib/draft'
import { features } from '../lib/features'

const OUTCOMES: OutcomeKind[] = [
  'grupo',
  'grupo-resultado',
  'classificado',
  'fora-grupos',
  'avancou',
  'elim',
  'champ',
]

export function OutcomeDev() {
  const [active, setActive] = useState<OutcomeKind | null>(null)

  // Draft mock: gera um XI completo via autofill 4-3-3, equilibrado, médio.
  const draft = useMemo(() => autoFillXI(createDraft('4-3-3', 'equilibrado', 'medium')), [])

  // Contexto mock — dados plausíveis pra cada outcome.
  const ctx: OutcomeContext = useMemo(
    () => ({
      phase: 'FASE DE GRUPOS · 1/3',
      resultLine: 'GRUPO B · 1º · 9 PTS · +6 SALDO',
      matchResult: {
        userGoals: 3,
        oppGoals: 1,
        oppLabel: 'JAP',
        penalties: {
          userScored: 4,
          oppScored: 3,
          sequence: [
            { isUser: true, scored: true },
            { isUser: false, scored: false },
            { isUser: true, scored: true },
            { isUser: false, scored: true },
            { isUser: true, scored: false },
            { isUser: false, scored: true },
            { isUser: true, scored: true },
            { isUser: false, scored: false },
            { isUser: true, scored: true },
            { isUser: false, scored: true },
          ],
        },
      },
      draft,
      stats: { jogos: 6, rec: '5-1-0', gols: 14, saldo: '+11' },
      scorers: [
        { name: 'Vinícius Júnior', goals: 5 },
        { name: 'Erling Haaland', goals: 4 },
        { name: 'Lautaro Martínez', goals: 3 },
        { name: 'Kylian Mbappé', goals: 2 },
      ],
      extras: {
        userPos: 1,
        nextRoundLabel: 'OITAVAS',
        fate: { kind: 'qualified-1st' },
      },
    }),
    [draft],
  )

  if (!features.dev) {
    return (
      <div
        className="d26-scope"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: 28,
            fontFamily: 'Space Mono',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--color-d-mut)',
            textAlign: 'center',
          }}
        >
          Modo dev desativado. Abra a URL com{' '}
          <code style={{ color: 'var(--color-d-lime)' }}>?dev=1</code> ou ligue o feature flag.
        </div>
      </div>
    )
  }

  return (
    <div className="d26-scope" style={{ minHeight: '100vh', padding: '40px 24px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1
          style={{
            fontFamily: 'Anton',
            fontSize: 36,
            marginBottom: 8,
            color: 'var(--color-d-ink)',
          }}
        >
          OUTCOME DRAWER · DEV
        </h1>
        <p
          style={{
            fontFamily: 'Space Mono',
            fontSize: 12,
            color: 'var(--color-d-mut)',
            marginBottom: 24,
          }}
        >
          Clique em qualquer botão pra abrir o drawer naquela variante. ESC ou clique no backdrop
          fecham.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 32,
          }}
        >
          {OUTCOMES.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setActive(kind)}
              style={{
                padding: '14px 12px',
                background: 'var(--color-d-surface)',
                color: 'var(--color-d-ink)',
                border: '1px solid var(--color-d-line)',
                borderRadius: 10,
                fontFamily: 'Anton',
                fontSize: 16,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {kind}
            </button>
          ))}
        </div>
        <div
          style={{
            padding: 16,
            background: 'var(--color-d-surface2)',
            border: '1px dashed var(--color-d-line)',
            borderRadius: 10,
            fontFamily: 'Space Mono',
            fontSize: 11,
            color: 'var(--color-d-mut)',
            lineHeight: 1.6,
          }}
        >
          Mock ctx: 6 jogos · 5W-1D-0L · +11 saldo · campanha fake só pra rodar o visual.
          <br />
          Pra atributos específicos da outcome ({'{'}fate, nextRoundLabel, userPos, penalties{'}'}),
          edite <code style={{ color: 'var(--color-d-lime)' }}>OutcomeDev.tsx</code>.
        </div>
      </div>
      {active && <OutcomeDrawer outcome={active} ctx={ctx} onClose={() => setActive(null)} />}
    </div>
  )
}
