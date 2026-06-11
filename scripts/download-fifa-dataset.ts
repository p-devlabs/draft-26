/**
 * Baixa o CSV do EAFC26-DataHub (10 MB, ~18k jogadores) pra data/eafc26-players.csv.
 *
 * O CSV é consumido por enrich-with-fifa.ts e não vai pro git por ser grande
 * e derivável. Re-baixe quando o upstream atualizar.
 *
 * Fonte: github.com/ismailoksuz/EAFC26-DataHub (CC-BY na licença do repo)
 *
 * Uso: pnpm download:fifa
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'

const URL =
  'https://raw.githubusercontent.com/ismailoksuz/EAFC26-DataHub/main/data/players.csv'

async function main() {
  const out = resolve(process.cwd(), 'data/eafc26-players.csv')
  console.log(`▸ fetch ${URL}`)
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, buf)
  console.log(`▸ wrote ${out} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
