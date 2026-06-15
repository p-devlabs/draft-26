/**
 * Treina regressão linear `overall ~ f(stats, age)` por bucket posicional
 * usando os jogadores FIFA-matched com stats FBref e aplica em quem tem
 * FBref mas não tem FIFA. Marca esses como `ratingSource: 'fbref-fit'`.
 *
 * Buckets têm features diferentes:
 *   GK:  intercept + savePercent + cleanSheetPercent + (-)gaPer90 + age
 *   DEF: intercept + tacklesWonPer90 + interceptionsPer90 + minutes90 + age
 *   MID: intercept + goalsPer90 + assistsPer90 + shotsPer90 + minutes90 + age
 *   FWD: intercept + goalsPer90 + assistsPer90 + shotsPer90 + sotPer90 + age
 *
 * Por que separar bucket? Os sinais de "qualidade" de um goleiro são
 * completamente diferentes dos de um atacante; misturar tudo num modelo
 * só dilui demais.
 *
 * OLS via normal equations (X^T X)^-1 X^T y, implementado à mão pra evitar
 * dep externa. As matrizes são pequenas (≤6×6), Gauss-Jordan basta.
 *
 * Roda DEPOIS de enrich:fbref. Uso:
 *   pnpm calibrate:fbref
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type Bucket = 'GK' | 'DEF' | 'MID' | 'FWD'

interface FbrefStats {
  squad: string
  comp: string
  minutes90: number
  goalsPer90: number
  assistsPer90: number
  shotsPer90: number
  shotsOnTargetPer90: number
  tacklesWonPer90: number
  interceptionsPer90: number
  yellowsPer90: number
  redsPer90: number
  isKeeper: boolean
  savePercent: number | null
  cleanSheetPercent: number | null
  gaPer90: number | null
}

interface PlayerEnriched {
  shirt: number | null
  position: Bucket
  primaryPosition?: string
  altPositions?: string[]
  name: string
  isCaptain: boolean
  dateOfBirth: string | null
  age: number | null
  caps: number
  goals: number
  club: string
  clubCountry: string | null
  overall: number
  value_eur?: number | null
  value_eur_tm?: number | null
  value_eur_tm_peak?: number | null
  ratingSource?: string
  fbref?: FbrefStats
}

interface SquadEnriched {
  group: string
  country: string
  code: string
  flag: string
  coach: string | null
  formation: { primary: string; alternative: string; source: 'curated' | 'default' }
  players: PlayerEnriched[]
  averageOverall: number
}

// ────────────────────────────────────────────────────────────────────────
// Mini-OLS — Gauss-Jordan pra inversão de matriz pequena
// ────────────────────────────────────────────────────────────────────────

function invert(m: number[][]): number[][] {
  const n = m.length
  const a = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let i = 0; i < n; i++) {
    // pivot
    let pivot = i
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(a[k][i]) > Math.abs(a[pivot][i])) pivot = k
    }
    if (Math.abs(a[pivot][i]) < 1e-12) throw new Error('matriz singular')
    if (pivot !== i) [a[i], a[pivot]] = [a[pivot], a[i]]
    const div = a[i][i]
    for (let j = 0; j < 2 * n; j++) a[i][j] /= div
    for (let k = 0; k < n; k++) {
      if (k === i) continue
      const factor = a[k][i]
      for (let j = 0; j < 2 * n; j++) a[k][j] -= factor * a[i][j]
    }
  }
  return a.map((r) => r.slice(n))
}

function matMul(a: number[][], b: number[][]): number[][] {
  const m = a.length,
    n = a[0].length,
    p = b[0].length
  const out = Array.from({ length: m }, () => new Array(p).fill(0))
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      let s = 0
      for (let k = 0; k < n; k++) s += a[i][k] * b[k][j]
      out[i][j] = s
    }
  }
  return out
}

function transpose(a: number[][]): number[][] {
  const m = a.length,
    n = a[0].length
  const out = Array.from({ length: n }, () => new Array(m).fill(0))
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) out[j][i] = a[i][j]
  return out
}

/** OLS: β = (X^T X)^-1 X^T y. Retorna coeficientes (1 por coluna de X). */
function ols(X: number[][], y: number[]): number[] {
  const Xt = transpose(X)
  const XtX = matMul(Xt, X)
  const XtXinv = invert(XtX)
  const Xty = matMul(
    Xt,
    y.map((v) => [v]),
  )
  const beta = matMul(XtXinv, Xty)
  return beta.map((r) => r[0])
}

// ────────────────────────────────────────────────────────────────────────
// Features por bucket
// ────────────────────────────────────────────────────────────────────────

function featuresGK(p: PlayerEnriched): number[] | null {
  const f = p.fbref
  if (!f || !f.isKeeper) return null
  if (f.savePercent == null || f.cleanSheetPercent == null || f.gaPer90 == null) return null
  if (p.age == null) return null
  return [1, f.savePercent, f.cleanSheetPercent, f.gaPer90, p.age]
}

function featuresDEF(p: PlayerEnriched): number[] | null {
  const f = p.fbref
  if (!f || f.isKeeper) return null
  if (p.age == null) return null
  return [1, f.tacklesWonPer90, f.interceptionsPer90, f.minutes90, p.age]
}

