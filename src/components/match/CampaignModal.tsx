/**
 * Modal aninhada — campanha do XI na Copa: só os jogos onde o usuário
 * entrou em campo (fase de grupos + mata-mata), com placar e W/D/L.
 *
 * Lê de `loadWorldCup()` + `loadBracket()` direto do localStorage — bate
 * com o que o drawer já mostra (esses são os dados autoritativos do run).
 * Fallback: link pra rota original (`/groups`) se a leitura falhar.
 */
import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'

import { ROUND_LABEL, userPath, type BracketMatch, type KnockoutBracket } from '../../lib/bracket'
import { USER_TEAM_CODE, userGroup, userMatches, type GroupTeam } from '../../lib/groups'
import { nationGradient } from '../../lib/nation-colors'
import { loadBracket, loadWorldCup } from '../../lib/persistence'

import { NestedModalShell } from './LineupModal'

interface Props {
  title: string
  /** Fallback se o localStorage não tem os dados (ex.: foi limpo). */
  fallbackTo: string
  onClose: () => void
}

type Outcome = 'W' | 'D' | 'L' | 'P'

interface MatchRow {
  id: string
  roundLabel: string
  oppCode: string
  oppName: string
  /** Placar do user (gols pró/contra) ou null se ainda não jogou. */
  score: { userGoals: number; oppGoals: number } | null
  /** Indica se a partida foi decidida nos pênaltis (KO). */
  decidedOnPens: boolean
  /** Placar da disputa de pênaltis na perspectiva do user, se houve. */
  pens: { userScored: number; oppScored: number } | null
  outcome: Outcome
}

export function CampaignModal({ title, fallbackTo, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onClose])

  const rows = useMemo(() => collectMatches(), [])

  if (rows.length === 0) {
    return (
      <NestedModalShell title={title} onClose={onClose}>
        <FallbackBody fallbackTo={fallbackTo} onClose={onClose} />
      </NestedModalShell>
    )
  }

  return (
    <NestedModalShell title={title} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row) => (
          <Row key={row.id} row={row} />
        ))}
      </div>
    </NestedModalShell>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Coleta dos jogos do user
// ────────────────────────────────────────────────────────────────────────

function collectMatches(): MatchRow[] {
  const wc = safeLoadWorldCup()
  const br = safeLoadBracket()
  const rows: MatchRow[] = []

  if (wc) {
    const stage = userGroup(wc.worldCup)
    const teamByCode = new Map<string, GroupTeam>(stage.teams.map((t) => [t.code, t]))
    const groupMatches = userMatches(stage)
    for (const m of groupMatches) {
      const userIsHome = m.homeCode === USER_TEAM_CODE
      const oppCode = userIsHome ? m.awayCode : m.homeCode
      const opp = teamByCode.get(oppCode)
      const score = m.result
        ? userIsHome
          ? { userGoals: m.result.homeGoals, oppGoals: m.result.awayGoals }
          : { userGoals: m.result.awayGoals, oppGoals: m.result.homeGoals }
        : null
      rows.push({
        id: `G-R${m.round}-${oppCode}`,
        roundLabel: `RODADA ${m.round}`,
        oppCode,
        oppName: opp?.name ?? oppCode,
        score,
        decidedOnPens: false,
        pens: null,
        outcome: groupOutcome(score),
      })
    }
  }

  if (br) {
    const koMatches = userPath(br)
    for (const m of koMatches) {
      const userIsHome = m.homeCode === br.userCode
      const oppCode = (userIsHome ? m.awayCode : m.homeCode) ?? ''
      const oppName = oppCode ? (br.teams[oppCode]?.name ?? oppCode) : '—'
      const score = composeKoScore(m, userIsHome)
      const pens = m.penalties
        ? userIsHome
          ? { userScored: m.penalties.homeScored, oppScored: m.penalties.awayScored }
          : { userScored: m.penalties.awayScored, oppScored: m.penalties.homeScored }
        : null
      rows.push({
        id: m.id,
        roundLabel: ROUND_LABEL[m.round].toUpperCase(),
        oppCode,
        oppName,
        score,
        decidedOnPens: Boolean(m.penalties),
        pens,
        outcome: koOutcome(m, br),
      })
    }
  }

  return rows
}

function safeLoadWorldCup() {
  try {
    return loadWorldCup()
  } catch {
    return null
  }
}

function safeLoadBracket(): KnockoutBracket | null {
  try {
    return loadBracket()
  } catch {
    return null
  }
}

function composeKoScore(m: BracketMatch, userIsHome: boolean): MatchRow['score'] {
  if (!m.result) return null
  // Mata-mata: soma 90' + prorrogação se houve, ignorando pênaltis (mostrados
  // separados). Mantém a mesma lógica do MataMata.tsx pra placar exibido.
  const homeGoals = m.result.homeGoals + (m.extraTime?.homeGoals ?? 0)
  const awayGoals = m.result.awayGoals + (m.extraTime?.awayGoals ?? 0)
  return userIsHome
    ? { userGoals: homeGoals, oppGoals: awayGoals }
    : { userGoals: awayGoals, oppGoals: homeGoals }
}

function groupOutcome(score: MatchRow['score']): Outcome {
  if (!score) return 'P'
  if (score.userGoals > score.oppGoals) return 'W'
  if (score.userGoals < score.oppGoals) return 'L'
  return 'D'
}

function koOutcome(m: BracketMatch, br: KnockoutBracket): Outcome {
  if (!m.winnerCode) return 'P'
  return m.winnerCode === br.userCode ? 'W' : 'L'
}

