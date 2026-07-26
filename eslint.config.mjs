import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * Bug-focused lint config. We already have strict `tsc` typechecking, so ESLint
 * here is only for what the compiler doesn't catch — floating/misused promises,
 * unused code — not style. The type-unsafe `any`-boundary rules are muted
 * because the DOM/xmldom/pdfjs adapters use `any` deliberately.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'launcher/**',
      'packages/web/public/**',
      '**/test/**', // exercised by `npm test`, not part of the tsc build projects
      '**/*.config.{ts,js}',
      'eslint.config.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['packages/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // deliberate `any` at DOM / vendor-library boundaries — don't fight it
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off', // `El = any` in xmldom helpers
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      // intentional: interface/class merging is how we type EventEmitter's
      // strongly-typed .on() overloads (MonitorService, SapListener).
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      // async event handlers on JSX attributes are the standard React pattern
      // (React ignores the returned promise); keep the rule for the dangerous
      // cases (async passed where a sync void callback is required).
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      // an async fn with no await is a valid promise-returning API surface here
      '@typescript-eslint/require-await': 'off',
      // the ones worth keeping
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
    },
  }
);
