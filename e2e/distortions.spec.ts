/**
 * E2E de distorções: roda N campanhas completas via `window.__draft26__`
 * (exposto em dev mode), agrega estatísticas e grava um report.
 *
 * Por que via window e não import direto? Pra que o Playwright exercite o
 * MESMO código bundlado que vai pra produção. Se um bug aparece só depois
 * do Vite tree-shaking ou da divisão de módulos, este teste pega.
 *
 * Saída: reports/distortions-{timestamp}.json + .md.
 *
 * Uso: pnpm sim:distortions
 *      pnpm sim:distortions --count=200    (override via env DRAFT26_RUNS)
 */
import { test, expect } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

type RunResult = {
  seed: number
  xi: {
    formation: string
    overall: number
    players: Array<{ name: string; country: string; countryCode: string; primary: string; overall: number; position: string }>
  }
  groupStage: {
    letter: string
    position: 1 | 2 | 3 | 4
    points: number
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
    fate: string
    replaced: { code: string; name: string }
    matches: Array<{ round: 1 | 2 | 3; opp: string; oppCode: string; oppOverall: number; userGoals: number; oppGoals: number; result: 'W' | 'D' | 'L'; margin: number }>
  }
  qualified: boolean
  knockout: {
    matches: Array<{ round: string; opp: string; oppCode: string; oppOverall: number; userGoals: number; oppGoals: number; extraTime?: { userGoals: number; oppGoals: number }; penalties?: { userScored: number; oppScored: number }; result: 'W' | 'L'; margin: number }>
    finalPhase: string
    eliminatedBy?: { code: string; name: string; round: string }
  }
  biggestWin: { margin: number; opp: string; phase: string; score: string } | null
  worstLoss: { margin: number; opp: string; phase: string; score: string } | null
}

const RUNS = Number(process.env.DRAFT26_RUNS ?? 50)

test('distorções: roda N campanhas e grava report', async ({ page }) => {
  test.setTimeout(120_000) // 2min é mais que suficiente pra 50-200 runs

  // ?dev=1 expõe window.__draft26__
  await page.goto('/?dev=1')

  // Garante que o flag pegou + harness foi instalado
  await page.waitForFunction(() => '__draft26__' in window, { timeout: 10_000 })

  console.log(`▸ rodando ${RUNS} simulações no browser…`)
  const start = Date.now()

  const results: RunResult[] = await page.evaluate(({ count }) => {
    const w = window as unknown as { __draft26__: { runDistortionBatch: (n: number, seed: number) => RunResult[] } }
    return w.__draft26__.runDistortionBatch(count, 1_000)
  }, { count: RUNS })

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`▸ ${results.length} runs em ${elapsed}s`)
  expect(results).toHaveLength(RUNS)

  // ── Agregações ────────────────────────────────────────────────────────
  const report = analyze(results)
  printSummary(report)

  // ── Persistir ─────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outDir = resolve(process.cwd(), 'reports')
  mkdirSync(outDir, { recursive: true })

  const jsonPath = resolve(outDir, `distortions-${timestamp}.json`)
  writeFileSync(jsonPath, JSON.stringify({ runs: results, report }, null, 2))
  console.log(`▸ JSON detalhado: ${jsonPath}`)

  const mdPath = resolve(outDir, `distortions-${timestamp}.md`)
  writeFileSync(mdPath, renderMarkdown(report, RUNS, elapsed))
  console.log(`▸ Markdown sumário: ${mdPath}`)
})

// ────────────────────────────────────────────────────────────────────────
// Análise
// ────────────────────────────────────────────────────────────────────────

interface Report {
  totalRuns: number
  xiOverall: { min: number; max: number; mean: number; median: number }
  phaseDistribution: Record<string, number>
  qualificationRate: number
  groupPositions: Record<1 | 2 | 3 | 4, number>
  biggestWinEver: NonNullable<RunResult['biggestWin']> & { seed: number } | null
  worstLossEver: NonNullable<RunResult['worstLoss']> & { seed: number } | null
  topPlayers: Array<{ name: string; country: string; count: number }>
  topReplacedTeams: Array<{ code: string; name: string; count: number }>
  champions: Array<{ seed: number; xiOverall: number; players: string[] }>
  weirdRuns: Array<{ seed: number; why: string; detail: string }>
  formationDistribution: Record<string, number>
  groupLetterDistribution: Record<string, number>
}

