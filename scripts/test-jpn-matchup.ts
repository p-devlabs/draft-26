/**
 * Smoke test do matchup que ficou estranho no playtest: XI 80 vs JPN 73,
 * usuário tomou 1-4.
 *
 * Pergunta: foi azar genuíno ou rubber-band não tá entrando?
 * Roda 30k sims em medium e checa:
 *   - win rate, draw, loss
 *   - distribuição de placares (top 10)
 *   - prob de derrota por 3 ou mais gols (tipo 1-4, 0-3, 2-5...)
 *   - prob exata de 1-4
 */
import { seededRng, simulateMatch, type Team } from '../src/lib/simulate'

const N = 30_000

function runScenario(label: string, opts?: { difficulty?: 'easy' | 'medium' | 'hard' }) {
  const user: Team = { code: 'YOU', averageOverall: 80, isUser: true }
  const jpn: Team = { code: 'JPN', averageOverall: 73 }

  let w = 0, d = 0, l = 0
  let blowoutLoss = 0 // derrota por 3+ gols de diferença
  let exact_1_4 = 0
  const scoreCounts: Record<string, number> = {}

  for (let i = 0; i < N; i++) {
    const rng = seededRng(i)
    const r = simulateMatch(user, jpn, rng, opts?.difficulty ? { difficulty: opts.difficulty } : undefined)
    const k = `${r.homeGoals}-${r.awayGoals}`
    scoreCounts[k] = (scoreCounts[k] ?? 0) + 1
    if (r.homeGoals > r.awayGoals) w++
    else if (r.homeGoals < r.awayGoals) l++
    else d++
    if (r.awayGoals - r.homeGoals >= 3) blowoutLoss++
    if (r.homeGoals === 1 && r.awayGoals === 4) exact_1_4++
  }

  const pct = (n: number) => ((n / N) * 100).toFixed(2) + '%'
  console.log()
  console.log(`▸ ${label}`)
  console.log(`  win:  ${pct(w)}`)
  console.log(`  draw: ${pct(d)}`)
  console.log(`  loss: ${pct(l)}`)
  console.log(`  derrota por 3+ gols (1-4, 0-3, etc): ${pct(blowoutLoss)}`)
  console.log(`  exato 1-4: ${pct(exact_1_4)}`)
  console.log(`  top 8 placares mais comuns:`)
  for (const [k, n] of Object.entries(scoreCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`    ${k}: ${pct(n)}`)
  }
}

console.log(`XI 80 (isUser=true) vs JPN 73 — N=${N}`)
runScenario('Sem difficulty (modelo puro, ignora isUser)')
runScenario('Easy (rubber-band reduzido)', { difficulty: 'easy' })
runScenario('Medium (configurado no app)', { difficulty: 'medium' })
runScenario('Hard (rubber-band ampliado)', { difficulty: 'hard' })
