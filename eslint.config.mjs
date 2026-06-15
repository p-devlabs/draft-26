import prettier from 'eslint-config-prettier'
import importX from 'eslint-plugin-import-x'
import jest from 'eslint-plugin-jest'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import playwright from 'eslint-plugin-playwright'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import testingLibrary from 'eslint-plugin-testing-library'
import tseslint from 'typescript-eslint'

// Config inicial: passa no codebase atual sem retrofit massivo. Roadmap pra
// apertar — bump pra type-aware (`recommendedTypeChecked`) + jsx-a11y `strict`
// + react-hooks/exhaustive-deps `error` à medida que a dívida for sendo
// limpada em PRs dedicados.

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'node_modules/**',
      'public/data/**',
      'data/**',
      'reports/**',
      // Worktrees do Claude Code carregam package.jsons espelhados —
      // não-código nosso, fora do escopo do lint.
      '.claude/**',
      'scratch/**',
      'tmp/**',
      // Handoff de design — fonte read-only do Claude Design, fora do escopo.
      'handoff-claude-design/**',
    ],
  },

  // typescript-eslint (sem type-aware por enquanto — recommendedTypeChecked
  // dispara ~800 erros em código com tipos fracos. Subir num PR dedicado.)
  ...tseslint.configs.recommended,

  // Plain JS — disable type-aware rules (no-op aqui já que não usamos type-aware)
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // React + hooks (sem Next — Vite owna o build, React Router owna routing)
  {
    files: ['src/**/*.{ts,tsx}'],
    ...react.configs.flat.recommended,
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Novo JSX transform — `import React` não obrigatório.
      'react/react-in-jsx-scope': 'off',
      // Copy pt-BR em JSX é comum; não flaga aspas/acentos.
      'react/no-unescaped-entities': 'off',
      // exhaustive-deps gera vários warnings em padrões intencionais
      // (ver Match.tsx). Sobe pra error num PR dedicado depois de auditar
      // os falsos positivos.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // jsx-a11y recommended (não `strict`) — ainda forte, mas o strict pega
  // backdrops de drawer que são intencionalmente click-only com fallback ESC.
  jsxA11y.flatConfigs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Backdrops de drawer (OutcomeDrawer, PickDrawer, SetupDrawer) usam
      // padrão `<div onClick={onClose} aria-hidden="true" />` com ESC handler
      // como alternativa de teclado. As duas regras abaixo flagam o padrão
      // como inacessível mas funcionalmente ele tem alternativa keyboard.
      // Revisitar quando migrar drawers pro <dialog> nativo do HTML.
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
    },
  },

  // import-x: ordering + no-cycle + no-duplicates
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    settings: {
      'import-x/resolver': {
        typescript: { project: './tsconfig.json' },
        node: true,
      },
    },
    rules: {
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-default-export': 'off',
      'import-x/no-unassigned-import': 'off',
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-unresolved': 'off',
      // Esm interop pra papaparse e outros pkgs CJS/dual — false positives.
      'import-x/default': 'off',
    },
  },

  // Jest pra unit / integration tests
  {
    files: ['src/**/*.test.{ts,tsx,js,jsx}', 'test/**/*.{ts,tsx,js,jsx}'],
    ...jest.configs['flat/recommended'],
    rules: {
      ...jest.configs['flat/recommended'].rules,
      'jest/no-conditional-expect': 'off',
    },
  },

  // Testing Library pra component tests (quando entrarem)
  {
    files: ['src/**/*.test.tsx', 'test/**/*.test.tsx'],
    ...testingLibrary.configs['flat/react'],
  },

  // Playwright pra E2E specs
  {
    files: ['e2e/**/*.{ts,tsx}'],
    ...playwright.configs['flat/recommended'],
  },

  // Vite/Tailwind config files e scripts são node CJS-ish — relaxa rules
  // que disparam em padrões de script CLI (unused-vars de debug, etc).
  {
    files: ['*.{js,mjs,cjs,ts}', 'scripts/**/*.ts', 'vite.config.ts'],
    rules: {
      'import-x/no-named-as-default': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'prefer-const': 'off',
    },
  },

  // Rota dev-only — padrão atual usa hooks condicionais (ramo early-return
  // com hooks abaixo). Marcar pra revisão num PR dedicado.
  {
    files: ['src/routes/PenaltiesDev.tsx'],
    rules: {
      'react-hooks/rules-of-hooks': 'warn',
    },
  },

  // Prettier MUST come last
  prettier,
)
