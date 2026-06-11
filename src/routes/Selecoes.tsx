import { Link } from 'react-router-dom'
import { groupedSquads, type Squad } from '../data/squads'

export function Selecoes() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10">
        <p className="text-sm uppercase tracking-[0.18em] text-clay mb-3">Seleções</p>
        <h1 className="font-display text-4xl md:text-5xl tracking-tight text-ink mb-3">
          As 48 que disputam o verão de 2026
        </h1>
        <p className="text-ink-soft max-w-2xl">
          1.247 jogadores convocados, divididos em 12 grupos. Clique numa seleção
          pra ver elenco completo, posições, ratings e formação preferida do técnico.
        </p>
      </header>

      <div className="space-y-12">
        {groupedSquads.map(({ letter, squads }) => (
          <section key={letter}>
            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="font-display text-2xl text-ink">Grupo {letter}</h2>
              <span className="text-xs text-ink-soft">{squads.length} seleções</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {squads.map((s) => (
                <li key={s.code}>
                  <SquadCard squad={s} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-16 text-xs text-ink-soft border-t border-rule pt-6">
        Convocações via Wikipedia. Ratings e posições granulares do{' '}
        <a href="https://www.ea.com/games/ea-sports-fc" className="underline hover:text-ink">
          EA FC 26
        </a>{' '}
        (~71% dos jogadores no dataset — resto cai numa heurística marcada com{' '}
        <span className="text-clay">✦</span> na ficha).
      </p>
    </div>
  )
}

function SquadCard({ squad }: { squad: Squad }) {
  return (
    <Link
      to={`/teams/${squad.code.toLowerCase()}`}
      className="block rounded-lg border border-rule bg-paper p-4 hover:border-ink/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl leading-none">{squad.flag}</span>
        <span className="font-display text-2xl text-ink leading-none tabular-nums">
          {squad.averageOverall.toFixed(0)}
        </span>
      </div>
      <h3 className="font-display text-lg text-ink leading-tight mb-1">{squad.country}</h3>
      <p className="text-xs text-ink-soft mb-3 truncate">
        {squad.coach ?? '—'}
      </p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-soft">{squad.formation.primary}</span>
        <span className="text-ink-soft tabular-nums">{squad.players.length} jogadores</span>
      </div>
    </Link>
  )
}
