import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MatchCard } from '../components/MatchCard'
import { StandingsTable } from '../components/StandingsTable'
import { EliminationDrawer } from '../components/EliminationDrawer'
import { features } from '../lib/features'
import {
  createGroupStage,
  findTeam,
  nextRound,
  parallelMatches,
  standings,
  userMatches,
  USER_TEAM_CODE,
  type GroupStage,
} from '../lib/groups'
import { autoFillXI } from '../lib/autofill'
import { createDraft, isComplete, type DraftState } from '../lib/draft'
import { loadDraft, saveStage, loadStage, clearStage } from '../lib/persistence'
import { createRun, syncRun, clearLocalRunId } from '../lib/runs'

export function Copa() {
  const navigate = useNavigate()
  const [stage, setStage] = useState<GroupStage | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [showElim, setShowElim] = useState(false)

  useEffect(() => {
    const persisted = loadStage()
    if (persisted) {
      setStage(persisted.stage)
      setDraft(persisted.draft)
      return
    }

    const fromDraft = loadDraft()
    if (fromDraft && isComplete(fromDraft)) {
      const newStage = createGroupStage(fromDraft)
      setStage(newStage)
      setDraft(fromDraft)
      saveStage(fromDraft, newStage)
      void createRun({ draft: fromDraft, stage: newStage })
      return
    }

    // demo mode: gera um XI automaticamente
    const isDemo =
      new URLSearchParams(window.location.search).get('demo') === '1' || features.dev
    if (isDemo) {
      const demoDraft = autoFillXI(createDraft('4-3-3', 'equilibrado', 'medium'))
      const newStage = createGroupStage(demoDraft)
      setStage(newStage)
      setDraft(demoDraft)
      saveStage(demoDraft, newStage)
      void createRun({ draft: demoDraft, stage: newStage })
      return
    }

    navigate('/draft', { replace: true })
  }, [navigate])

  // Mirror do stage no Supabase a cada mudança (fire-and-forget; localStorage é fonte primária)
  useEffect(() => {
    if (!stage) return
    const finishedNow = nextRound(stage) == null
    if (!finishedNow) {
      void syncRun({ stage })
      return
    }
    const sorted = standings(stage)
    const userPos = sorted.findIndex((s) => s.team.isUser) + 1
    const qualified = userPos > 0 && userPos <= 2
    void syncRun({
      stage,
      ...(qualified ? {} : { finishedRound: 'group' as const }),
    })
  }, [stage])

  if (!stage || !draft) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center text-ink-soft">
        Carregando fase de grupos…
      </div>
    )
  }

  const round = nextRound(stage)
  const finished = round == null
  const userM = userMatches(stage)
  const otherM = parallelMatches(stage)

  const handlePlay = (matchRound: 1 | 2 | 3) => {
    saveStage(draft, stage)
    navigate(`/copa/partida?round=${matchRound}`)
  }

  const handleReset = () => {
    clearStage()
    clearLocalRunId()
    navigate('/draft', { replace: true })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[0.18em] text-clay mb-2">
          Fase de grupos · Grupo {stage.letter}
        </p>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight text-ink mb-2">
          Seu XI substituiu {stage.replacedTeam.flag} {stage.replacedTeam.name}
        </h1>
        <p className="text-ink-soft text-sm">
          Três jogos pra decidir se você avança. Top 2 vão pro mata-mata.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="font-display text-xl text-ink mb-3">Classificação</h2>
        <StandingsTable standings={standings(stage)} />
        <p className="text-[11px] text-ink-soft mt-2">
          <span className="text-moss font-bold">1, 2</span> avançam · 3º vai pra fase de play-in (não implementada)
        </p>
      </section>

      <div className="grid md:grid-cols-2 gap-10">
        <section>
          <h2 className="font-display text-xl text-ink mb-3">Seus jogos</h2>
          <div className="space-y-3">
            {userM.map((m) => {
              const home = findTeam(stage, m.homeCode)!
              const away = findTeam(stage, m.awayCode)!
              const isPlayed = m.result != null
              const isCurrent = !isPlayed && m.round === round
              const isFuture = !isPlayed && !isCurrent
              return (
                <MatchCard
                  key={`${m.round}-${m.homeCode}-${m.awayCode}`}
                  match={m}
                  home={home}
                  away={away}
                  highlight={
                    home.code === USER_TEAM_CODE || away.code === USER_TEAM_CODE
                  }
                  isCurrent={isCurrent}
                  isFuture={isFuture}
                  onPlay={isCurrent ? () => handlePlay(m.round) : undefined}
                />
              )
            })}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-ink mb-3">Outros jogos do grupo</h2>
          <div className="space-y-3">
            {otherM.map((m) => {
              const home = findTeam(stage, m.homeCode)!
              const away = findTeam(stage, m.awayCode)!
              const isPlayed = m.result != null
              const isFuture = !isPlayed && m.round !== round
              return (
                <MatchCard
                  key={`${m.round}-${m.homeCode}-${m.awayCode}`}
                  match={m}
                  home={home}
                  away={away}
                  isFuture={isFuture}
                />
              )
            })}
          </div>
        </section>
      </div>

      {finished && (() => {
        const sorted = standings(stage)
        const userPos = sorted.findIndex((s) => s.team.isUser) + 1
        const qualified = userPos > 0 && userPos <= 2
        return (
          <div className="mt-10 border-t border-rule pt-8 text-center">
            <p className="text-sm uppercase tracking-[0.18em] text-clay mb-2">
              {qualified ? 'Classificado' : 'Eliminado'}
            </p>
            <h3 className="font-display text-3xl text-ink mb-2">
              {userPos === 1
                ? 'Primeiro lugar no grupo 🏆'
                : userPos === 2
                  ? 'Segundo lugar — vai pro mata-mata'
                  : `${userPos}º lugar — parou na fase de grupos`}
            </h3>
            <p className="text-sm text-ink-soft mb-6 max-w-md mx-auto">
              {qualified
                ? 'Próximo passo: 16 avos. O mata-mata é eliminação direta.'
                : 'Olhe o que aconteceu nos três jogos e prepare-se pro próximo draft.'}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              {qualified ? (
                <button
                  type="button"
                  onClick={() => navigate('/mata-mata')}
                  className="h-12 px-8 rounded-md bg-ink text-paper text-sm font-medium hover:bg-clay transition-colors"
                >
                  Avançar pro mata-mata →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowElim(true)}
                  className="h-12 px-8 rounded-md bg-ink text-paper text-sm font-medium hover:bg-clay transition-colors"
                >
                  Ver desempenho
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="h-12 px-6 rounded-md border border-rule text-ink text-sm hover:bg-sand transition-colors"
              >
                Novo draft
              </button>
            </div>
            <EliminationDrawer
              open={showElim}
              onClose={() => setShowElim(false)}
              draft={draft}
              stage={stage}
            />
          </div>
        )
      })()}
    </div>
  )
}
