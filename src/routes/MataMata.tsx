import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BracketView } from '../components/BracketView'
import { KnockoutEliminationDrawer } from '../components/KnockoutEliminationDrawer'
import { ChampionDrawer } from '../components/ChampionDrawer'
import {
  nextUserMatch,
  ROUND_LABEL,
  setupBracket,
  type KnockoutBracket,
  type KORound,
} from '../lib/bracket'
import {
  clearBracket,
  loadBracket,
  loadStage,
  saveBracket,
} from '../lib/persistence'
import type { DraftState } from '../lib/draft'
import { syncRun, type FinishedRound } from '../lib/runs'

export function MataMata() {
  const navigate = useNavigate()
  const [bracket, setBracket] = useState<KnockoutBracket | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [missingStage, setMissingStage] = useState(false)
  const [showElim, setShowElim] = useState(false)
  const [showChamp, setShowChamp] = useState(false)

  useEffect(() => {
    const stageData = loadStage()
    if (!stageData) {
      setMissingStage(true)
      return
    }
    setDraft(stageData.draft)
    const existing = loadBracket()
    if (existing) {
      setBracket(existing)
      return
    }
    // primeira entrada: cria + simula o outro lado até a final
    const created = setupBracket(stageData.draft, stageData.stage.replacedTeam.code)
    saveBracket(created)
    setBracket(created)
  }, [])

  // Auto-abre drawer no estado terminal
  useEffect(() => {
    if (!bracket) return
    if (bracket.champion === bracket.userCode) setShowChamp(true)
    else if (bracket.matches.some((m) => m.winnerCode === bracket.userCode === false) && !nextUserMatch(bracket) && !bracket.champion) {
      // Eliminado mas o campeonato ainda não acabou (outro lado já tem finalista)
      // Esse caso fica pra próximo render, deixa o user clicar.
    }
  }, [bracket])

  // Mirror do bracket no Supabase a cada mudança
  useEffect(() => {
    if (!bracket) return
    const userChampion = bracket.champion === bracket.userCode
    const stillIn = nextUserMatch(bracket) != null
    let finishedRound: FinishedRound | undefined
    if (userChampion) {
      finishedRound = 'CHAMPION'
    } else if (!stillIn && !bracket.champion) {
      const lostMatch = [...bracket.matches].reverse().find(
        (m) =>
          m.winnerCode &&
          (m.homeCode === bracket.userCode || m.awayCode === bracket.userCode) &&
          m.winnerCode !== bracket.userCode,
      )
      if (lostMatch) finishedRound = lostMatch.round
    }
    void syncRun({ bracket, ...(finishedRound ? { finishedRound } : {}) })
  }, [bracket])

  if (missingStage) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-sm uppercase tracking-[0.18em] text-clay mb-3">Mata-mata</p>
        <h1 className="font-display text-3xl text-ink mb-3">Faltou a fase de grupos</h1>
        <p className="text-ink-soft mb-6">
          Você precisa terminar a fase de grupos antes de entrar no chaveamento.
        </p>
        <Link
          to="/draft"
          className="inline-flex items-center justify-center h-11 px-6 rounded-md bg-ink text-paper text-sm hover:bg-clay transition-colors"
        >
          Ir pro draft
        </Link>
      </div>
    )
  }

  if (!bracket || !draft) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-center text-ink-soft">Montando chave…</div>
  }

  const next = nextUserMatch(bracket)
  const userOut = !next && !bracket.champion
  const userChampion = bracket.champion === bracket.userCode

  const handleReset = () => {
    clearBracket()
    setBracket(null)
    const stageData = loadStage()!
    const created = setupBracket(stageData.draft, stageData.stage.replacedTeam.code)
    saveBracket(created)
    setBracket(created)
    setShowElim(false)
    setShowChamp(false)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-clay mb-1">Mata-mata</p>
          <h1 className="font-display text-3xl md:text-4xl tracking-tight text-ink">
            32 times. Eliminação direta.
          </h1>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded border border-rule text-ink-soft hover:border-ink hover:text-ink"
          >
            Refazer chave
          </button>
          <Link
            to="/copa"
            className="px-3 py-1.5 rounded border border-rule text-ink-soft hover:border-ink hover:text-ink"
          >
            ← Fase de grupos
          </Link>
        </div>
      </header>

      <StatusBanner
        bracket={bracket}
        next={next}
        userOut={userOut}
        userChampion={userChampion}
        onShowElim={() => setShowElim(true)}
        onShowChamp={() => setShowChamp(true)}
      />

      <BracketView bracket={bracket} />

      {next && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => navigate(`/copa/partida?kind=knockout&id=${next.id}`)}
            className="h-12 px-8 rounded-md bg-ink text-paper text-sm font-medium hover:bg-clay transition-colors"
          >
            Jogar {ROUND_LABEL[next.round as KORound]} →
          </button>
        </div>
      )}

      <KnockoutEliminationDrawer
        open={showElim}
        onClose={() => setShowElim(false)}
        bracket={bracket}
        draft={draft}
      />
      <ChampionDrawer
        open={showChamp}
        onClose={() => setShowChamp(false)}
        bracket={bracket}
        draft={draft}
      />
    </div>
  )
}

