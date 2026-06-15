/**
 * Calibra o parâmetro ρ de Dixon-Coles contra dados reais de jogos de seleção.
 *
 * Estratégia:
 *   1. Carrega data/international-matches.csv
 *   2. Filtra: jogos competitivos (não-amistosos) desde 2018-01-01
 *      — janela temporal alinhada ao regime atual do futebol de seleção
 *   3. Calcula frequências EMPÍRICAS dos 4 placares baixos (0-0, 1-0, 0-1, 1-1)
 *   4. Calcula taxa média de gols home (λ) e away (μ) na amostra — usado como
 *      "jogo típico" pra avaliação do modelo
 *   5. Grid search em ρ ∈ [-0.25, +0.10]: pra cada ρ, calcula as 4 probs
 *      preditas (Dixon-Coles com λ,μ médios) e escolhe o ρ que minimiza
 *      MSE entre observed × predicted
 *   6. Escreve data/sim-params.json — usado em runtime por src/lib/simulate.ts
 *
 * IMPORTANTE: essa é a versão "fit só ρ com λ,μ médios", não MLE completo de
 * Dixon-Coles (que fitaria também α/β por seleção). Suficiente porque nosso
 * `averageOverall` já é a estimativa de força — só queremos calibrar a forma
 * da distribuição perto de 0.
 *
 * Uso: pnpm calibrate:sim
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import Papa from 'papaparse'

const MIN_DATE = '2018-01-01' // pós-Copa 2018, regime moderno de jogo
const SAFETY_MAX_GOALS = 12 // mais alto que o do runtime (8) pra ter freqs estáveis

interface MatchRow {
  date: string
  home_team: string
  away_team: string
  home_score: string
  away_score: string
  tournament: string
  neutral: string
}

function poissonPmf(k: number, lambda: number): number {
  let p = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) p *= lambda / i
  return p
}

function tau(x: number, y: number, lambda: number, mu: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lambda * mu * rho
  if (x === 0 && y === 1) return 1 + lambda * rho
  if (x === 1 && y === 0) return 1 + mu * rho
  if (x === 1 && y === 1) return 1 - rho
  return 1
}

/** Probabilidade prevista de (x,y) sob Dixon-Coles, normalizada num grid finito. */
function predictedFreqs(
  lambda: number,
  mu: number,
  rho: number,
  cells: Array<[number, number]>,
): number[] {
  let total = 0
  for (let x = 0; x <= SAFETY_MAX_GOALS; x++) {
    for (let y = 0; y <= SAFETY_MAX_GOALS; y++) {
      total += poissonPmf(x, lambda) * poissonPmf(y, mu) * tau(x, y, lambda, mu, rho)
    }
  }
  return cells.map(
    ([x, y]) => (poissonPmf(x, lambda) * poissonPmf(y, mu) * tau(x, y, lambda, mu, rho)) / total,
  )
}

