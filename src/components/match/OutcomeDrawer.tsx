import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { track } from '../../lib/track'

import { CampaignModal } from './CampaignModal'
import { LineupModal } from './LineupModal'

import type { DraftState } from '../../lib/draft'
import type { UserFate } from '../../lib/groups'

// ---------- Tipos públicos ----------

export interface ScorerRow {
  name: string
  goals: number
}

export interface CampaignStats {
  jogos: number
  rec: string
  gols: number
  saldo: string
}

export type OutcomeKind =
  | 'grupo'
  | 'grupo-resultado'
  | 'classificado'
  | 'fora-grupos'
  | 'avancou'
  | 'elim'
  | 'champ'

export interface OutcomeContext {
  phase: string
  resultLine: string
  matchResult: {
    userGoals: number
    oppGoals: number
    oppLabel: string
    /** Pênaltis (knockout) já normalizados na perspectiva do user. */
    penalties?: {
      userScored: number
      oppScored: number
      /** Cobranças em ordem cronológica — true = converteu. */
      sequence: { isUser: boolean; scored: boolean }[]
    }
  }
  draft: DraftState
  stats: CampaignStats
  scorers: ScorerRow[]
  extras: {
    userPos?: number
    nextRoundLabel?: string | null
    fate?: UserFate | null
    /** Próxima rodada de grupo, se houver (1, 2 ou 3). Drive o CTA "JOGAR PRÓXIMO". */
    nextGroupRound?: 1 | 2 | 3 | null
    /** Letra do grupo do user, ex: 'G'. Header da mini classificação. */
    groupLetter?: string | null
    /** Classificação parcial do grupo do user, top 4. Mostrada inline no outcome. */
    groupStandings?: GroupStandingRow[] | null
    /** ID do próximo match KO do user (R16/QF/SF/F). Drive "JOGAR {ROUND_LABEL}". */
    nextKnockoutMatchId?: string | null
  }
}

/**
 * Linha compacta da classificação do grupo do user — passada pro outcome
 * drawer e pra CampaignModal pra mostrar a tabela sem precisar de roundtrip
 * em outra rota.
 */
export interface GroupStandingRow {
  code: string
  name: string
  isUser: boolean
  points: number
  played: number
  wins: number
  draws: number
  losses: number
  goalDiff: number
  position: 1 | 2 | 3 | 4
}

// ---------- Config interna ----------

/**
 * Ornamento do banner do drawer. `check` e `emoji` são mutuamente exclusivos
 * por definição — modelados como DU pra eliminar o caso "ambos true ou ambos
 * setados" que o boolean+nullable permitiria.
 */
type BannerDecoration = { kind: 'check' } | { kind: 'emoji'; char: string } | { kind: 'none' }

/**
 * CTA secundária. `to` é a rota canônica (fallback se a modal não conseguir
 * carregar dados). `kind` opcional indica que o click deve abrir uma modal
 * aninhada em vez de navegar — usado pelos atalhos "VER TIME" / "VER CAMPANHA"
 * que ganharam uma versão in-place no PR atual.
 */
interface SecondaryCta {
  label: string
  to: string
  kind?: 'team' | 'campaign'
}

/**
 * Config do outcome drawer discriminada por `kind`. Cada kind narra um
 * único momento da campanha (rodada de grupo encerrada, classificação,
 * eliminação, campeão), e os campos refletem essas semânticas — a DU
 * por kind permite ao consumer derivar variantes sem null-checks frágeis.
 */
interface OutcomeConfig {
  kind: OutcomeKind
  kicker: string
  title: string
  titleColor: string
  sub: string
  accent: string
  bannerBg: string
  decoration: BannerDecoration
  ctaLabel: string
  ctaTo: string
  /** CTAs secundários — renderizados em grid embaixo do primário. */
  secondaries: SecondaryCta[]
  /**
   * Tom da CTA primária:
   *   - 'lime' → fundo lime (sucesso: VITÓRIA, CLASSIFICADO, AVANÇOU, CAMPEÃO, JOGAR PRÓXIMO)
   *   - 'red'  → fundo vermelho (eliminado: TENTAR DE NOVO highlighted pós-derrota)
   *   - 'neutral' → fundo dim (grupo-resultado sem próximo jogo, fallback)
   */
  primaryTone: 'lime' | 'red' | 'neutral'
  champion: boolean
  showShare: boolean
}

