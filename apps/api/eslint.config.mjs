import { node } from '@eduflow/config/eslint/node';

/**
 * EduFlow API lint configuration.
 *
 * The load-bearing rules are inherited from @eduflow/config/eslint/node:
 *
 *   domain/ and use-cases/ may not import @nestjs/*, @prisma/client,
 *   bullmq, ioredis, or any vendor SDK           (AGENTS.md 2.2)
 *   domain/ and use-cases/ may not call Date.now(),
 *   new Date() or Math.random()                  (AGENTS.md 2.4)
 *
 * Both are scoped by path so they cannot be bypassed by editing a file
 * outside those two layers.
 */
export default [
  ...node,
  { rules: {} },

  /**
   * `prisma/*.mjs` and `erd/*.mjs` are Node build scripts — the ARC-01
   * schema/ERD generator, the ARC-08 diagram generator and its geometry
   * checker. They run under `node`, not under NestJS, so they legitimately use
   * `process`, `console` and `Buffer`.
   *
   * Scoped to these two directories on purpose. Declaring Node globals for the
   * whole package would stop `no-undef` catching a stray `process` in
   * application code, which is the case the rule exists for.
   */
  {
    files: ['prisma/**/*.mjs', 'erd/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      // A generator reports what it wrote. `console.log` is the output.
      'no-console': 'off',
    },
  },
];
