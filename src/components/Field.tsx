import type { DraftSlot } from '../lib/draft'

interface FieldProps {
  slots: DraftSlot[]
  onSlotClick: (index: number) => void
}

export function Field({ slots, onSlotClick }: FieldProps) {
  return (
    <div className="relative aspect-[2/3] max-w-md mx-auto rounded-xl overflow-hidden bg-moss/85 border border-rule shadow-inner">
      <FieldMarkings />
      {slots.map((slot, i) => {
        // Inverter Y: y=0 (defesa) renderiza embaixo, y=100 (ataque) renderiza em cima
        const top = 100 - slot.y
        const left = slot.x
        return (
          <button
            key={i}
            type="button"
            onClick={() => !slot.player && onSlotClick(i)}
            style={{ top: `${top}%`, left: `${left}%`, transform: 'translate(-50%, -50%)' }}
            className="absolute"
            aria-label={slot.player ? `${slot.pos}: ${slot.player.player.name}` : `${slot.pos}: vazio`}
          >
            {slot.player ? <FilledSlot slot={slot} /> : <EmptySlot pos={slot.pos} />}
          </button>
        )
      })}
    </div>
  )
}

function EmptySlot({ pos }: { pos: string }) {
  return (
    <div className="flex flex-col items-center group">
      <div className="w-10 h-10 rounded-full bg-paper/95 border-2 border-dashed border-ink/30
        flex items-center justify-center text-xl text-ink/60
        group-hover:border-ink group-hover:scale-110 group-hover:text-ink transition-all">
        +
      </div>
      <span className="mt-1 text-[10px] font-mono text-paper/90 tracking-wider">{pos}</span>
    </div>
  )
}

function FilledSlot({ slot }: { slot: DraftSlot }) {
  const p = slot.player!
  // pega último sobrenome pra display compacto
  const display = lastName(p.player.name)
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="w-12 h-12 rounded-full bg-paper border-2 border-ink/80
          flex items-center justify-center text-lg shadow-md">
          {p.countryFlag}
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-clay text-paper
          text-[11px] font-bold flex items-center justify-center tabular-nums shadow">
          {p.player.overall}
        </div>
      </div>
      <span className="mt-1 px-1.5 py-0.5 rounded bg-ink/85 text-paper text-[10px] font-medium tracking-tight max-w-[80px] truncate">
        {display}
      </span>
    </div>
  )
}

function lastName(full: string): string {
  const parts = full.trim().split(/\s+/)
  return parts[parts.length - 1]
}

function FieldMarkings() {
  // SVG simples de linhas do campo
  return (
    <svg
      viewBox="0 0 100 150"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    >
      <g fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.35">
        {/* borda */}
        <rect x="2" y="2" width="96" height="146" />
        {/* linha do meio */}
        <line x1="2" y1="75" x2="98" y2="75" />
        <circle cx="50" cy="75" r="9" />
        <circle cx="50" cy="75" r="0.6" fill="rgba(255,255,255,0.35)" />
        {/* grande área de cima (ataque adversário) */}
        <rect x="22" y="2" width="56" height="20" />
        <rect x="36" y="2" width="28" height="8" />
        {/* grande área de baixo (defesa) */}
        <rect x="22" y="128" width="56" height="20" />
        <rect x="36" y="140" width="28" height="8" />
      </g>
    </svg>
  )
}
