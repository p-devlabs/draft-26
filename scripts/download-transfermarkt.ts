/**
 * Baixa o pacote do dcaribou/transfermarkt-datasets (~220 MB ZIP), extrai
 * só players.csv.gz, descomprime, salva em data/transfermarkt-players.csv
 * (~4 MB) e descarta o ZIP.
 *
 * Fonte: github.com/dcaribou/transfermarkt-datasets (CC-BY-NC, atualização semanal)
 *
 * Uso: pnpm download:transfermarkt
 */
import { execSync } from 'node:child_process'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const URL = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/transfermarkt-datasets.zip'

async function main() {
  const root = process.cwd()
  const tmp = resolve(root, 'data/.tm-tmp')
  const zipPath = resolve(tmp, 'tm.zip')
  const outCsv = resolve(root, 'data/transfermarkt-players.csv')

  await mkdir(tmp, { recursive: true })

  console.log(`▸ fetch ${URL}  (~220 MB)`)
  const res = await fetch(URL)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(zipPath, buf)
  console.log(`▸ baixado: ${(buf.length / 1024 / 1024).toFixed(0)} MB`)

  console.log(`▸ extraindo players.csv.gz`)
  execSync(`unzip -o "${zipPath}" players.csv.gz -d "${tmp}"`, { stdio: 'inherit' })
  execSync(`gunzip -f "${tmp}/players.csv.gz"`)
  execSync(`mv "${tmp}/players.csv" "${outCsv}"`)

  await rm(tmp, { recursive: true, force: true })
  console.log(`▸ wrote ${outCsv}`)
}

// Mantém createReadStream/createWriteStream import pra signalar dependência
// caso queiramos migrar pro streaming no futuro (evita 220 MB em memória).
void createReadStream
void createWriteStream

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
