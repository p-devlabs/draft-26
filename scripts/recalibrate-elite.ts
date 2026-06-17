/**
 * Recalibração "elite-2026" — ajusta a distribuição de overall pra refletir
 * que a Copa é o SOTA do futebol mundial. Aplica em duas camadas:
 *
 * 1. Função piecewise linear monotônica (smooth, sem clusters):
 *    breakpoints (original → new):
 *      ≤ 60 → 71  (floor)
 *      70   → 76
 *      80   → 82
 *      85   → 87
 *      90   → 92
 *      ≥ 91 → unchanged
 *    Bump pesado na cauda fraca (+6 a +11) e leve no topo (+2). Sem
 *    descontinuidades nem clusters artificiais.
 *
 * 2. Overlay curado em data/star-overrides.json — define piso por nome
 *    pros ícones que o bump não alcança (Messi/CR7 etc).
 *
 * Cada player ganha `originalOverall` (audit) e `calibration: 'elite-2026'`.
 * O `averageOverall` de cada squad é recomputado em cima dos novos ratings.
 * Idempotente: re-rodar usa `originalOverall` como base, não composta.
 *
 * Como rodar: pnpm recalibrate:elite
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SQUADS_PATH = resolve('public/data/squads-enriched.json')
const STARS_PATH = resolve('data/star-overrides.json')

interface Player {
  name: string
  overall: number
  originalOverall?: number
  calibration?: string
  [k: string]: unknown
}

interface Squad {
  code: string
  country: string
  players: Player[]
  averageOverall: number
  [k: string]: unknown
}

interface StarOverride {
  name: string
  countryCode: string
  rating: number
  note?: string
}

interface StarOverlay {
  version: string
  stars: StarOverride[]
}

/** Piecewise linear breakpoints: (original, new). Monotônico. */
const BREAKPOINTS: ReadonlyArray<readonly [number, number]> = [
  [0, 71],
  [60, 71],
  [70, 76],
  [80, 82],
  [85, 87],
  [90, 92],
]

/**
 * Aplica a função piecewise linear. Players a partir de 91 ficam unchanged
 * (já são elite — o overlay de estrelas mexe nesses caso a caso). Trata o
 * input como inteiro; arredonda o output e clampa em [71, 99].
 */
export function rebumpOverall(original: number): number {
  if (original >= 91) return Math.min(99, original)
  for (let i = 0; i < BREAKPOINTS.length - 1; i++) {
    const [x0, y0] = BREAKPOINTS[i]
    const [x1, y1] = BREAKPOINTS[i + 1]
    if (original >= x0 && original <= x1) {
      const t = x1 === x0 ? 0 : (original - x0) / (x1 - x0)
      return Math.max(71, Math.min(99, Math.round(y0 + t * (y1 - y0))))
    }
  }
  // Acima do último breakpoint (90) mas < 91 — não deveria acontecer com ints.
  return Math.max(91, Math.min(99, original))
}

function buildStarIndex(overlay: StarOverlay): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of overlay.stars) {
    map.set(`${s.countryCode}::${s.name}`, s.rating)
  }
  return map
}

function main(): void {
  const squads: Squad[] = JSON.parse(readFileSync(SQUADS_PATH, 'utf8'))
  const overlay: StarOverlay = JSON.parse(readFileSync(STARS_PATH, 'utf8'))
  const stars = buildStarIndex(overlay)

  let touched = 0
  let unchanged = 0
  let starHits = 0

  for (const squad of squads) {
    for (const p of squad.players) {
      const before = p.originalOverall ?? p.overall
      let after = rebumpOverall(before)
      const starKey = `${squad.code}::${p.name}`
      const starRating = stars.get(starKey)
      if (starRating != null) {
        after = Math.max(after, starRating)
        starHits++
      }
      if (after !== before) {
        if (p.originalOverall == null) p.originalOverall = before
        p.overall = after
        p.calibration = overlay.version
        touched++
      } else {
        unchanged++
      }
    }
    // Recomputa averageOverall com os ratings novos. Mantém precisão 1 casa
    // (era o que aparecia no arquivo original).
    const sum = squad.players.reduce((acc, p) => acc + p.overall, 0)
    squad.averageOverall = Math.round((sum / squad.players.length) * 10) / 10
  }

  writeFileSync(SQUADS_PATH, JSON.stringify(squads, null, 2) + '\n')

  console.log(`[recalibrate-elite] aplicado a ${squads.length} seleções`)
  console.log(`  ${touched} players bumpados`)
  console.log(`  ${unchanged} unchanged`)
  console.log(`  ${starHits} hits do overlay de estrelas`)
}

main()
