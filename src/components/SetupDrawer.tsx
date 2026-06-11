import { useState } from 'react'
import { Drawer } from './Drawer'
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
  const [formationName, setFormationName] = useState<string | null>(null)
  const [style, setStyle] = useState<Style | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty | null>('medium')

  const canStart = formationName != null && style != null && difficulty != null

  return (
    <Drawer open={open} onClose={() => {}} locked>
      <div className="px-6 pb-8 pt-2 max-w-2xl mx-auto">
        <p className="text-sm uppercase tracking-[0.18em] text-clay mb-2">Antes de começar</p>
        <h2 className="font-display text-3xl text-ink mb-1">Tática e estilo</h2>
        <p className="text-ink-soft text-sm mb-8">
          Define a forma do seu XI e como o time vai se comportar.
          Depois disso, é jogador por jogador.
        </p>

        <fieldset className="mb-8">
          <legend className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-3">
            Formação
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {FORMATION_OPTIONS.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => setFormationName(f.name)}
                className={`text-left p-4 rounded-lg border transition-all
                  ${
                    formationName === f.name
                      ? 'border-ink bg-sand'
                      : 'border-rule hover:border-ink/40 bg-paper'
                  }`}
              >
                <div className="font-display text-xl text-ink mb-1 tabular-nums">{f.name}</div>
                <div className="text-xs text-ink-soft leading-snug">{f.description}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-8">
          <legend className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-3">
            Estilo de jogo
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={`text-left p-3 rounded-lg border transition-all
                  ${
                    style === s.id
                      ? 'border-ink bg-sand'
                      : 'border-rule hover:border-ink/40 bg-paper'
                  }`}
              >
                <div className="font-display text-base text-ink mb-1">{s.label}</div>
                <div className="text-[11px] text-ink-soft leading-snug">{s.description}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-8">
          <legend className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-3">
            Dificuldade
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDifficulty(d.id)}
                className={`text-left p-3 rounded-lg border transition-all
                  ${
                    difficulty === d.id
                      ? 'border-ink bg-sand'
                      : 'border-rule hover:border-ink/40 bg-paper'
                  }`}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-display text-base text-ink">{d.label}</span>
                  <span className="text-[10px] font-mono text-ink-soft">
                    {d.skips} skip{d.skips === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="text-[11px] text-ink-soft leading-snug">{d.description}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          disabled={!canStart}
          onClick={() => canStart && onStart(formationName!, style!, difficulty!)}
          className="w-full h-12 rounded-md bg-ink text-paper font-medium text-sm hover:bg-clay
            disabled:bg-rule disabled:text-ink-soft disabled:cursor-not-allowed
            transition-colors"
        >
          {canStart ? 'Começar o draft' : 'Escolha formação, estilo e dificuldade'}
        </button>
      </div>
    </Drawer>
  )
}