// ────────────────────────────────────────────────────────────────────────
// Render
// ────────────────────────────────────────────────────────────────────────

function Row({ row }: { row: MatchRow }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 12px',
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 11,
      }}
    >
      <RoundChip label={row.roundLabel} />
      <CountryPill code={row.oppCode} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'Anton',
            fontSize: 15,
            color: 'var(--color-d-ink)',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {row.oppName.toUpperCase()}
        </div>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 9,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.08em',
            marginTop: 2,
          }}
        >
          {row.decidedOnPens && row.pens
            ? `PÊNALTIS ${row.pens.userScored}–${row.pens.oppScored}`
            : row.score
              ? 'TEMPO REGULAMENTAR'
              : 'AINDA NÃO JOGADO'}
        </div>
      </div>
      <ScoreCell score={row.score} outcome={row.outcome} />
      <OutcomePill outcome={row.outcome} />
    </div>
  )
}

function RoundChip({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: 'Space Mono',
        fontSize: 9,
        color: 'var(--color-d-mut)',
        letterSpacing: '0.1em',
        fontWeight: 700,
        textTransform: 'uppercase',
        width: 64,
        flex: '0 0 auto',
        lineHeight: 1.15,
      }}
    >
      {label}
    </div>
  )
}

/**
 * Pílula bandeira+sigla (mesmo padrão hardened do BadgeChip de Copa, PR #58:
 * backgroundClip:padding-box + borda translúcida 1px + overflow:hidden).
 */
function CountryPill({ code }: { code: string }) {
  const c = (code ?? '').toUpperCase()
  return (
    <div
      role="img"
      aria-label={c || 'PENDENTE'}
      style={{
        width: 30,
        height: 22,
        flex: '0 0 auto',
        borderRadius: 5,
        background: c ? nationGradient(c) : 'var(--color-d-surface)',
        backgroundClip: 'padding-box',
        border: '1px solid rgba(255,255,255,0.14)',
        overflow: 'hidden',
      }}
    />
  )
}

function ScoreCell({ score, outcome }: { score: MatchRow['score']; outcome: Outcome }) {
  if (!score) {
    return (
      <div
        style={{
          fontFamily: 'Anton',
          fontSize: 18,
          color: 'var(--color-d-mut)',
          flex: '0 0 auto',
          minWidth: 44,
          textAlign: 'center',
        }}
      >
        —
      </div>
    )
  }
  const userColor =
    outcome === 'W'
      ? 'var(--color-d-lime)'
      : outcome === 'L'
        ? 'var(--color-d-mut)'
        : 'var(--color-d-ink)'
  const oppColor =
    outcome === 'L'
      ? 'var(--color-d-ink)'
      : outcome === 'W'
        ? 'var(--color-d-mut)'
        : 'var(--color-d-ink)'
  return (
    <div
      style={{
        fontFamily: 'Anton',
        fontSize: 18,
        flex: '0 0 auto',
        minWidth: 44,
        textAlign: 'center',
        letterSpacing: '0.02em',
      }}
    >
      <span style={{ color: userColor }}>{score.userGoals}</span>
      <span style={{ color: 'var(--color-d-mut)', margin: '0 4px' }}>–</span>
      <span style={{ color: oppColor }}>{score.oppGoals}</span>
    </div>
  )
}

function OutcomePill({ outcome }: { outcome: Outcome }) {
  const { label, bg, fg, border } = pillStyle(outcome)
  return (
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        fontFamily: 'Anton',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
      }}
      aria-label={ariaLabelFor(outcome)}
    >
      {label}
    </div>
  )
}

function pillStyle(outcome: Outcome): {
  label: string
  bg: string
  fg: string
  border: string
} {
  switch (outcome) {
    case 'W':
      return {
        label: 'V',
        bg: 'rgba(212,255,61,0.16)',
        fg: 'var(--color-d-lime)',
        border: 'var(--color-d-lime)',
      }
    case 'L':
      return {
        label: 'D',
        bg: 'rgba(255,86,86,0.12)',
        fg: 'var(--color-d-red)',
        border: 'var(--color-d-red)',
      }
    case 'D':
      return {
        label: 'E',
        bg: 'var(--color-d-surface)',
        fg: 'var(--color-d-ink)',
        border: 'var(--color-d-line)',
      }
    case 'P':
      return {
        label: '·',
        bg: 'transparent',
        fg: 'var(--color-d-mut)',
        border: 'var(--color-d-line)',
      }
  }
}

function ariaLabelFor(outcome: Outcome): string {
  switch (outcome) {
    case 'W':
      return 'Vitória'
    case 'L':
      return 'Derrota'
    case 'D':
      return 'Empate'
    case 'P':
      return 'Pendente'
  }
}

function FallbackBody({ fallbackTo, onClose }: { fallbackTo: string; onClose: () => void }) {
  return (
    <>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 12,
          color: 'var(--color-d-mut)',
          lineHeight: 1.6,
          marginBottom: 14,
        }}
      >
        Não consegui carregar a campanha pra mostrar aqui. Abra a tela completa pra revisar os
        jogos.
      </div>
      <Link
        to={fallbackTo}
        onClick={onClose}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-d-lime)',
          color: 'var(--color-d-bg)',
          border: '1px solid var(--color-d-lime)',
          borderRadius: 11,
          padding: 13,
          fontFamily: 'Anton',
          fontSize: 15,
          letterSpacing: '0.02em',
          textDecoration: 'none',
        }}
      >
        ABRIR TELA COMPLETA →
      </Link>
    </>
  )
}
