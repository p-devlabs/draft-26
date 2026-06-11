/**
 * Baixa o dataset de jogos internacionais (martj42/international_results) do GitHub.
 *
 * ~46k jogos de seleção desde 1872 até hoje, com colunas:
 *   date, home_team, away_team, home_score, away_score, tournament, city, country, neutral
 *
 * Usado por scripts/calibrate-sim.ts pra fitar o ρ de Dixon-Coles contra
 * frequências reais de placares baixos.
 *
 * CSV (~2 MB) é gitignored — re-baixa sempre que `pnpm data:rebuild`.
 *
 * Uso: pnpm download:matches
 */
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const URL = 'https://raw.githubusercontent.com/martj42/international_results/master/results.csv'

async function main() {
  console.log(`▸ baixando ${URL}`)
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const text = await res.text()
  const out = resolve(process.cwd(), 'data/international-matches.csv')
  await writeFile(out, text)
  const lines = text.split('\n').length - 1
  console.log(`▸ ${(text.length / 1024 / 1024).toFixed(2)} MB · ${lines.toLocaleString()} linhas`)
  console.log(`▸ wrote ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
