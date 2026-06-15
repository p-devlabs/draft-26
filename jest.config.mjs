/** @type {import('jest').Config} */
export default {
  // Sem DOM por enquanto — o vitest.config.ts comentava: "se algum dia testes
  // de rotas entrarem, mudar pra jsdom + adicionar @testing-library/react".
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/lib/test-setup.ts'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  // Worktrees do Claude Code podem deixar package.jsons espelhados — ignora
  // pra não disparar haste collision warning.
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    // @swc/jest é o transformer mais rápido pra TS+ESM em Jest. Equivalente
    // ao que next/jest usa, sem precisar do Next.
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          target: 'es2022',
          transform: { react: { runtime: 'automatic' } },
        },
        module: { type: 'es6' },
      },
    ],
  },
  // Tolera o tempo dos testes estatísticos (5000 sims/cenário).
  testTimeout: 30_000,
  collectCoverageFrom: ['src/lib/**/*.ts', '!src/lib/**/*.test.ts', '!src/lib/test-setup.ts'],
  coverageReporters: ['text', 'html'],
}
