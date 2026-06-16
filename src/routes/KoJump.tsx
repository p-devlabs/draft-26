/**
 * /dev/ko-jump — bootstrap rápido pra testar UI de mata-mata.
 *
 * Monta um XI auto-preenchido, simula a fase de grupos inteira, gera o
 * bracket e redireciona pro jogo do user em R32 com `dev_force`
 * (et|pks) opcional. Aceita `?p=top|hero` repassado pro Match.
 *
 * Não interfere em produção: gated por features.dev. Se o user não se
 * classificar no draft random (raro com 4-3-3 + autofill), tenta seeds
 * sequenciais até encontrar uma campanha que classifica.
 */
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Loading } from '../components/match/PartidaShell'
import { autoFillXI } from '../lib/autofill'
import { setupBracket } from '../lib/bracket'
import { createDraft } from '../lib/draft'
import { features } from '../lib/features'
import {
  createWorldCup,
  playCpuRound,
  playRound,
  setUserGroup,
  userGroup as getUserGroup,
  USER_TEAM_CODE,
} from '../lib/groups'
import { saveBracket, saveDraft, saveWorldCup } from '../lib/persistence'
import { seededRng } from '../lib/simulate'

export function KoJump() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const force = params.get('force') // 'et' | 'pks'
  const p = params.get('p') // 'top' | 'hero'

  useEffect(() => {
    if (!features.dev) {
      navigate('/', { replace: true })
      return
    }

    // Tenta seeds até achar uma onde o user classifica em 1º ou 2º.
    // Limite de 50 pra não travar; na prática classifica nas primeiras.
    for (let seed = 1; seed < 50; seed++) {
      const rng = seededRng(seed)
      const draft = autoFillXI(createDraft('4-3-3', 'equilibrado', 'easy'))
      let wc = createWorldCup(draft, rng)
      for (const round of [1, 2, 3] as const) {
        const ug = playRound(getUserGroup(wc), round, draft, rng)
        wc = setUserGroup(wc, ug)
        wc = playCpuRound(wc, round, rng)
      }
      const bracket = setupBracket(wc, rng)
      const userR32 = bracket.matches.find(
        (m) =>
          m.round === 'R32' && (m.homeCode === USER_TEAM_CODE || m.awayCode === USER_TEAM_CODE),
      )
      if (!userR32) continue

      // Persiste e redireciona.
      saveDraft(draft)
      saveWorldCup(draft, wc)
      saveBracket(bracket)
      const qs = new URLSearchParams()
      qs.set('kind', 'knockout')
      qs.set('id', userR32.id)
      if (force === 'et' || force === 'pks') qs.set('dev_force', force)
      if (p === 'top' || p === 'hero') qs.set('p', p)
      navigate(`/match?${qs.toString()}`, { replace: true })
      return
    }
    // Caso degenerado: nenhum seed classificou.
    navigate('/', { replace: true })
  }, [navigate, force, p])

  return <Loading />
}
