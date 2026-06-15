import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Lib-only por enquanto: nada de DOM. Se algum dia testes de rotas
    // entrarem, mudar pra "jsdom" + adicionar @testing-library/react.
    environment: 'node',
    include: ['src/lib/**/*.test.ts', 'scripts/**/*.test.ts'],
    // Hidrata os bindings de `src/data/squads.ts` a partir do JSON em disco
    // (em runtime, o gate `<SquadsGate>` faz isso via fetch).
    setupFiles: ['src/lib/test-setup.ts'],
    // Smoke tests CLI antigos não entram (scripts/test-*.ts, sem .test.ts).
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts'],
    },
    // Tolera o tempo dos testes estatísticos (5000 sims/cenário).
    testTimeout: 30_000,
  },
})
