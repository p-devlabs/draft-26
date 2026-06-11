import { Link, useParams } from 'react-router-dom'
import { findSquad, POSITION_LABEL, playerValue, type Player, type Position } from '../data/squads'

function formatValue(eur: number | null | undefined): string {
  if (!eur || eur <= 0) return '—'
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(eur >= 10_000_000 ? 0 : 1)}M`
  if (eur >= 1_000) return `€${Math.round(eur / 1_000)}K`
  return `€${eur}`
}

const POSITION_ORDER: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 }

export function SelecaoDetalhe() {
  const { code } = useParams<{ code: string }>()
  const squad = code ? findSquad(code) : undefined

  if (!squad) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-clay mb-3">404</p>
        <h1 className="font-display text-3xl text-ink mb-3">Seleção não encontrada</h1>
        <p className="text-ink-soft mb-6">
          O código <code className="font-mono text-ink">{code}</code> não bate com nenhuma das 48 seleções.
        </p>
        <Link to="/teams" className="text-clay hover:underline">
          ← Ver todas as seleções
        </Link>
      </div>
    )
  }

  const grouped = (['GK', 'DEF', 'MID', 'FWD'] as Position[]).map((pos) => ({
    position: pos,
    players: [...squad.players]
      .filter((p) => p.position === pos)
      .sort((a, b) => (a.shirt ?? 99) - (b.shirt ?? 99)),
  }))

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-3">
        <Link to="/teams" className="text-xs text-ink-soft hover:text-ink">
          ← Todas as seleções
        </Link>
      </div>

      <header className="border-b border-rule pb-8 mb-8">
        <div className="flex items-start gap-6">
          <span className="text-6xl leading-none">{squad.flag}</span>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.18em] text-clay mb-2">
              Grupo {squad.group} · {squad.code}
            </p>
            <h1 className="font-display text-4xl md:text-5xl tracking-tight text-ink mb-2">
              {squad.country}
            </h1>
            <p className="text-ink-soft">
              Técnico: <span className="text-ink">{squad.coach ?? '—'}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-1">Rating médio</p>
            <p className="font-display text-5xl text-ink tabular-nums leading-none">
              {squad.averageOverall.toFixed(1)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 pt-6 border-t border-rule/60">
          <Stat label="Convocados" value={squad.players.length.toString()} />
          <Stat label="Formação base" value={squad.formation.primary} />
          <Stat label="Formação alt" value={squad.formation.alternative} />
          <Stat
            label="Curadoria tática"
            value={squad.formation.source === 'curated' ? 'Manual' : 'Default 4-3-3'}
            soft={squad.formation.source === 'default'}
          />
        </div>
      </header>

      <div className="space-y-8">
        {grouped.map(({ position, players }) => (
          <section key={position}>
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="font-display text-xl text-ink">{POSITION_LABEL[position]}</h2>
              <span className="text-xs text-ink-soft tabular-nums">{players.length}</span>
            </div>
            <PlayerTable players={players} />
          </section>
        ))}
      </div>

      <p className="mt-12 text-xs text-ink-soft border-t border-rule pt-6">
        Ratings e posições do EA FC 26 (via{' '}
        <a href="https://github.com/ismailoksuz/EAFC26-DataHub" className="underline hover:text-ink">
          EAFC26-DataHub
        </a>
        ); valor de mercado complementado pelo{' '}
        <a href="https://github.com/dcaribou/transfermarkt-datasets" className="underline hover:text-ink">
          Transfermarkt
        </a>
        . Jogadores não encontrados no EA FC (Irã, Jordânia e outros menos cobertos) usam
        heurística — marcados com <span className="text-clay">✦</span>. Formações curadas
        manualmente para as principais seleções; demais herdam{' '}
        <code className="font-mono">4-3-3</code> como padrão.
      </p>
    </div>
  )
}

function Stat({ label, value, soft }: { label: string; value: string; soft?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-ink-soft mb-1">{label}</p>
      <p className={`font-display text-lg ${soft ? 'text-ink-soft' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

function PlayerTable({ players }: { players: Player[] }) {
  return (
    <div className="overflow-hidden border border-rule rounded-md">
      <table className="w-full text-sm">
        <thead className="bg-sand/60 text-xs uppercase tracking-[0.1em] text-ink-soft">
          <tr>
            <th className="text-left px-3 py-2 w-12">#</th>
            <th className="text-left px-3 py-2 w-20">Pos</th>
            <th className="text-left px-3 py-2">Jogador</th>
            <th className="text-left px-3 py-2 hidden md:table-cell">Clube</th>
            <th className="text-right px-3 py-2 w-16 hidden lg:table-cell">Idade</th>
            <th className="text-right px-3 py-2 w-20 hidden md:table-cell">Valor</th>
            <th className="text-right px-3 py-2 w-16">Rating</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {players.sort((a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position]).map((p) => (
            <tr key={`${p.name}-${p.shirt ?? 'x'}`} className="hover:bg-sand/40">
              <td className="px-3 py-2 tabular-nums text-ink-soft">{p.shirt ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {p.primaryPosition ? (
                  <>
                    <span className="text-ink">{p.primaryPosition}</span>
                    {p.altPositions && p.altPositions.length > 0 && (
                      <span className="text-ink-soft">·{p.altPositions.join('·')}</span>
                    )}
                  </>
                ) : (
                  <span className="text-ink-soft">{p.position}</span>
                )}
              </td>
              <td className="px-3 py-2">
                <span className="text-ink">{p.name}</span>
                {p.isCaptain && (
                  <span className="ml-2 inline-block text-[10px] uppercase tracking-wider text-clay border border-clay/30 rounded px-1 py-px">
                    cap
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-ink-soft hidden md:table-cell truncate max-w-xs">{p.club}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-soft hidden lg:table-cell">{p.age ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-soft hidden md:table-cell">
                <div className="text-ink text-xs">{formatValue(playerValue(p))}</div>
                {p.value_eur != null && p.value_eur_tm != null && p.value_eur !== p.value_eur_tm && (
                  <div className="text-[10px] text-ink-soft/70">
                    TM {formatValue(p.value_eur_tm)}
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium text-ink">
                {p.overall}
                {p.ratingSource === 'heuristic' && (
                  <span className="text-clay ml-0.5" title="Não encontrado no dataset EA FC 26 — overall heurístico">
                    ✦
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
