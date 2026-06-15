/**
 * Verifica presença de data/fbref-players.csv. Esse arquivo vem do Kaggle:
 *
 *   https://www.kaggle.com/datasets/hubertsidorowicz/football-players-stats-2025-2026
 *
 * Diferente do FIFA (que tem mirrors públicos) e do Transfermarkt (que tem
 * dump ZIP open), o FBref via Kaggle precisa de cadastro Kaggle — sem API
 * anônima. Esse script só guia o usuário a baixar manualmente e seguir.
 *
 * Setup uma vez:
 *   1. Cadastra no Kaggle (gratis)
 *   2. Baixa o dataset acima → archive.zip
 *   3. Extrai → players_data_light-2025_2026.csv
 *   4. Renomeia/move pra data/fbref-players.csv
 *
 * Depois é só `pnpm enrich:fbref && pnpm calibrate:fbref`.
 */
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const CSV_PATH = resolve(process.cwd(), 'data/fbref-players.csv')

if (!existsSync(CSV_PATH)) {
  console.error('▸ data/fbref-players.csv não encontrado.')
  console.error()
  console.error('Pra baixar (uma vez):')
  console.error('  1. Cadastra grátis em kaggle.com')
  console.error('  2. https://www.kaggle.com/datasets/hubertsidorowicz/football-players-stats-2025-2026')
  console.error('  3. Baixa o ZIP, extrai players_data_light-2025_2026.csv')
  console.error('  4. Renomeia pra data/fbref-players.csv')
  console.error()
  console.error('Atualiza semanal — vale rebaixar pra novos jogos.')
  process.exit(1)
}

const stat = statSync(CSV_PATH)
const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24)
console.log(`▸ data/fbref-players.csv OK (${(stat.size / 1024).toFixed(0)} KB, ${ageDays.toFixed(0)}d atrás)`)
if (ageDays > 30) {
  console.log(`  ⚠ Tem mais de um mês — considera rebaixar do Kaggle pra cobrir transfers recentes.`)
}
