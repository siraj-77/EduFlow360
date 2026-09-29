import { base } from './base.js';

/**
 * EduFlow — API (Node / NestJS) ESLint configuration.
 *
 * The two rules that matter most here are the LAYERING rule and the
 * DETERMINISM rule. Together they make AGENTS.md sections 2.2 and 2.4
 * impossible to violate by accident:
 *
 *   - domain/ and use-cases/ may not import a framework, an ORM client,
 *     a queue, or a vendor SDK. Dependencies flow inward only.
 *   - domain/ and use-cases/ may not read the ambient clock or ambient
 *     randomness. They take IClock and an injected id generator.
 *
 * AGENTS.md section 2.2: "Never call a vendor SDK from a use-case or
 * domain file." That sentence is only enforceable if something checks it.
 */

const FRAMEWORK_IMPORTS = [
  // NestJS — domain and use-cases must be framework-free
  '@nestjs/common',
  '@nestjs/core',
  '@nestjs/platform-express',
  '@nestjs/config',
  '@nestjs/jwt',
  '@nestjs/swagger',
  '@nestjs/terminus',
  '@nestjs/testing',
  '@nestjs/bullmq',
  // Persistence — belongs in infrastructure/postgres
  '@prisma/client',
  'prisma',
  // Queue / cache
  'bullmq',
  'ioredis',
  'redis',
  // HTTP / vendor SDKs
  'axios',
  'node-fetch',
  '@aws-sdk/client-s3',
  '@aws-sdk/lib-storage',
  '@aws-sdk/s3-request-presigner',
  'nodemailer',
  '@google-cloud/storage',
  'stripe',
  'twilio',
  // UI must never leak into the API
  'react',
  'react-dom',
  'next',
];

const FRAMEWORK_PATTERN = FRAMEWORK_IMPORTS.map((name) => ({
  group: [`${name}`, `${name}/*`],
  message:
    `AGENTS.md 2.2: \`${name}\` must not be imported from domain/ or use-cases/. ` +
    `Dependencies flow inward only. Put the implementation in infrastructure/ and ` +
    `depend on the port in domain/ports/ instead.`,
}));

const AMBIENT_TIME_PATTERN = [
  {
    // no-restricted-syntax uses `selector`; `group` is no-restricted-imports.
    // `Date.now` is a MemberExpression, so the identifier lives on
    // `callee.object`, not `callee`.
    selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
    message:
      'AGENTS.md 2.4: domain/ and use-cases/ must never read the ambient clock. ' +
      'Inject IClock so accrual, licence expiry, deadlines and hold expiry are ' +
      'deterministic and testable at their boundaries.',
  },
  {
    selector: 'NewExpression[callee.name="Date"]',
    message:
      'AGENTS.md 2.4: `new Date()` in domain/ and use-cases/ bypasses IClock. ' +
      'Inject IClock instead so tests are deterministic at their boundaries.',
  },
  {
    selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
    message:
      'AGENTS.md 2.4: Math.random() is not injectable and cannot be seeded. ' +
      'Use an injected id generator so ids are reproducible in tests.',
  },
];

// Globs are deliberately NOT root-anchored. ESLint runs from each
// package's own directory (apps/api, packages/*), so a root-anchored
// `apps/api/src/...` glob would match nothing there. A bare
// `**/domain/**`-style glob matches from any cwd, and the folder names
// are distinctive enough that over-matching is not a risk -- node_modules
// is ignored upstream.
//
// NOTE: a glob like this cannot be written inside a /* *\/ *\/ block
// comment, because the `*` + `/` sequence closes the comment early and
// the remainder is evaluated as code. Hence the line comments.
const DOMAIN_LAYER = '**/domain/**/*.ts';
const USE_CASES_LAYER = '**/use-cases/**/*.ts';

/** @type {import('eslint').Linter.Config[]} */
export const node = [
  ...base,
  {
    files: [DOMAIN_LAYER, USE_CASES_LAYER],
    rules: {
      'no-restricted-imports': ['error', { patterns: FRAMEWORK_PATTERN }],
    },
  },
  {
    files: [DOMAIN_LAYER, USE_CASES_LAYER],
    rules: {
      'no-restricted-syntax': ['error', ...AMBIENT_TIME_PATTERN],
    },
  },
];
