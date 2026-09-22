import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'server/src/generated/**',
      'server/prisma/migrations/**',
    ],
  },
  js.configs.recommended,

  // Backend: Node ESM
  {
    files: ['server/**/*.js', 'server/**/*.mjs', '*.js', '*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },

  // Scripts de Prisma (seed) usan console para informar progreso
  {
    files: ['server/prisma/**/*.js', 'server/scripts/**/*.js'],
    rules: { 'no-console': 'off' },
  },

  // Tests backend
  {
    files: ['server/tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
    rules: { 'no-console': 'off' },
  },

  // Frontend: React
  {
    files: ['client/**/*.{js,jsx}'],
    ...react.configs.flat.recommended,
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.vitest },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs['recommended-latest'].rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
    },
  },

  prettier,
];
