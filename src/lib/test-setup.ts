// Vitest setup global: hidrata `src/data/squads.ts` a partir do JSON em disco
// (em runtime, o gate no `main.tsx` faz isso via fetch). Sem isso, os bindings
// mutáveis (`squads`, `groupedSquads`, etc) ficariam vazios durante os testes.
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { hydrateSquads, type Squad } from '../data/squads'

const path = resolve(process.cwd(), 'public/data/squads-enriched.json')
const raw = await readFile(path, 'utf8')
hydrateSquads(JSON.parse(raw) as Squad[])