async function main() {
  const root = process.cwd()
  const csv = await readFile(resolve(root, 'data/international-matches.csv'), 'utf8')
  const { data } = Papa.parse<MatchRow>(csv, { header: true, skipEmptyLines: true })

  // Filtros
  const filtered = data.filter((r) => {
    if (!r.date || r.date < MIN_DATE) return false
    if (!r.home_score || !r.away_score) return false
    if (!r.tournament) return false
    if (r.tournament.toLowerCase() === 'friendly') return false
    const h = parseInt(r.home_score, 10)
    const a = parseInt(r.away_score, 10)
    if (!Number.isFinite(h) || !Number.isFinite(a)) return false
    return true
  })

  console.log(`▸ Dataset: ${data.length.toLocaleString()} jogos totais`)
  console.log(`▸ Filtro (competitivos, >= ${MIN_DATE}): ${filtered.length.toLocaleString()} jogos`)

  // Quebra por tipo pra dar visibilidade
  const byTournament: Record<string, number> = {}
  for (const r of filtered) byTournament[r.tournament] = (byTournament[r.tournament] || 0) + 1
  const topTournaments = Object.entries(byTournament)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  console.log(`▸ Top torneios na amostra:`)
  for (const [t, n] of topTournaments) console.log(`    ${n.toString().padStart(5)}  ${t}`)
  console.log()

  // Estatísticas agregadas
  let sumHome = 0
  let sumAway = 0
  const obs = { '0-0': 0, '1-0': 0, '0-1': 0, '1-1': 0 } as Record<string, number>
  let draws = 0
  for (const r of filtered) {
    const h = parseInt(r.home_score, 10)
    const a = parseInt(r.away_score, 10)
    // Em jogos neutros (campos terceiros), descartar mando: ambos contam pra ambos
    // ou simplesmente excluir do cálculo do λ,μ médios? Vou MANTER (mando padrão da literatura
    // já cobre isso na média global). O efeito final é uma underestimation leve do HOME_ADVANTAGE.
    sumHome += h
    sumAway += a
    if (h === a) draws++
    const key = `${h}-${a}`
    if (key in obs) obs[key]++
  }
  const n = filtered.length
  const lambdaAvg = sumHome / n
  const muAvg = sumAway / n

  console.log(`▸ Taxa média home (λ): ${lambdaAvg.toFixed(3)}  gols/jogo`)
  console.log(`▸ Taxa média away (μ): ${muAvg.toFixed(3)}  gols/jogo`)
  console.log(`▸ Total: ${(lambdaAvg + muAvg).toFixed(3)}  gols/jogo  (modelo usa 2.6)`)
  console.log(`▸ % empates: ${((draws / n) * 100).toFixed(1)}%`)
  console.log()

  const cells: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]
  const observedFreqs = cells.map(([x, y]) => obs[`${x}-${y}`] / n)
  console.log(`▸ Frequências observadas:`)
  for (let i = 0; i < cells.length; i++) {
    const [x, y] = cells[i]
    console.log(
      `    ${x}-${y}:  ${(observedFreqs[i] * 100).toFixed(2)}%  (${obs[`${x}-${y}`]} jogos)`,
    )
  }
  console.log()

  // Grid search em ρ
  let bestRho = 0
  let bestMse = Infinity
  let bestPred: number[] = []
  const sweep: Array<{ rho: number; mse: number }> = []
  for (let rho = -0.25; rho <= 0.105; rho += 0.005) {
    const pred = predictedFreqs(lambdaAvg, muAvg, rho, cells)
    const mse = pred.reduce((s, p, i) => s + Math.pow(p - observedFreqs[i], 2), 0) / cells.length
    sweep.push({ rho: Math.round(rho * 1000) / 1000, mse })
    if (mse < bestMse) {
      bestMse = mse
      bestRho = Math.round(rho * 1000) / 1000
      bestPred = pred
    }
  }

  // Baseline: Poisson independente (ρ=0)
  const baselinePred = predictedFreqs(lambdaAvg, muAvg, 0, cells)
  const baselineMse =
    baselinePred.reduce((s, p, i) => s + Math.pow(p - observedFreqs[i], 2), 0) / cells.length

  console.log(`▸ Resultado da calibração:`)
  console.log(`    ρ ótimo:        ${bestRho.toFixed(3)}`)
  console.log(`    MSE @ ρ ótimo:  ${bestMse.toExponential(2)}`)
  console.log(`    MSE @ ρ = 0:    ${baselineMse.toExponential(2)}  (Poisson independente)`)
  console.log(`    Redução de MSE: ${((1 - bestMse / baselineMse) * 100).toFixed(0)}%`)
  console.log()
  console.log(`▸ Frequências (observado / Poisson ρ=0 / Dixon-Coles ρ=${bestRho}):`)
  for (let i = 0; i < cells.length; i++) {
    const [x, y] = cells[i]
    console.log(
      `    ${x}-${y}:  obs ${(observedFreqs[i] * 100).toFixed(2)}%   ` +
        `pois ${(baselinePred[i] * 100).toFixed(2)}%   ` +
        `DC ${(bestPred[i] * 100).toFixed(2)}%`,
    )
  }
  console.log()

  const params = {
    rho: bestRho,
    homeAdvantage: 2, // mantido como constante por enquanto; futura calibração separa
    avgGoalsPerMatch: 2.6, // idem
    calibration: {
      calibratedAt: new Date().toISOString().slice(0, 10),
      source: 'github.com/martj42/international_results',
      filter: `competitive matches >= ${MIN_DATE}`,
      nMatches: n,
      empiricalAvgGoalsHome: Math.round(lambdaAvg * 1000) / 1000,
      empiricalAvgGoalsAway: Math.round(muAvg * 1000) / 1000,
      observedFreq: Object.fromEntries(
        cells.map(([x, y], i) => [`${x}-${y}`, Math.round(observedFreqs[i] * 10000) / 10000]),
      ),
      fittedFreq: Object.fromEntries(
        cells.map(([x, y], i) => [`${x}-${y}`, Math.round(bestPred[i] * 10000) / 10000]),
      ),
      mse: Number(bestMse.toExponential(4)),
      mseBaseline: Number(baselineMse.toExponential(4)),
    },
  }

  const out = resolve(root, 'data/sim-params.json')
  await writeFile(out, JSON.stringify(params, null, 2) + '\n')
  console.log(`▸ wrote ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
