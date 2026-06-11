import type { GroupMatch, GroupTeam } from '../lib/groups'

interface MatchCardProps {
  match: GroupMatch
  home: GroupTeam
  away: GroupTeam
  highlight?: boolean
  isCurrent?: boolean
  isFuture?: boolean
  onPlay?: () => void
}

export function MatchCard({
  match,
  home,
  away,
  highlight,
  isCurrent,
  isFuture,
  onPlay,
}: MatchCardProps) {
  const played = match.result != null
  const homeWon = played && match.result!.homeGoals > match.result!.awayGoals
  const awayWon = played && match.result!.homeGoals < match.result!.awayGoals

  return (
    <div
      className={`border rounded-md p-3 transition-colors
        ${highlight ? 'border-ink' : 'border-rule'}
        ${isFuture ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-ink-soft mb-2">
        <span>Rodada {match.round}</span>
        {isCurrent && <span className="text-clay">Próximo jogo</span>}
        {played && <span>Final</span>}
      </div>
      <div className="flex items-center gap-3">
        <TeamSide team={home} side="home" winner={homeWon} />
        <div className="text-center min-w-[60px]">
          {played ? (
            <div className="font-display text-2xl text-ink tabular-nums">
              {match.result!.homeGoals}{' '}
              <span className="text-ink-soft">×</span>{' '}
              {match.result!.awayGoals}
            </div>
          ) : (
            <div className="text-ink-soft text-sm">vs</div>
          )}
        </div>
        <TeamSide team={away} side="away" winner={awayWon} />
      </div>
      {isCurrent && onPlay && (
        <button
          type="button"
          onClick={onPlay}
          className="mt-3 w-full h-9 rounded-md bg-ink text-paper text-sm font-medium hover:bg-clay transition-colors"
        >
          Jogar partida
        </button>
      )}
    </div>
  )
}

function TeamSide({
  team,
  side,
  winner,
}: {
  team: GroupTeam
  side: 'home' | 'away'
  winner: boolean
}) {
  return (
    <div className={`flex items-center gap-2 flex-1 ${side === 'away' ? 'flex-row-reverse text-right' : ''}`}>
      <span className="text-2xl">{team.flag}</span>
      <div className="min-w-0">
        <div className={`text-sm truncate ${winner ? 'text-ink font-medium' : 'text-ink'}`}>
          {team.name}
        </div>
        <div className="text-[10px] text-ink-soft tabular-nums">{team.averageOverall.toFixed(1)}</div>
      </div>
    </div>
  )
}