function outcomeConfig(kind: OutcomeKind, ctx: OutcomeContext): OutcomeConfig {
  switch (kind) {
    case 'grupo': {
      const next = ctx.extras.nextGroupRound
      return {
        kind,
        kicker: ctx.phase,
        title: 'VITÓRIA',
        titleColor: 'var(--color-d-ink)',
        sub: next
          ? 'Mais três pontos. Vamos pra próxima rodada?'
          : 'Mais três pontos. Falta jogo pra fechar o grupo.',
        accent: 'var(--color-d-lime)',
        bannerBg: 'linear-gradient(180deg, #12160d, #0a0b09)',
        decoration: { kind: 'check' },
        ctaLabel: next ? 'JOGAR PRÓXIMO →' : 'VOLTAR PRO GRUPO →',
        ctaTo: next ? `/match?round=${next}` : '/groups',
        // Mid-grupos: só VER GRUPO de secondary. CHAVEAMENTO/VOLTAR são ruído
        // nesse momento — o user quer continuar jogando.
        secondaries: [{ label: 'VER GRUPO', to: '/groups', kind: 'campaign' }],
        primaryTone: 'lime',
        champion: false,
        showShare: true,
      }
    }
    case 'grupo-resultado': {
      const next = ctx.extras.nextGroupRound
      return {
        kind,
        kicker: ctx.phase,
        title: 'JOGO ENCERRADO',
        titleColor: 'var(--color-d-ink)',
        sub: next
          ? 'Ainda falta jogo. Próxima rodada na manga.'
          : 'Ainda falta jogo pra fechar o grupo.',
        accent: 'var(--color-d-mut)',
        bannerBg: 'linear-gradient(180deg, #141613, #0a0b09)',
        decoration: { kind: 'none' },
        ctaLabel: next ? 'JOGAR PRÓXIMO →' : 'VOLTAR PRO GRUPO →',
        ctaTo: next ? `/match?round=${next}` : '/groups',
        secondaries: [{ label: 'VER GRUPO', to: '/groups', kind: 'campaign' }],
        primaryTone: next ? 'lime' : 'neutral',
        champion: false,
        showShare: false,
      }
    }
    case 'classificado':
      return {
        kind,
        kicker: 'FASE DE GRUPOS · ENCERRADA',
        title: 'CLASSIFICADO',
        titleColor: 'var(--color-d-ink)',
        sub: classificadoSubMessage(ctx),
        accent: 'var(--color-d-lime)',
        bannerBg: 'linear-gradient(180deg, #161d0b, #0a0b09)',
        decoration: { kind: 'check' },
        ctaLabel: 'IR PRO MATA-MATA →',
        ctaTo: '/bracket',
        secondaries: [
          { label: 'VER TIME', to: '/draft?view=1', kind: 'team' },
          { label: 'VER GRUPO', to: '/groups', kind: 'campaign' },
        ],
        primaryTone: 'lime',
        champion: false,
        showShare: true,
      }
    case 'fora-grupos':
      return {
        kind,
        kicker: 'COPA 2026 · FIM DE LINHA',
        title: 'ELIMINADO',
        titleColor: 'var(--color-d-ink)',
        sub: foraGruposSubMessage(ctx),
        accent: 'var(--color-d-red)',
        bannerBg: 'linear-gradient(180deg, #1a1012, #141613)',
        decoration: { kind: 'none' },
        ctaLabel: 'TENTAR DE NOVO →',
        ctaTo: '/draft?fresh=1',
        secondaries: [
          { label: 'VER TIME', to: '/draft?view=1', kind: 'team' },
          { label: 'VER GRUPO', to: '/groups', kind: 'campaign' },
        ],
        primaryTone: 'red',
        champion: false,
        showShare: false,
      }
    case 'avancou': {
      const nextLabel = ctx.extras.nextRoundLabel
      const nextId = ctx.extras.nextKnockoutMatchId
      // Quando temos a próxima partida do user já preenchida (ensureRoundsSimulated
      // rodou pós-applyResult), CTA primário vira "JOGAR {ROUND}" e "VER {ROUND}"
      // vira secondary. Caso contrário (final só pode ser champ; safety):
      // fallback no antigo "VER {ROUND}".
      const canJumpToNext = !!(nextLabel && nextId)
      return {
        kind,
        kicker: ctx.phase,
        title: nextLabel ? `NA ${nextLabel}!` : 'AVANÇOU',
        titleColor: 'var(--color-d-ink)',
        sub: 'Seu XI passou pra próxima fase.',
        accent: 'var(--color-d-lime)',
        bannerBg: 'linear-gradient(180deg, #161d0b, #0a0b09)',
        decoration: { kind: 'check' },
        ctaLabel: canJumpToNext
          ? `JOGAR ${nextLabel} →`
          : nextLabel
            ? `VER ${nextLabel} →`
            : 'VOLTAR PRO CHAVEAMENTO →',
        ctaTo: canJumpToNext ? `/match?kind=knockout&id=${nextId}` : '/bracket',
        secondaries: canJumpToNext
          ? [
              { label: `VER ${nextLabel}`, to: '/bracket' },
              { label: 'VER TIME', to: '/draft?view=1', kind: 'team' },
            ]
          : [{ label: 'VER TIME', to: '/draft?view=1', kind: 'team' }],
        primaryTone: 'lime',
        champion: false,
        showShare: true,
      }
    }
    case 'elim':
      return {
        kind,
        kicker: ctx.phase,
        title: 'ELIMINADO',
        titleColor: 'var(--color-d-ink)',
        sub: 'Seu time caiu no mata-mata. Quase lá.',
        accent: 'var(--color-d-red)',
        bannerBg: 'linear-gradient(180deg, #1a1012, #141613)',
        decoration: { kind: 'none' },
        ctaLabel: 'TENTAR DE NOVO →',
        ctaTo: '/draft?fresh=1',
        secondaries: [
          { label: 'VER TIME', to: '/draft?view=1', kind: 'team' },
          { label: 'VER CAMPANHA', to: '/bracket', kind: 'campaign' },
          { label: 'VER CHAVEAMENTO', to: '/bracket' },
        ],
        primaryTone: 'red',
        champion: false,
        showShare: false,
      }
    case 'champ':
      return {
        kind,
        kicker: 'COPA 2026 · DECISÃO',
        title: 'CAMPEÃO',
        titleColor: 'var(--color-d-bg)',
        sub: 'Seu time levantou a taça.',
        accent: 'rgba(10,11,9,0.7)',
        bannerBg: 'radial-gradient(130% 100% at 50% 0%, #d4ff3d, #a9d11e)',
        decoration: { kind: 'emoji', char: '🏆' },
        ctaLabel: 'JOGAR DE NOVO →',
        ctaTo: '/draft?fresh=1',
        secondaries: [
          { label: 'VER TIME CAMPEÃO', to: '/draft?view=1', kind: 'team' },
          { label: 'VER CAMPANHA', to: '/bracket', kind: 'campaign' },
        ],
        primaryTone: 'lime',
        champion: true,
        showShare: false,
      }
  }
}

