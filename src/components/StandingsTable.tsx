import type { Standing } from '../lib/groups'

interface StandingsTableProps {
  standings: Standing[]
}

export function StandingsTable({ standings }: StandingsTableProps) {
  return (
    <div className="overflow-hidden border border-rule rounded-md">
      <table className="w-full text-sm">
        <thead className="bg-sand/60 text-xs uppercase tracking-[0.1em] text-ink-soft">
          <tr>
            <th className="text-left px-2 py-2 w-6">#</th>
            <th className="text-left px-2 py-2">Time</th>
            <th className="text-right px-2 py-2 w-10">Pts</th>
            <th className="text-right px-2 py-2 w-8 hidden sm:table-cell">J</th>
            <th className="text-right px-2 py-2 w-8 hidden sm:table-cell">V</th>
            <th className="text-right px-2 py-2 w-8 hidden sm:table-cell">E</th>
            <th className="text-right px-2 py-2 w-8 hidden sm:table-cell">D</th>
            <th className="text-right px-2 py-2 w-10">GP</th>
            <th className="text-right px-2 py-2 w-10">GC</th>
            <th className="text-right px-2 py-2 w-10">SG</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {standings.map((s, i) => {
            const sg = s.goalsFor - s.goalsAgainst
            const qualifies = i < 2
            return (
              <tr
                key={s.team.code}
                className={`${s.team.isUser ? 'bg-clay-soft/50 font-medium' : ''} hover:bg-sand/40`}
              >
                <td className="px-2 py-2 text-ink-soft tabular-nums">
                  <span className={qualifies ? 'text-moss font-bold' : ''}>{i + 1}</span>
                </td>
                <td className="px-2 py-2">
                  <span className="text-xl mr-2 align-middle">{s.team.flag}</span>
                  <span className="text-ink">{s.team.name}</span>
                </td>
                <td className="px-2 py-2 text-right font-display text-base text-ink tabular-nums">
                  {s.points}
                </td>
                <td className="px-2 py-2 text-right text-ink-soft tabular-nums hidden sm:table-cell">
                  {s.played}
                </td>
                <td className="px-2 py-2 text-right text-ink-soft tabular-nums hidden sm:table-cell">
                  {s.wins}
                </td>
                <td className="px-2 py-2 text-right text-ink-soft tabular-nums hidden sm:table-cell">
                  {s.draws}
                </td>
                <td className="px-2 py-2 text-right text-ink-soft tabular-nums hidden sm:table-cell">
                  {s.losses}
                </td>
                <td className="px-2 py-2 text-right text-ink-soft tabular-nums">{s.goalsFor}</td>
                <td className="px-2 py-2 text-right text-ink-soft tabular-nums">
                  {s.goalsAgainst}
                </td>
                <td
                  className={`px-2 py-2 text-right tabular-nums ${
                    sg > 0 ? 'text-moss' : sg < 0 ? 'text-clay' : 'text-ink-soft'
                  }`}
                >
                  {sg > 0 ? '+' : ''}
                  {sg}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