function featuresMID(p: PlayerEnriched): number[] | null {
  const f = p.fbref
  if (!f || f.isKeeper) return null
  if (p.age == null) return null
  return [1, f.goalsPer90, f.assistsPer90, f.shotsPer90, f.minutes90, p.age]
}

function featuresFWD(p: PlayerEnriched): number[] | null {
  const f = p.fbref
  if (!f || f.isKeeper) return null
  if (p.age == null) return null
  return [1, f.goalsPer90, f.assistsPer90, f.shotsPer90, f.shotsOnTargetPer90, p.age]
}

const FEATURE_FN: Record<Bucket, (p: PlayerEnriched) => number[] | null> = {
  GK: featuresGK,
  DEF: featuresDEF,
  MID: featuresMID,
  FWD: featuresFWD,
}

const FEATURE_NAMES: Record<Bucket, string[]> = {
  GK: ['intercept', 'savePercent', 'cleanSheetPercent', 'gaPer90', 'age'],
  DEF: ['intercept', 'tacklesWonPer90', 'interceptionsPer90', 'minutes90', 'age'],
  MID: ['intercept', 'goalsPer90', 'assistsPer90', 'shotsPer90', 'minutes90', 'age'],
  FWD: ['intercept', 'goalsPer90', 'assistsPer90', 'shotsPer90', 'sotPer90', 'age'],
}

// ────────────────────────────────────────────────────────────────────────
// Pipeline
// ────────────────────────────────────────────────────────────────────────

async function main() {
  const root = process.cwd()
  const squads: SquadEnriched[] = JSON.parse(
    await readFile(resolve(root, 'public/data/squads-enriched.json'), 'utf8'),
  )

  const allPlayers: PlayerEnriched[] = []
  for (const sq of squads) allPlayers.push(...sq.players)

  const isFifa = (p: PlayerEnriched) => p.ratingSource === 'fifa' || p.ratingSource === 'fifa-fuzzy'

  const models: Partial<Record<Bucket, number[]>> = {}

  // Para cada bucket: treinar nos FIFA-matched com FBref
  for (const bucket of ['GK', 'DEF', 'MID', 'FWD'] as Bucket[]) {
    const featureFn = FEATURE_FN[bucket]
    const train = allPlayers.filter((p) => p.position === bucket && isFifa(p) && p.fbref)
    const Xrows: number[][] = []
    const yrows: number[] = []
    for (const p of train) {
      const x = featureFn(p)
      if (!x) continue
      Xrows.push(x)
      yrows.push(p.overall)
    }
    if (Xrows.length < FEATURE_NAMES[bucket].length + 2) {
      console.log(`▸ ${bucket}: pouco dado pra fitar (${Xrows.length} samples) — pulando`)
      continue
    }
    const beta = ols(Xrows, yrows)
    models[bucket] = beta

    // R² in-sample pra diagnóstico
    const meanY = yrows.reduce((a, b) => a + b, 0) / yrows.length
    let ssRes = 0,
      ssTot = 0
    for (let i = 0; i < Xrows.length; i++) {
      const pred = Xrows[i].reduce((s, v, j) => s + v * beta[j], 0)
      ssRes += (yrows[i] - pred) ** 2
      ssTot += (yrows[i] - meanY) ** 2
    }
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0
    console.log(`▸ ${bucket}: fit em ${Xrows.length} jogadores, R²=${r2.toFixed(3)}`)
    console.log(
      `  β: ` + FEATURE_NAMES[bucket].map((n, j) => `${n}=${beta[j].toFixed(2)}`).join(' · '),
    )
  }

  // Aplica nos non-FIFA com FBref stats
  const stats = { upgraded: 0, skippedNoFbref: 0, skippedNoModel: 0 }
  const upgrades: string[] = []

  for (const sq of squads) {
    for (const p of sq.players) {
      if (isFifa(p)) continue
      if (!p.fbref) {
        stats.skippedNoFbref++
        continue
      }
      const beta = models[p.position]
      if (!beta) {
        stats.skippedNoModel++
        continue
      }
      const featureFn = FEATURE_FN[p.position]
      const x = featureFn(p)
      if (!x) continue
      let predicted = x.reduce((s, v, j) => s + v * beta[j], 0)
      // Clamp 40-99 pra estar na escala FIFA.
      predicted = Math.max(40, Math.min(99, Math.round(predicted)))
      const before = p.overall
      p.overall = predicted
      p.ratingSource = 'fbref-fit'
      stats.upgraded++
      if (upgrades.length < 15) {
        upgrades.push(`${sq.code} ${p.name} (${p.position}, ${p.club}): ${before} → ${predicted}`)
      }
    }
  }

  // Recalcula averageOverall por seleção
  for (const sq of squads) {
    sq.averageOverall =
      Math.round((sq.players.reduce((s, p) => s + p.overall, 0) / sq.players.length) * 10) / 10
  }

  await writeFile(
    resolve(root, 'public/data/squads-enriched.json'),
    JSON.stringify(squads, null, 2),
  )

  console.log()
  console.log('▸ calibrate:fbref — apply')
  console.log(`▸ upgraded:                ${stats.upgraded}`)
  console.log(`▸ skipped (sem FBref):     ${stats.skippedNoFbref}`)
  console.log(`▸ skipped (sem modelo):    ${stats.skippedNoModel}`)
  if (upgrades.length > 0) {
    console.log()
    console.log('▸ Amostras de upgrade:')
    for (const u of upgrades) console.log(`  · ${u}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