function ordinalPt(n: number): string {
  if (n === 1) return '1º'
  if (n === 2) return '2º'
  if (n === 3) return '3º'
  return `${n}º`
}

/**
 * Sub-mensagem do drawer "CLASSIFICADO" — varia por destino:
 *   - 1º/2º: "1º do grupo. Seu XI está no mata-mata."
 *   - 3º entre os 8 melhores: "3º do grupo · entre os 8 melhores terceiros."
 */
function classificadoSubMessage(ctx: OutcomeContext): string {
  const fate = ctx.extras.fate
  if (fate?.kind === 'qualified-3rd-rank') {
    return `3º do grupo · entre os 8 melhores terceiros (#${fate.rank} de 12).`
  }
  return `${ordinalPt(ctx.extras.userPos ?? 1)} do grupo. Seu XI está no mata-mata.`
}

/**
 * Sub-mensagem do drawer "ELIMINADO" da fase de grupos — diferencia entre
 * 3º fora dos 8 melhores e 4º colocado puro.
 */
function foraGruposSubMessage(ctx: OutcomeContext): string {
  const fate = ctx.extras.fate
  if (fate?.kind === 'eliminated-3rd-rank') {
    return `3º do grupo, fora dos 8 melhores terceiros (#${fate.rank} de 12). Faltou pouco.`
  }
  if (fate?.kind === 'eliminated-4th') {
    return 'Último do grupo. Seu XI não passou.'
  }
  return 'Seu XI não passou da fase de grupos. Tente de novo.'
}

// ---------- Componente público ----------

export function OutcomeDrawer({
  outcome,
  ctx,
  onClose,
}: {
  outcome: OutcomeKind
  ctx: OutcomeContext
  onClose: () => void
}) {
  const cfg = outcomeConfig(outcome, ctx)
  // Modal aninhada sobre o drawer: 'team' (VER TIME) ou 'campaign' (VER GRUPO/
  // CAMPANHA). null = nenhuma aberta, drawer principal recebe interação.
  const [openModal, setOpenModal] = useState<'team' | 'campaign' | null>(null)
  // A11y: ref do diálogo pra mover o foco pra dentro do drawer ao abrir e
  // devolver pro elemento anterior ao fechar.
  const dialogRef = useRef<HTMLDivElement>(null)
  // ESC fecha o drawer — drawer só monta quando outcome != null, então
  // o listener fica ativo só enquanto está visível. Quando uma modal aninhada
  // está aberta, ela registra um handler em capture com stopPropagation, então
  // o ESC fecha primeiro a modal e o drawer só fecha no ESC seguinte.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Foco entra no drawer ao abrir; ao desmontar, volta pro elemento que estava
  // focado antes (ex.: o botão da tela da partida). Roda só no mount/unmount.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => previouslyFocused?.focus?.()
  }, [])

  const handleSecondaryClick = (kind: 'team' | 'campaign') => {
    setOpenModal(kind)
    void track('outcome_secondary_modal_open', { kind, outcome })
  }
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(6,7,5,0.78)',
          backdropFilter: 'blur(4px)',
          zIndex: 30,
          animation: 'd26-fade-in .25s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 31,
          display: 'flex',
          justifyContent: 'center',
          animation: 'd26-sheet-up .32s cubic-bezier(.2,.9,.3,1)',
          pointerEvents: 'none',
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={cfg.title}
          tabIndex={-1}
          style={{
            width: '100%',
            maxWidth: 600,
            maxHeight: '92vh',
            overflowY: 'auto',
            background: 'var(--color-d-surface)',
            border: '1px solid var(--color-d-line)',
            borderBottom: 'none',
            borderRadius: '22px 22px 0 0',
            boxShadow: '0 -30px 60px -20px rgba(0,0,0,0.7)',
            pointerEvents: 'auto',
            outline: 'none',
          }}
        >
          <OutcomeBanner cfg={cfg} />
          <div style={{ padding: '18px clamp(18px, 5vw, 28px) 30px' }}>
            <OutcomeActions cfg={cfg} onSecondaryModal={handleSecondaryClick} />
            <div style={{ marginTop: 22 }}>
              <MatchResultCard phase={ctx.phase} result={ctx.matchResult} />
              {(cfg.kind === 'grupo' || cfg.kind === 'grupo-resultado') &&
                ctx.extras.groupStandings && (
                  <GroupStandingsMini
                    standings={ctx.extras.groupStandings}
                    groupLetter={ctx.extras.groupLetter ?? ''}
                  />
                )}
              <TeamChosenCard draft={ctx.draft} />
              <CampaignStatsRow stats={ctx.stats} />
              {ctx.scorers.length > 0 && <ScorersList scorers={ctx.scorers} />}
              {cfg.champion && (
                <ChampionShareBlock
                  resultLine={ctx.resultLine}
                  topScorer={ctx.scorers[0]}
                  ctx={ctx}
                />
              )}
              {!cfg.champion && cfg.showShare && (
                <CompactShare surface={outcome} ctx={ctx} kind={outcome} />
              )}
            </div>
          </div>
        </div>
      </div>
      {openModal === 'team' && (
        <LineupModal
          title={cfg.champion ? 'SEU TIME CAMPEÃO' : 'SEU XI'}
          draft={ctx.draft}
          fallbackTo="/draft?view=1"
          onClose={() => setOpenModal(null)}
        />
      )}
      {openModal === 'campaign' && (
        <CampaignModal
          title={campaignModalTitle(outcome)}
          fallbackTo={campaignModalFallback(outcome)}
          onClose={() => setOpenModal(null)}
        />
      )}
    </>
  )
}