function StatusBanner({
  bracket,
  next,
  userOut,
  userChampion,
  onShowElim,
  onShowChamp,
}: {
  bracket: KnockoutBracket
  next: ReturnType<typeof nextUserMatch>
  userOut: boolean
  userChampion: boolean
  onShowElim: () => void
  onShowChamp: () => void
}) {
  if (userChampion) {
    return (
      <button
        type="button"
        onClick={onShowChamp}
        className="block w-full text-left border-2 border-clay rounded-lg p-5 mb-6 bg-clay-soft/40 hover:bg-clay-soft/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">🏆</div>
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.18em] text-clay mb-1">Campeão</p>
            <h2 className="font-display text-2xl text-ink">
              Seu XI levantou a taça no MetLife.
            </h2>
          </div>
          <span className="text-xs text-clay">ver detalhes →</span>
        </div>
      </button>
    )
  }
  if (userOut) {
    const lastUserMatch = [...bracket.matches]
      .reverse()
      .find(
        (m) =>
          m.winnerCode &&
          (m.homeCode === bracket.userCode || m.awayCode === bracket.userCode) &&
          m.winnerCode !== bracket.userCode,
      )
    return (
      <button
        type="button"
        onClick={onShowElim}
        className="block w-full text-left border border-rule rounded-lg p-5 mb-6 bg-sand/40 hover:bg-sand transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-clay mb-1">Eliminado</p>
            <h2 className="font-display text-xl text-ink">
              Seu XI parou nas{' '}
              {lastUserMatch ? ROUND_LABEL[lastUserMatch.round as KORound] : 'eliminatórias'}.
            </h2>
          </div>
          <span className="text-xs text-ink-soft">ver desempenho →</span>
        </div>
      </button>
    )
  }
  if (next) {
    const home = next.homeCode ? bracket.teams[next.homeCode] : null
    const away = next.awayCode ? bracket.teams[next.awayCode] : null
    const opp = home?.isUser ? away : home
    return (
      <div className="border border-rule rounded-lg p-5 mb-6 bg-paper">
        <p className="text-xs uppercase tracking-[0.18em] text-clay mb-1">
          Próximo jogo · {ROUND_LABEL[next.round as KORound]}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <span className="text-ink">vs</span>
          <span className="text-2xl">{opp?.flag}</span>
          <span className="font-display text-xl text-ink">{opp?.name}</span>
          <span className="text-xs text-ink-soft tabular-nums ml-2">
            OVR {opp?.averageOverall.toFixed(1)}
          </span>
        </div>
      </div>
    )
  }
  return null
}
