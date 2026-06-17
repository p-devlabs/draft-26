/**
 * Geração e compartilhamento dos share cards de outcome.
 *
 * Fluxo: `OutcomeContext` → `buildShareCardData` → template HTML (`cardHtml`) +
 * fontes embutidas → `htmlToPngBlob` → `deliverShareImage` (sheet nativo no
 * mobile / download no desktop).
 *
 * Carregado por import dinâmico no `OutcomeDrawer` — fica fora do bundle inicial
 * (templates grandes + lógica de fontes/canvas só pesam quando o user gera um
 * card de verdade).
 */

import { deliverShareImage, htmlToPngBlob, type ShareImageResult } from '../share-image'

import { loadEmbeddedFontCss } from './fonts'
import { cardHtml, type ShareCardData, type ShareCardKind } from './templates'

import type { OutcomeContext, OutcomeKind } from '../../components/match/OutcomeDrawer'
import type { DraftState } from '../draft'
import type { Style } from '../formations'

export type { ShareCardData, ShareCardKind }
export { cardHtml }

const CARD_KINDS: Record<OutcomeKind, ShareCardKind | null> = {
  grupo: 'grupo',
  'grupo-resultado': null,
  classificado: 'classificado',
  'fora-grupos': null,
  avancou: 'avancou',
  elim: null,
  champ: 'champ',
}

const STYLE_LABEL: Record<Style, string> = {
  ofensivo: 'OFENS',
  equilibrado: 'EQUIL',
  defensivo: 'DEFEN',
}

function avgOvr(draft: DraftState): number {
  const ovrs = draft.slots
    .map((s) => s.player?.player.overall)
    .filter((n): n is number => typeof n === 'number')
  if (ovrs.length === 0) return 0
  return ovrs.reduce((a, b) => a + b, 0) / ovrs.length
}

function buildKicker(kind: ShareCardKind, ctx: OutcomeContext): string {
  switch (kind) {
    case 'champ':
      return 'CAMPEÃO MUNDIAL · COPA 2026'
    case 'classificado':
      return 'FASE DE GRUPOS · CLASSIFICADO'
    case 'avancou':
      // ctx.phase no KO = "QUARTAS DE FINAL · COPA 2026" → "MATA-MATA · QUARTAS DE FINAL"
      return `MATA-MATA · ${ctx.phase.replace(/\s*·\s*COPA 2026\s*$/i, '').toUpperCase()}`
    case 'grupo': {
      // ctx.phase no grupo = "FASE DE GRUPOS · 2/3" → "FASE DE GRUPOS · RODADA 2"
      const m = ctx.phase.match(/(\d)\s*\/\s*3/)
      return m ? `FASE DE GRUPOS · RODADA ${m[1]}` : 'FASE DE GRUPOS'
    }
  }
}

function buildPositionLine(ctx: OutcomeContext): string {
  const fate = ctx.extras.fate
  const letter = ctx.extras.groupLetter ?? ''
  const grupo = letter ? ` DO GRUPO ${letter}` : ''
  if (fate?.kind === 'qualified-3rd-rank') {
    return `3º${grupo} · MELHOR TERCEIRO`
  }
  const pos = ctx.extras.userPos ?? 1
  return `${pos}º${grupo}`
}

/** Mapeia o contexto do outcome pros dados do card, ou null se não há card. */
export function buildShareCardData(ctx: OutcomeContext, kind: OutcomeKind): ShareCardData | null {
  const cardKind = CARD_KINDS[kind]
  if (!cardKind) return null

  const { draft, matchResult: mr, stats } = ctx
  const penalties = mr.penalties
    ? { user: mr.penalties.userScored, opp: mr.penalties.oppScored }
    : null
  const standings = ctx.extras.groupStandings
    ? ctx.extras.groupStandings.map((r) => ({
        pos: r.position,
        name: r.code.toUpperCase(),
        isUser: r.isUser,
        played: r.played,
        gd: r.goalDiff,
        pts: r.points,
      }))
    : null
  const top = ctx.scorers[0]

  return {
    kind: cardKind,
    kicker: buildKicker(cardKind, ctx),
    headlineText:
      cardKind === 'avancou' ? `NA ${(ctx.extras.nextRoundLabel ?? '').toUpperCase()}!` : '',
    positionLine: cardKind === 'classificado' ? buildPositionLine(ctx) : '',
    userGoals: mr.userGoals,
    oppGoals: mr.oppGoals,
    opp: mr.oppLabel,
    penalties,
    formation: draft.formationName.toUpperCase(),
    styleLabel: STYLE_LABEL[draft.style],
    countries: draft.pickedCountries.length,
    ovr: Math.round(avgOvr(draft)),
    jogos: stats.jogos,
    rec: stats.rec,
    gols: stats.gols,
    saldo: stats.saldo,
    topScorer: top ? { name: top.name.toUpperCase(), goals: top.goals } : null,
    standings,
  }
}

/** HTML completo (com fontes embutidas + reset) pronto pra rasterizar. */
async function composeCardHtml(data: ShareCardData): Promise<string> {
  const fontCss = await loadEmbeddedFontCss()
  return `<style>*{box-sizing:border-box;margin:0;padding:0}${fontCss}</style>${cardHtml(data)}`
}

/** Gera o PNG do card (1080×1920) sem entregar — útil pra preview/teste. */
export async function generateOutcomeCardBlob(
  ctx: OutcomeContext,
  kind: OutcomeKind,
): Promise<Blob> {
  const data = buildShareCardData(ctx, kind)
  if (!data) throw new Error(`outcome "${kind}" não tem share card`)
  const html = await composeCardHtml(data)
  return htmlToPngBlob(html, { width: 1080, height: 1920 })
}

/** Gera e entrega o card. Lança se o outcome não tiver card (caller deve guardar). */
export async function generateAndShareOutcomeCard(
  ctx: OutcomeContext,
  kind: OutcomeKind,
  meta: { filename: string; text?: string; url?: string },
): Promise<ShareImageResult> {
  const blob = await generateOutcomeCardBlob(ctx, kind)
  return deliverShareImage(blob, meta)
}