/** Título da modal de campanha varia pelo momento — grupos vs mata-mata. */
function campaignModalTitle(outcome: OutcomeKind): string {
  switch (outcome) {
    case 'classificado':
    case 'fora-grupos':
      return 'SEU GRUPO'
    case 'avancou':
    case 'elim':
    case 'champ':
      return 'SUA CAMPANHA'
    default:
      return 'SUA CAMPANHA'
  }
}

/** Rota de fallback equivalente à CTA original (mantém comportamento legado). */
function campaignModalFallback(outcome: OutcomeKind): string {
  switch (outcome) {
    case 'classificado':
    case 'fora-grupos':
      return '/groups'
    case 'avancou':
    case 'elim':
    case 'champ':
      return '/bracket'
    default:
      return '/bracket'
  }
}

// ---------- Subcomponentes ----------

function OutcomeBanner({ cfg }: { cfg: OutcomeConfig }) {
  return (
    <div
      style={{
        padding: '18px clamp(18px, 5vw, 28px) 16px',
        borderBottom: '1px solid var(--color-d-line)',
        background: cfg.bannerBg,
        position: 'relative',
      }}
    >
      <div
        style={{
          width: 44,
          height: 5,
          borderRadius: 5,
          background: 'rgba(255,255,255,0.25)',
          margin: '0 auto 14px',
        }}
      />
      <div style={{ textAlign: 'center' }}>
        {cfg.decoration.kind === 'check' && (
          <div
            style={{
              width: 54,
              height: 54,
              margin: '0 auto 8px',
              borderRadius: '50%',
              background: 'rgba(212,255,61,0.14)',
              border: '1.5px solid var(--color-d-lime)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Anton',
              fontSize: 28,
              color: 'var(--color-d-lime)',
            }}
          >
            ✓
          </div>
        )}
        {cfg.decoration.kind === 'emoji' && (
          <div style={{ fontSize: 46, lineHeight: 1, marginBottom: 8 }}>{cfg.decoration.char}</div>
        )}
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 11,
            letterSpacing: '0.18em',
            color: cfg.accent,
            marginBottom: 4,
          }}
        >
          {cfg.kicker}
        </div>
        <h2
          style={{
            fontFamily: 'Anton',
            fontSize: 40,
            margin: 0,
            lineHeight: 0.92,
            color: cfg.titleColor,
          }}
        >
          {cfg.title}
        </h2>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 12,
            color: cfg.champion ? 'rgba(10,11,9,0.6)' : 'var(--color-d-mut)',
            marginTop: 8,
          }}
        >
          {cfg.sub}
        </div>
      </div>
    </div>
  )
}

function MatchResultCard({
  phase,
  result,
}: {
  phase: string
  result: OutcomeContext['matchResult']
}) {
  const { userGoals, oppGoals, oppLabel, penalties } = result
  const userWon = penalties ? penalties.userScored > penalties.oppScored : userGoals > oppGoals

  return (
    <div
      style={{
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'var(--color-d-mut)',
          marginBottom: 10,
        }}
      >
        {phase}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            textAlign: 'right',
            fontFamily: 'Anton',
            fontSize: 22,
            color: 'var(--color-d-lime)',
          }}
        >
          SEU XI
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            fontFamily: 'Anton',
            fontSize: 34,
            lineHeight: 1,
          }}
        >
          <span style={{ color: userWon ? 'var(--color-d-lime)' : 'var(--color-d-mut)' }}>
            {userGoals}
          </span>
          <span style={{ fontSize: 22, color: 'var(--color-d-mut)' }}>—</span>
          <span style={{ color: !userWon ? 'var(--color-d-ink)' : 'var(--color-d-mut)' }}>
            {oppGoals}
          </span>
        </div>
        <div
          style={{
            textAlign: 'left',
            fontFamily: 'Anton',
            fontSize: 22,
            color: 'var(--color-d-ink)',
          }}
        >
          {oppLabel}
        </div>
      </div>
      {penalties && <PenaltyDots penalties={penalties} userWon={userWon} />}
    </div>
  )
}