function analyze(runs: RunResult[]): Report {
  const overalls = runs.map((r) => r.xi.overall).sort((a, b) => a - b)
  const mean = overalls.reduce((a, b) => a + b, 0) / overalls.length
  const median = overalls[Math.floor(overalls.length / 2)]

  const phaseDistribution: Record<string, number> = {}
  const groupPositions: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const playerCounts = new Map<string, { name: string; country: string; count: number }>()
  const replacedCounts = new Map<string, { code: string; name: string; count: number }>()
  const formationDistribution: Record<string, number> = {}
  const groupLetterDistribution: Record<string, number> = {}
  const champions: Report['champions'] = []
  const weirdRuns: Report['weirdRuns'] = []

  let biggestWinEver: Report['biggestWinEver'] = null
  let worstLossEver: Report['worstLossEver'] = null

  for (const r of runs) {
    phaseDistribution[r.knockout.finalPhase] = (phaseDistribution[r.knockout.finalPhase] ?? 0) + 1
    groupPositions[r.groupStage.position]++
    formationDistribution[r.xi.formation] = (formationDistribution[r.xi.formation] ?? 0) + 1
    groupLetterDistribution[r.groupStage.letter] = (groupLetterDistribution[r.groupStage.letter] ?? 0) + 1

    for (const p of r.xi.players) {
      const k = p.country + '/' + p.name
      const existing = playerCounts.get(k)
      if (existing) existing.count++
      else playerCounts.set(k, { name: p.name, country: p.country, count: 1 })
    }

    const rk = r.groupStage.replaced.code
    if (rk) {
      const existing = replacedCounts.get(rk)
      if (existing) existing.count++
      else replacedCounts.set(rk, { code: rk, name: r.groupStage.replaced.name, count: 1 })
    }

    if (r.biggestWin && (!biggestWinEver || r.biggestWin.margin > biggestWinEver.margin)) {
      biggestWinEver = { ...r.biggestWin, seed: r.seed }
    }
    if (r.worstLoss && (!worstLossEver || r.worstLoss.margin < worstLossEver.margin)) {
      worstLossEver = { ...r.worstLoss, seed: r.seed }
    }

    if (r.knockout.finalPhase === 'CHAMPION') {
      champions.push({
        seed: r.seed,
        xiOverall: r.xi.overall,
        players: r.xi.players.map((p) => `${p.name} (${p.countryCode})`),
      })
    }

    // Heurísticas de outliers — coisas pra olhar com calma
    if (r.qualified && r.groupStage.position === 3 && r.groupStage.points <= 2) {
      weirdRuns.push({
        seed: r.seed,
        why: '3º com ≤2 pts classificou',
        detail: `pts ${r.groupStage.points}, GF ${r.groupStage.goalsFor}, GA ${r.groupStage.goalsAgainst}`,
      })
    }
    if (!r.qualified && r.groupStage.position === 3 && r.groupStage.points >= 5) {
      weirdRuns.push({
        seed: r.seed,
        why: '3º com ≥5 pts NÃO classificou',
        detail: `pts ${r.groupStage.points}`,
      })
    }
    if (r.biggestWin && r.biggestWin.margin >= 6) {
      weirdRuns.push({
        seed: r.seed,
        why: 'goleada de 6+ gols',
        detail: `${r.biggestWin.score} vs ${r.biggestWin.opp} (${r.biggestWin.phase})`,
      })
    }
    if (r.worstLoss && r.worstLoss.margin <= -6) {
      weirdRuns.push({
        seed: r.seed,
        why: 'levou de 6+ gols',
        detail: `${r.worstLoss.score} vs ${r.worstLoss.opp} (${r.worstLoss.phase})`,
      })
    }
  }

  const topPlayers = [...playerCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
  const topReplaced = [...replacedCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  return {
    totalRuns: runs.length,
    xiOverall: { min: overalls[0], max: overalls[overalls.length - 1], mean: round1(mean), median },
    phaseDistribution,
    qualificationRate: round3(runs.filter((r) => r.qualified).length / runs.length),
    groupPositions,
    biggestWinEver,
    worstLossEver,
    topPlayers,
    topReplacedTeams: topReplaced,
    champions,
    weirdRuns,
    formationDistribution,
    groupLetterDistribution,
  }
}

function round1(n: number) { return Math.round(n * 10) / 10 }
function round3(n: number) { return Math.round(n * 1000) / 1000 }

function printSummary(r: Report) {
  console.log()
  console.log('═════════════════════════════════════════════════════')
  console.log(`▸ ${r.totalRuns} runs`)
  console.log(`▸ XI overall: min ${r.xiOverall.min} | mean ${r.xiOverall.mean} | median ${r.xiOverall.median} | max ${r.xiOverall.max}`)
  console.log(`▸ Taxa de classificação: ${(r.qualificationRate * 100).toFixed(1)}%`)
  console.log()
  console.log('Distribuição de fase final:')
  for (const [k, v] of Object.entries(r.phaseDistribution).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(16)} ${v.toString().padStart(3)}  (${((v / r.totalRuns) * 100).toFixed(1)}%)`)
  }
  console.log()
  console.log('Posição final no grupo:')
  for (const pos of [1, 2, 3, 4] as const) {
    const n = r.groupPositions[pos]
    console.log(`  ${pos}º  ${n.toString().padStart(3)}  (${((n / r.totalRuns) * 100).toFixed(1)}%)`)
  }
  console.log()
  if (r.biggestWinEver) {
    console.log(`▸ Maior vitória: ${r.biggestWinEver.score} vs ${r.biggestWinEver.opp} (${r.biggestWinEver.phase}) [seed ${r.biggestWinEver.seed}]`)
  }
  if (r.worstLossEver) {
    console.log(`▸ Pior derrota:  ${r.worstLossEver.score} vs ${r.worstLossEver.opp} (${r.worstLossEver.phase}) [seed ${r.worstLossEver.seed}]`)
  }
  console.log()
  if (r.champions.length > 0) {
    console.log(`▸ Campeões: ${r.champions.length}`)
    for (const c of r.champions.slice(0, 5)) {
      console.log(`  seed ${c.seed} | XI ${c.xiOverall}`)
    }
  }
  if (r.weirdRuns.length > 0) {
    console.log()
    console.log(`▸ ${r.weirdRuns.length} runs pra olhar:`)
    for (const w of r.weirdRuns.slice(0, 10)) {
      console.log(`  seed ${w.seed}: ${w.why} — ${w.detail}`)
    }
  }
}

function renderMarkdown(r: Report, n: number, elapsedSec: string): string {
  const pct = (v: number) => `${((v / r.totalRuns) * 100).toFixed(1)}%`
  let out = `# Distorções — ${n} runs (${elapsedSec}s)\n\n`
  out += `## Sumário\n\n`
  out += `- **XI overall**: min ${r.xiOverall.min} · mean ${r.xiOverall.mean} · median ${r.xiOverall.median} · max ${r.xiOverall.max}\n`
  out += `- **Taxa de classificação**: ${(r.qualificationRate * 100).toFixed(1)}%\n\n`

  out += `## Fase final\n\n| Fase | Runs | % |\n|---|---|---|\n`
  for (const [k, v] of Object.entries(r.phaseDistribution).sort((a, b) => b[1] - a[1])) {
    out += `| ${k} | ${v} | ${pct(v)} |\n`
  }

  out += `\n## Posição final no grupo\n\n| Posição | Runs | % |\n|---|---|---|\n`
  for (const pos of [1, 2, 3, 4] as const) {
    out += `| ${pos}º | ${r.groupPositions[pos]} | ${pct(r.groupPositions[pos])} |\n`
  }

  if (r.biggestWinEver) {
    out += `\n## Maior vitória\n\n**${r.biggestWinEver.score}** vs ${r.biggestWinEver.opp} (${r.biggestWinEver.phase}) — seed ${r.biggestWinEver.seed}\n`
  }
  if (r.worstLossEver) {
    out += `\n## Pior derrota\n\n**${r.worstLossEver.score}** vs ${r.worstLossEver.opp} (${r.worstLossEver.phase}) — seed ${r.worstLossEver.seed}\n`
  }

  out += `\n## Campeões (${r.champions.length})\n\n`
  for (const c of r.champions) {
    out += `### seed ${c.seed} — XI ${c.xiOverall}\n`
    out += c.players.map((p) => `- ${p}`).join('\n') + '\n\n'
  }

  out += `\n## Top jogadores mais escolhidos\n\n| Jogador | País | Vezes |\n|---|---|---|\n`
  for (const p of r.topPlayers) {
    out += `| ${p.name} | ${p.country} | ${p.count} |\n`
  }

  out += `\n## Top times substituídos pelo XI\n\n| Time | Vezes |\n|---|---|\n`
  for (const t of r.topReplacedTeams) {
    out += `| ${t.name} (${t.code}) | ${t.count} |\n`
  }

  out += `\n## Distribuição de formação\n\n| Formação | Runs | % |\n|---|---|---|\n`
  for (const [k, v] of Object.entries(r.formationDistribution).sort((a, b) => b[1] - a[1])) {
    out += `| ${k} | ${v} | ${pct(v)} |\n`
  }

  out += `\n## Distribuição de grupo\n\n| Grupo | Runs | % |\n|---|---|---|\n`
  for (const [k, v] of Object.entries(r.groupLetterDistribution).sort()) {
    out += `| ${k} | ${v} | ${pct(v)} |\n`
  }

  if (r.weirdRuns.length > 0) {
    out += `\n## Outliers pra revisar\n\n`
    for (const w of r.weirdRuns) {
      out += `- seed **${w.seed}**: ${w.why} — ${w.detail}\n`
    }
  }
  return out
}
