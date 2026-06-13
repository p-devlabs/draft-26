/**
 * Smoke test do mando restrito aos países-sede.
 */
import { simulateMatch } from '../src/lib/simulate'

const N = 30_000

function run(homeCode: string, homeOverall: number, awayCode: string, awayOverall: number) {
  let w = 0, d = 0, l = 0
  for (let i = 0; i < N; i++) {
    const r = simulateMatch(
      { code: homeCode, averageOverall: homeOverall },
      { code: awayCode, averageOverall: awayOverall },
    )
    if (r.homeGoals > r.awayGoals) w++
    else if (r.homeGoals < r.awayGoals) l++
    else d++
  }
  const pct = (n: number) => ((n / N) * 100).toFixed(1) + '%'
  console.log(
    `  ${homeCode} ${homeOverall} (casa) vs ${awayCode} ${awayOverall}: ${pct(w)} W / ${pct(d)} E / ${pct(l)} D`,
  )
}

console.log('▸ Hosts em casa (mando ativo):')
run('USA', 74.7, 'BRA', 80.6)
run('MEX', 72.1, 'BRA', 80.6)
run('CAN', 71.7, 'BRA', 80.6)
run('USA', 74.7, 'MEX', 72.1)  // host vs host = neutro

console.log()
console.log('▸ Neutros (sem mando):')
run('BRA', 80.6, 'ARG', 81.1)
run('FRA', 83.3, 'ESP', 82.8)
run('GER', 81.7, 'POR', 81.5)
run('BRA', 80.6, 'BRA', 80.6)

console.log()
console.log('▸ Não-host em casa vs host visitante (host ganha mando):')
run('BRA', 80.6, 'USA', 74.7)
run('FRA', 83.3, 'MEX', 72.1)