function PenaltyDots({
  penalties,
  userWon,
}: {
  penalties: NonNullable<OutcomeContext['matchResult']['penalties']>
  userWon: boolean
}) {
  const userKicks = penalties.sequence.filter((k) => k.isUser)
  const oppKicks = penalties.sequence.filter((k) => !k.isUser)
  // Slots por lateral: 5 (regulamentar) + 1 por par de morte súbita.
  // Cobranças não-batidas (encerrou cedo) ficam pontilhadas no row.
  const totalSlots = 5 + Math.ceil(Math.max(0, penalties.sequence.length - 10) / 2)
  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 12,
        borderTop: '1px solid var(--color-d-line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'Space Mono',
          fontSize: 10,
          letterSpacing: '0.1em',
          color: 'var(--color-d-mut)',
          marginBottom: 8,
        }}
      >
        <span>PÊNALTIS</span>
        <span style={{ fontFamily: 'Anton', fontSize: 16, color: 'var(--color-d-ink)' }}>
          <span style={{ color: userWon ? 'var(--color-d-lime)' : 'var(--color-d-mut)' }}>
            {penalties.userScored}
          </span>
          <span style={{ color: 'var(--color-d-mut)', margin: '0 5px' }}>—</span>
          <span style={{ color: !userWon ? 'var(--color-d-ink)' : 'var(--color-d-mut)' }}>
            {penalties.oppScored}
          </span>
        </span>
      </div>
      <PenaltyRow
        label="SEU XI"
        kicks={userKicks}
        totalSlots={totalSlots}
        ours
        scoredColor="var(--color-d-lime)"
      />
      <div style={{ height: 6 }} />
      <PenaltyRow
        label="OPP"
        kicks={oppKicks}
        totalSlots={totalSlots}
        scoredColor="var(--color-d-ink)"
      />
    </div>
  )
}

function PenaltyRow({
  label,
  kicks,
  totalSlots,
  ours,
  scoredColor,
}: {
  label: string
  kicks: NonNullable<OutcomeContext['matchResult']['penalties']>['sequence']
  totalSlots: number
  ours?: boolean
  scoredColor: string
}) {
  const pending = Math.max(0, totalSlots - kicks.length)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          fontFamily: 'Space Mono',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: ours ? 'var(--color-d-lime)' : 'var(--color-d-mut)',
          width: 56,
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {kicks.map((k, i) => (
          <span
            key={`shot-${i}`}
            title={k.scored ? 'Convertida' : 'Perdida'}
            style={{
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: k.scored ? scoredColor : 'transparent',
              border: `1.5px solid ${k.scored ? scoredColor : 'var(--color-d-mut)'}`,
              opacity: k.scored ? 1 : 0.5,
            }}
          />
        ))}
        {Array.from({ length: pending }).map((_, i) => (
          <span
            key={`pending-${i}`}
            style={{
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: 'transparent',
              border: '1.5px dashed var(--color-d-line)',
              opacity: 0.5,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Tabela compacta com a classificação parcial do grupo do user. Aparece
 * inline no outcome drawer durante a fase de grupos (rodadas 1-3), evitando
 * navegação pro /groups só pra olhar a tabela.
 */
function GroupStandingsMini({
  standings,
  groupLetter,
}: {
  standings: GroupStandingRow[]
  groupLetter: string
}) {
  return (
    <div
      style={{
        marginTop: 14,
        background: 'var(--color-d-surface)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 13,
        padding: '14px 14px 6px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontFamily: 'Space Mono',
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--color-d-mut)',
          }}
        >
          {groupLetter ? `GRUPO ${groupLetter} · PARCIAL` : 'CLASSIFICAÇÃO PARCIAL'}
        </span>
        <span
          style={{
            display: 'flex',
            gap: 14,
            fontFamily: 'Space Mono',
            fontSize: 9,
            letterSpacing: '0.1em',
            color: 'var(--color-d-mut)',
          }}
        >
          <span style={{ width: 22, textAlign: 'right' }}>J</span>
          <span style={{ width: 28, textAlign: 'right' }}>SG</span>
          <span style={{ width: 24, textAlign: 'right' }}>PTS</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {standings.map((row) => (
          <GroupStandingsRow key={row.code} row={row} />
        ))}
      </div>
    </div>
  )
}

function GroupStandingsRow({ row }: { row: GroupStandingRow }) {
  const accent = row.isUser ? 'var(--color-d-lime)' : 'var(--color-d-ink)'
  const muted = row.isUser ? 'rgba(212,255,61,0.65)' : 'var(--color-d-mut)'
  const diffColor =
    row.goalDiff > 0
      ? 'var(--color-d-lime)'
      : row.goalDiff < 0
        ? 'var(--color-d-red)'
        : 'var(--color-d-mut)'
  const diffText = row.goalDiff > 0 ? `+${row.goalDiff}` : `${row.goalDiff}`
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        background: row.isUser ? 'rgba(212,255,61,0.06)' : 'transparent',
        marginInline: -6,
        paddingInline: 6,
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'Anton',
            fontSize: 14,
            color: muted,
            width: 14,
            textAlign: 'center',
          }}
        >
          {row.position}
        </span>
        <span
          style={{
            fontFamily: 'Anton',
            fontSize: 14,
            color: accent,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '0.02em',
          }}
        >
          {row.isUser ? 'SEU XI' : row.name.toUpperCase()}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 14,
          fontFamily: 'Anton',
          fontSize: 14,
          alignItems: 'baseline',
        }}
      >
        <span style={{ width: 22, textAlign: 'right', color: muted }}>{row.played}</span>
        <span style={{ width: 28, textAlign: 'right', color: diffColor }}>{diffText}</span>
        <span style={{ width: 24, textAlign: 'right', color: accent, fontSize: 16 }}>
          {row.points}
        </span>
      </div>
    </div>
  )
}

