// Setup global do test runner: hidrata `src/data/squads.ts` a partir do JSON
// em disco (em runtime, o gate no `main.tsx` faz isso via fetch). Sem isso,
// os bindings mutáveis (`squads`, `groupedSquads`, etc) ficariam vazios
// durante os testes. readFileSync — Jest setupFiles não suporta top-level
// await em todos os configs; sync é mais portável.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { hydrateSquads, type Squad } from '../data/squads'

const path = resolve(process.cwd(), 'public/data/squads-enriched.json')
const raw = readFileSync(path, 'utf8')
hydrateSquads(JSON.parse(raw) as Squad[])
