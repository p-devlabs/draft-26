/**
 * Smoke test do rubber-band — não vai pro pipeline, é só pra eyeballing.
 * Roda 30k jogos em vários cenários e imprime win-rate do XI.
 *
 * Estamos comparando: NONE (modelo puro), base=0.35 (configurado, "suave"),
 * base=0.7 ("médio"), base=1.0 ("forte"). Por sim sempre uso multiplier
 * "medium" (1.0) pra comparar bases entre si.
 */
import { simulateMatch } from '../src/lib/simulate'

const N = 30_000

// Pra simular bases diferentes sem mexer no sim-params.json, ajusto o overall
// do user na mão ANTES de chamar simulateMatch (sem passar difficulty pra ele).
function runScenario(userOverall: number, oppOverall: number, intensity: number) {
  let w = 0,
    d = 0,
    l = 0,
    gf = 0,
    ga = 0
  for (let i = 0; i < N; i++) {
    const effective = userOverall - intensity * (oppOverall - userOverall)
    const home = { averageOverall: effective }
    const away = { averageOverall: oppOverall }
    const r = simulateMatch(home, away)
    gf += r.homeGoals
    ga += r.awayGoals
    if (r.homeGoals > r.awayGoals) w++
    else if (r.homeGoals < r.awayGoals) l++
    else d++
  }
  return { w, d, l, gf, ga }
}

function run(userOverall: number, oppOverall: number, label: string) {
  console.log()
  console.log(
    `▸ ${label} — XI ${userOverall} vs adversário ${oppOverall} (gap ${(oppOverall - userOverall).toFixed(1)})`,
  )
  console.log('  intensidade        | overall efetivo |  vitórias |  empates |  derrotas')
  for (const [label, intensity] of [
    ['none', 0.0],
    ['suave   (base 0.35)', 0.35],
    ['médio   (base 0.70)', 0.7],
    ['forte   (base 1.00)', 1.0],
  ] as const) {
    const r = runScenario(userOverall, oppOverall, intensity)
    const eff = userOverall - intensity * (oppOverall - userOverall)
    const pct = (n: number) => ((n / N) * 100).toFixed(1) + '%'
    console.log(
      `  ${label.padEnd(18)} | ${eff.toFixed(2).padStart(15)} | ${pct(r.w).padStart(9)} | ${pct(r.d).padStart(8)} | ${pct(r.l).padStart(9)}`,
    )
  }
}

// User joga em casa nos 3 cenários
run(75, 80.6, 'XI mediano em casa vs Brasil (top)')
run(75, 75.0, 'XI mediano em casa vs time equivalente')
run(75, 68.8, 'XI mediano em casa vs Arábia (fraco)')
run(80, 83.3, 'XI forte em casa vs França (top)')
run(70, 67.5, 'XI fraco em casa vs Austrália (fraco)')