function TeamChosenCard({ draft }: { draft: DraftState }) {
  const ovr = Math.round(averageOvr(draft))
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 18,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'var(--color-d-lime)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          color: 'var(--color-d-bg)',
        }}
      >
        ⚄
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Anton', fontSize: 22, lineHeight: 0.95 }}>SEU XI</div>
        <div
          style={{
            fontFamily: 'Space Mono',
            fontSize: 10,
            color: 'var(--color-d-mut)',
            letterSpacing: '0.08em',
            marginTop: 2,
          }}
        >
          {draft.formationName.toUpperCase()} · {draft.style.toUpperCase()} ·{' '}
          {draft.pickedCountries.length} SELEÇÕES
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: 'var(--color-d-mut)' }}>
          OVR
        </div>
        <div style={{ fontFamily: 'Anton', fontSize: 26, color: 'var(--color-d-lime)' }}>{ovr}</div>
      </div>
    </div>
  )
}

function averageOvr(draft: DraftState): number {
  const players = draft.slots.map((s) => s.player?.player).filter(Boolean) as { overall: number }[]
  if (players.length === 0) return 0
  return players.reduce((a, b) => a + b.overall, 0) / players.length
}

function CampaignStatsRow({ stats }: { stats: CampaignStats }) {
  return (
    <>
      <SectionLabel>CAMPANHA NO TORNEIO</SectionLabel>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          marginBottom: 22,
        }}
      >
        <StatCell label="JOGOS" value={String(stats.jogos)} highlight />
        <StatCell label="V-E-D" value={stats.rec} />
        <StatCell label="GOLS PRÓ" value={String(stats.gols)} highlight />
        <StatCell label="SALDO" value={stats.saldo} />
      </div>
    </>
  )
}

