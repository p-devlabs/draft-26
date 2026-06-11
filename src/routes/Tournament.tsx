import { useParams } from 'react-router-dom'

export function Tournament() {
  const { id } = useParams()
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-sm uppercase tracking-[0.18em] text-clay mb-4">Torneio</p>
      <h1 className="font-display text-4xl text-ink mb-4">
        {id === 'novo' ? 'Sorteando sua seleção…' : `Torneio #${id}`}
      </h1>
      <p className="text-ink-soft">
        Em construção. Aqui vai entrar o draft de seleção, a montagem do XI e a simulação.
      </p>
    </div>
  )
}
