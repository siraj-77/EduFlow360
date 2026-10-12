import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * EduFlow — base ESLint configuration.
 *
 * Every rule here maps to a clause in AGENTS.md. A rule that is not
 * mechanically enforced is a suggestion (ARCHITECTURE.md section 17),
 * so each one carries its justification inline.
 */

/**
 * `PLT-1001` AC-4 — no hard-coded `localhost` URL in application source.
 *
 * Shared by the node and next configs, because the violation class is
 * identical on both sides: the API reads `WEB_ORIGIN`, the web app reads
 * `NEXT_PUBLIC_API_BASE_URL`, and a literal origin anywhere in between
 * is a port that cannot be moved by configuration. It is also how the
 * sign-out defect's cousin arrives — a URL that points at the developer's
 * machine and nobody notices until the deployment.
 *
 * The pattern is anchored at the START of the value on purpose. A URL
 * that merely CONTAINS `localhost` mid-string is a log line or a comment
 * about one; a value that BEGINS with it is the origin itself.
 *
 * Template literals are matched through their first quasi, so
 * `` `http://localhost:${port}/x` `` — a hard-coded origin with a
 * dynamic port — is caught too.
 *
 * Exemptions live in the consuming configs, not here: spec files must
 * name their fixture origin, and the test harnesses bind loopback by
 * design.
 */
export const LOCALHOST_URL_PATTERN = [
  {
    selector: 'Literal[value=/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?/]',
    message:
      'PLT-1001 / AGENTS.md 2.14: never hard-code a localhost URL in application source. ' +
      'Ports and origins are configuration — read WEB_ORIGIN / NEXT_PUBLIC_API_BASE_URL ' +
      '(or WEB_PORT / API_PORT) so the value moves with the deployment.',
  },
  {
    selector: 'TemplateElement[value.raw=/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?/]',
    message:
      'PLT-1001 / AGENTS.md 2.14: never hard-code a localhost URL in application source, ' +
      'not even as the fixed prefix of a template literal. Read the origin from ' +
      'configuration and interpolate the whole value.',
  },
];

/** @type {import('eslint').Linter.Config[]} */
export const base = tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**', '**/*.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // Setting `parserOptions` here REPLACES whatever
      // `tseslint.configs.recommended` set, rather than merging into it. With
      // the object empty, no JSX is produced, so every
      // `JSXElement[...]` selector in AGENTS.md 3.2.1's raw-element ban
      // matched nothing and the rule had never fired. Found 2026-09-30 by
      // `apps/web/src/config/ui-primitive-rules.spec.ts`; see `next.js` for
      // the matching overwrite bug in the rule blocks themselves.
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // AGENTS.md section 8: TypeScript strict everywhere, and an
      // unenforced convention is a suggestion.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // AGENTS.md section 8: no @ts-ignore / @ts-expect-error at all.
      // Fix the type. There is no exception and no escape comment.
      //
      // In typescript-eslint v8 these are booleans: `true` bans the form.
      // `ts-allow-without-description` and `ts-allow` were removed in v8,
      // so a plain ban is the whole policy.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': true,
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',

      // AGENTS.md section 8: "No bare catch {}" and never swallow errors.
      'no-empty': ['error', { allowEmptyCatch: false }],

      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
);