function StatCell({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      style={{
        background: 'var(--color-d-surface2)',
        border: '1px solid var(--color-d-line)',
        borderRadius: 11,
        padding: '13px 8px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'Anton',
          fontSize: 26,
          color: highlight ? 'var(--color-d-lime)' : 'var(--color-d-ink)',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'Space Mono',
          fontSize: 9,
          color: 'var(--color-d-mut)',
          letterSpacing: '0.06em',
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'Space Mono',
        fontSize: 11,
        letterSpacing: '0.12em',
        color: 'var(--color-d-mut)',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

function ScorersList({ scorers }: { scorers: ScorerRow[] }) {
  const maxG = Math.max(...scorers.map((s) => s.goals), 1)
  return (
    <>
      <SectionLabel>ARTILHEIROS DA EQUIPE</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 8 }}>
        {scorers.map((s, i) => (
          <div
            key={s.name}
            style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 12px)' }}
          >
            <div
              style={{
                width: 24,
                flexShrink: 0,
                fontFamily: 'Anton',
                fontSize: 16,
                color: 'var(--color-d-mut)',
                textAlign: 'center',
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: '1 1 70px', minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.name}
              </div>
            </div>
            <div
              style={{
                flex: '0 1 120px',
                minWidth: 48,
                height: 8,
                borderRadius: 6,
                background: 'var(--color-d-surface2)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(s.goals / maxG) * 100}%`,
                  height: '100%',
                  background: 'var(--color-d-lime)',
                }}
              />
            </div>
            <div
              style={{
                fontFamily: 'Anton',
                fontSize: 20,
                color: 'var(--color-d-lime)',
                width: 28,
                flexShrink: 0,
                textAlign: 'right',
              }}
            >
              {s.goals}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function ChampionShareBlock({
  resultLine,
  topScorer,
  ctx,
}: {
  resultLine: string
  topScorer?: ScorerRow
  ctx: OutcomeContext
}) {
  return (
    <div style={{ marginTop: 22, borderTop: '1px solid var(--color-d-line)', paddingTop: 20 }}>
      <SectionLabel>COMPARTILHE A CONQUISTA</SectionLabel>
      <div
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid rgba(212,255,61,0.3)',
          background:
            'radial-gradient(120% 90% at 80% 0%, rgba(212,255,61,0.16), transparent 60%), #101310',
          padding: 20,
          marginBottom: 14,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: 'var(--color-d-lime)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                color: 'var(--color-d-bg)',
              }}
            >
              ⚄
            </div>
            <span style={{ fontFamily: 'Anton', fontSize: 16 }}>
              DRAFT{' '}
              <span
                style={{
                  fontFamily: 'Space Mono',
                  fontSize: 11,
                  color: 'var(--color-d-lime)',
                  fontWeight: 700,
                }}
              >
                26
              </span>
            </span>
          </div>
          <span style={{ fontSize: 24 }}>🏆</span>
        </div>
        <div style={{ fontFamily: 'Anton', fontSize: 30, lineHeight: 0.95, marginBottom: 6 }}>
          SEU XI É<br />
          <span style={{ color: 'var(--color-d-lime)' }}>CAMPEÃO DO MUNDO</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 14,
            fontFamily: 'Space Mono',
            fontSize: 11,
            color: 'var(--color-d-mut)',
          }}
        >
          <span>{resultLine}</span>
          {topScorer && (
            <>
              <div style={{ width: 1, height: 24, background: 'var(--color-d-line)' }} />
              <span>
                ARTILHEIRO{' '}
                <b style={{ color: 'var(--color-d-ink)' }}>
                  {topScorer.name.toUpperCase()} · {topScorer.goals}
                </b>
              </span>
            </>
          )}
        </div>
      </div>
      <ShareGrid surface="champion" ctx={ctx} kind="champ" />
    </div>
  )
}

function CompactShare({
  surface,
  ctx,
  kind,
}: {
  surface: string
  ctx: OutcomeContext
  kind: OutcomeKind
}) {
  return (
    <div style={{ marginTop: 22, borderTop: '1px solid var(--color-d-line)', paddingTop: 18 }}>
      <SectionLabel>COMPARTILHAR</SectionLabel>
      <ShareGrid surface={surface} ctx={ctx} kind={kind} />
    </div>
  )
}

type ShareMethod = 'x' | 'whats' | 'stories' | 'copy'

/**
 * Resultado de um disparo de share — drive o feedback visual no grid:
 *   - 'opened' → abriu intent externo / sheet nativo (sem feedback in-app)
 *   - 'shared' → Web Share API resolveu (compartilhou)
 *   - 'copied' → link foi pro clipboard (mostra "LINK COPIADO")
 *   - 'failed' → clipboard bloqueado/sem suporte (não trava, só não dá feedback)
 */
type ShareResult = 'opened' | 'shared' | 'copied' | 'failed'

// URL canônica de prod — o que viraliza vai pra cá independente de onde o user
// disparou (dev/preview/prod). UTMs fecham o loop de atribuição em session_init.
const SHARE_URL_BASE = 'https://draft-26.pages.dev'

/**
 * Copia texto pro clipboard com guarda. `clipboard.writeText` rejeita em
 * contexto inseguro (http), sem permissão ou em navegadores antigos — aqui a
 * rejeição vira `false` em vez de uma promise não tratada, pro caller decidir
 * o feedback.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // bloqueado — cai no retorno false
  }
  return false
}

function buildShareUrl(method: ShareMethod, surface: string): string {
  const url = new URL(SHARE_URL_BASE)
  url.searchParams.set('utm_source', 'share')
  url.searchParams.set('utm_medium', method)
  url.searchParams.set('utm_campaign', 'user-share')
  url.searchParams.set('utm_content', surface)
  return url.toString()
}

function buildShareText(surface: string): string {
  switch (surface) {
    case 'champion':
      return '🏆 Meu XI é CAMPEÃO no Draft 26! Simulador da Copa 2026.'
    case 'classificado':
      return 'Classificado no Draft 26 ⚄ Simulador da Copa 2026.'
    case 'avancou':
      return 'Mais uma fase no Draft 26 ⚄ Simulador da Copa 2026.'
    case 'grupo':
      return 'Vitória no grupo no Draft 26 ⚄ Simulador da Copa 2026.'
    default:
      return 'Jogando o Draft 26 ⚄ Simulador da Copa 2026.'
  }
}

async function fireShare(method: ShareMethod, surface: string): Promise<ShareResult> {
  void track('share_clicked', { method, surface })
  const url = buildShareUrl(method, surface)
  const text = buildShareText(surface)

  if (method === 'x') {
    const intent = new URL('https://x.com/intent/tweet')
    intent.searchParams.set('text', text)
    intent.searchParams.set('url', url)
    window.open(intent.toString(), '_blank', 'noopener,noreferrer')
    return 'opened'
  }
  if (method === 'whats') {
    const intent = new URL('https://wa.me/')
    intent.searchParams.set('text', `${text} ${url}`)
    window.open(intent.toString(), '_blank', 'noopener,noreferrer')
    return 'opened'
  }
  if (method === 'stories') {
    // Sem URL direta de IG Stories no web — Web Share API abre o sheet nativo
    // (e o IG aparece nele); em desktop sem suporte, cai pro clipboard.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text, url })
        return 'shared'
      } catch {
        // cancelou ou bloqueou — silencioso, sem feedback de cópia
        return 'opened'
      }
    }
    return (await copyToClipboard(url)) ? 'copied' : 'failed'
  }
  return (await copyToClipboard(url)) ? 'copied' : 'failed'
}

const SHARE_ARIA_LABELS: Record<ShareMethod, string> = {
  x: 'Compartilhar no X',
  whats: 'Compartilhar no WhatsApp',
  stories: 'Compartilhar nos Stories',
  copy: 'Copiar link',
}

// Outcomes com card de imagem desenhado — guard barato e estático (o módulo
// pesado de geração só é importado sob demanda no clique do STORIES).
const IMAGE_CARD_KINDS = new Set<OutcomeKind>(['grupo', 'classificado', 'avancou', 'champ'])

function ShareGrid({
  surface,
  ctx,
  kind,
}: {
  surface: string
  /** Quando presentes e o outcome tem card, o STORIES gera a imagem desenhada. */
  ctx?: OutcomeContext
  kind?: OutcomeKind
}) {
  // Feedback transitório por botão (cópia/download) + "gerando" durante o render.
  const [feedback, setFeedback] = useState<{ method: ShareMethod; text: string } | null>(null)
  const [busy, setBusy] = useState<ShareMethod | null>(null)

  const flash = (method: ShareMethod, text: string) => {
    setFeedback({ method, text })
    window.setTimeout(() => setFeedback((f) => (f?.method === method ? null : f)), 2000)
  }

  const labelFor = (method: ShareMethod, base: string): string => {
    if (busy === method) return 'GERANDO…'
    if (feedback?.method === method) return feedback.text
    return base
  }
  const items: { label: string; method: ShareMethod }[] = [
    { label: labelFor('x', '𝕏'), method: 'x' },
    { label: labelFor('whats', 'WHATS'), method: 'whats' },
    { label: labelFor('stories', 'STORIES'), method: 'stories' },
    { label: labelFor('copy', 'COPIAR'), method: 'copy' },
  ]

  const shareTextFallback = async (method: ShareMethod) => {
    const result = await fireShare(method, surface)
    if (result === 'copied') flash(method, method === 'copy' ? 'COPIADO ✓' : 'LINK COPIADO')
  }

  const handleClick = async (method: ShareMethod) => {
    if (busy) return
    // STORIES com card desenhado → gera a imagem; senão, share de texto.
    if (method === 'stories' && ctx && kind && IMAGE_CARD_KINDS.has(kind)) {
      setBusy('stories')
      try {
        void track('share_card_generate', { kind, surface })
        const mod = await import('../../lib/share-cards')
        const result = await mod.generateAndShareOutcomeCard(ctx, kind, {
          filename: `draft26-${kind}.png`,
          text: buildShareText(surface),
          url: buildShareUrl('stories', surface),
        })
        if (result === 'downloaded') flash('stories', 'BAIXADO ✓')
        else if (result === 'failed') await shareTextFallback('stories')
      } catch {
        // Falha de rede/fontes/canvas — cai pro share de texto, botão nunca trava.
        await shareTextFallback('stories')
      } finally {
        setBusy(null)
      }
      return
    }
    await shareTextFallback(method)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9 }}>
      {items.map(({ label, method }) => (
        <button
          key={method}
          onClick={() => void handleClick(method)}
          aria-label={SHARE_ARIA_LABELS[method]}
          disabled={busy !== null}
          style={{
            background: 'var(--color-d-surface2)',
            border: '1px solid var(--color-d-line)',
            color: 'var(--color-d-ink)',
            borderRadius: 10,
            padding: '13px 0',
            fontFamily: 'Space Mono',
            fontSize: 11,
            fontWeight: 700,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy && busy !== method ? 0.5 : 1,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function OutcomeActions({
  cfg,
  onSecondaryModal,
}: {
  cfg: OutcomeConfig
  /** Dispatched quando uma CTA secundária com `kind` é clicada — abre modal aninhada. */
  onSecondaryModal: (kind: 'team' | 'campaign') => void
}) {
  // 2+ secundárias entram em grid auto-fit pra caber em qualquer largura.
  // 1 → flex column; 2 → 2-col; 3 → 3-col (cada item ~110px mínimo).
  const secondariesUseGrid = cfg.secondaries.length >= 2
  const primaryBg =
    cfg.primaryTone === 'lime'
      ? 'var(--color-d-lime)'
      : cfg.primaryTone === 'red'
        ? 'var(--color-d-red)'
        : 'var(--color-d-surface2)'
  const primaryFg =
    cfg.primaryTone === 'lime'
      ? 'var(--color-d-bg)'
      : cfg.primaryTone === 'red'
        ? '#fff'
        : 'var(--color-d-ink)'
  const primaryBorder =
    cfg.primaryTone === 'lime'
      ? 'var(--color-d-lime)'
      : cfg.primaryTone === 'red'
        ? 'var(--color-d-red)'
        : 'var(--color-d-line)'
  // Estilo compartilhado entre Link (rota) e button (modal aninhada) — mantém
  // a mesma silhueta visual independente do trigger.
  const secondaryStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'transparent',
    color: 'var(--color-d-mut)',
    border: '1px solid var(--color-d-line)',
    borderRadius: 11,
    padding: 12,
    fontFamily: 'Space Mono',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    textAlign: 'center',
    width: '100%',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Link
        to={cfg.ctaTo}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: primaryBg,
          color: primaryFg,
          border: `1px solid ${primaryBorder}`,
          borderRadius: 11,
          padding: 15,
          fontFamily: 'Anton',
          fontSize: 17,
          letterSpacing: '0.02em',
          cursor: 'pointer',
        }}
      >
        {cfg.ctaLabel}
      </Link>
      {cfg.secondaries.length > 0 && (
        <div
          style={{
            display: secondariesUseGrid ? 'grid' : 'flex',
            gridTemplateColumns: secondariesUseGrid
              ? `repeat(${cfg.secondaries.length}, minmax(0, 1fr))`
              : undefined,
            flexDirection: secondariesUseGrid ? undefined : 'column',
            gap: 10,
          }}
        >
          {cfg.secondaries.map((s) => {
            if (s.kind) {
              const kind = s.kind
              return (
                <button
                  key={`${s.label}-${s.to}`}
                  type="button"
                  onClick={() => onSecondaryModal(kind)}
                  style={secondaryStyle}
                >
                  {s.label}
                </button>
              )
            }
            return (
              <Link key={`${s.label}-${s.to}`} to={s.to} style={secondaryStyle}>
                {s.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
