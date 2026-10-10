/**
 * Conventional Commits, plus the requirement ID `AGENTS.md` section 9 requires.
 *
 * Type is checked against the eleven allowed types. Scope is not checked, because
 * the existing history uses scopes this file cannot enumerate honestly. The
 * requirement ID is checked because a commit with no traceable requirement is
 * how the plan's traceability backbone (PLT-*, REQ-*, OPS-*, SEC-*) decays.
 *
 * Bypass for the rare genuinely-untraceable commit: `--no-verify`, and say so in
 * the body.
 */
import { readFileSync } from 'node:fs';

const TYPES = new Set([
  'feat',
  'fix',
  'test',
  'refactor',
  'docs',
  'chore',
  'perf',
  'build',
  'ci',
  'style',
  'revert',
]);

const SUBJECT_MAX = 72;

// Requirement-ID shapes used in this repository's history.
const ID = /(?:\b(PLT|REQ|OPS|SEC|DSN|WEB|ARC|DOC|ADR|FIX|ENV)-\d+[a-z]?\b)/;

const message = readFileSync(process.argv[2], 'utf8').split('\n')[0] ?? '';

const match = /^(\w+)(\([^)]*\))?(!)?:\s+(.+)$/.exec(message);

if (!match) {
  console.error(`commit-msg: not a Conventional Commit.\n  got: ${message}`);
  process.exit(1);
}

const [, type, , , subject] = match;

if (!TYPES.has(type)) {
  console.error(`commit-msg: type "${type}" is not one of: ${[...TYPES].join(', ')}`);
  process.exit(1);
}

if (subject.length > SUBJECT_MAX) {
  console.error(`commit-msg: subject is ${subject.length} chars; keep it under ${SUBJECT_MAX}.`);
  process.exit(1);
}

if (!ID.test(message)) {
  console.error(
    'commit-msg: no requirement ID. AGENTS.md section 9 requires the commit to\n' +
      '  reference the requirement it implements (PLT-205, SEC-101, REQ-03, ...).\n' +
      '  Use --no-verify only for a commit with genuinely no requirement, and say why.',
  );
  process.exit(1);
}
