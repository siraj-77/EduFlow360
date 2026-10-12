/**
 * `check-templates` — the CI check `PLT-1003` T2 requires.
 *
 * > "Modifying a template file makes CI fail with an explicit message."
 * > — and the fail is waived only by an owner authorisation recorded in
 * > `WORKLOG.md`.
 *
 * ## What is being protected
 *
 * The HTML files under `docs/template/` are the owner-approved visual
 * source. `AGENTS.md` 2.8 names the donor; the 2026-10-11 template
 * comparison confirmed all three are approved and "reproduced as-is".
 * Until this script existed, nothing mechanically stopped an edit to
 * one of them: a changed token value or a retyped marketing line would
 * flow into the next port, and the gap between "the approved design"
 * and "the design on disk" would be a fact nobody could see.
 *
 * ## Why an authorisation escape hatch rather than a hard block
 *
 * A checksum list with no exit turns every legitimate change into a
 * broken build, and a gate that is routinely wrong teaches people to
 * bypass it. So the shape is the one `route-guards.allowlist.json`
 * already established in this repository: a baseline the tree must
 * match, plus a REVIEWABLE exemption. The exemption here is one line
 * in `docs/work/WORKLOG.md`:
 *
 *     template-authorised: <file> <sha256-of-approved-content>
 *
 * A human writes it, it sits in the project's log of record, and the
 * check accepts nothing less — not a rename, not a near-miss, not a
 * stale approval. The failure message PRINTS the line to add,
 * checksum included, so the honest path is the easiest one to find.
 *
 * ## Two-way reconciliation
 *
 * The baseline must also fail when it describes a tree that is not
 * there: a new template the baseline has never seen, and an entry whose
 * file is gone. A one-way check (files must match the list) would let
 * the baseline quietly rot, which is the "a check that silently
 * matches nothing" failure `route-guards.spec.ts` exists to rule out.
 *
 * Plain `.mjs`, like `check-route-guards.mjs`, so `node` runs it with
 * no build step; the types are JSDoc and `pnpm typecheck` does not
 * cover this file.
 *
 * JSDoc types:
 * @typedef {{ name: string, checksum: string }} TemplateFile
 * @typedef {{ file: string, message: string }} Finding
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from './paths.mjs';

/** The directory the approved templates live in, and the LOG the authorisation goes in. */
const TEMPLATE_DIRECTORY = join(REPO_ROOT, 'docs', 'template');
const WORKLOG = join(REPO_ROOT, 'docs', 'work', 'WORKLOG.md');
const BASELINE = join(REPO_ROOT, 'template-checksums.json');

/**
 * The machine-readable prefix an authorisation line must start with, after
 * trimming.
 *
 * A prefix and not a substring: prose that QUOTES the marker — this header
 * does — must not authorise anything, and the spec asserts that.
 */
export const AUTHORISATION_MARKER = 'template-authorised:';

/** A 64-character lowercase hex digest, the shape `sha256` actually produces. */
const CHECKSUM = /^[0-9a-f]{64}$/;

/**
 * Every authorisation the worklog carries: file name -> approved checksums.
 *
 * A `Map<string, Set<string>>` rather than a flat list, so a file's
 * authorisations are one lookup and a duplicate line is idempotent — the
 * worklog is append-only and an owner may well confirm the same change
 * twice.
 *
 * @param {string} worklog
 * @returns {Map<string, Set<string>>}
 */
export function parseAuthorisations(worklog) {
  /** @type {Map<string, Set<string>>} */
  const authorisations = new Map();

  for (const rawLine of worklog.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith(AUTHORISATION_MARKER)) continue;

    const rest = line.slice(AUTHORISATION_MARKER.length).trim();
    // The file name may contain spaces ("EduFlow — Frontend Template.html"),
    // and the checksum cannot, so the checksum is the LAST token and the file
    // name is everything before it.
    const separator = rest.lastIndexOf(' ');
    if (separator === -1) continue;

    const name = rest.slice(0, separator).trim();
    const checksum = rest.slice(separator + 1).trim();
    if (!CHECKSUM.test(checksum)) continue;

    const approved = authorisations.get(name) ?? new Set();
    approved.add(checksum);
    authorisations.set(name, approved);
  }

  return authorisations;
}

/**
 * The baseline's approvals: file name -> checksum.
 *
 * @param {string} baselineJson
 * @returns {Record<string, string>}
 */
function parseBaseline(baselineJson) {
  const parsed = JSON.parse(baselineJson);
  const files = parsed?.files;
  if (files === null || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error("template-checksums.json has no `files` object — see that file's header.");
  }
  return /** @type {Record<string, string>} */ (files);
}

/**
 * Compare the tree against the baseline.
 *
 * Deliberately pure over its arguments — the caller reads the files, so
 * the whole decision is testable without a filesystem, which is how
 * `route-guards.spec.ts` tests its script too.
 *
 * @param {{
 *   files: readonly TemplateFile[],
 *   baseline: Readonly<Record<string, string>>,
 *   authorisations: ReadonlyMap<string, ReadonlySet<string>>,
 * }} tree
 * @returns {Finding[]}
 */
export function verifyTemplates({ files, baseline, authorisations }) {
  /** @type {Finding[]} */
  const findings = [];

  const seen = new Set(files.map((file) => file.name));

  for (const file of files) {
    const approved = baseline[file.name];

    if (approved === undefined) {
      findings.push({
        file: file.name,
        message:
          `${file.name} is not in the baseline, so nothing about it is protected. Add it to ` +
          'template-checksums.json with its current checksum, in the same change that ' +
          'introduced it.',
      });
      continue;
    }

    if (approved === file.checksum) continue;

    const authorised = authorisations.get(file.name)?.has(file.checksum) === true;
    if (authorised) continue;

    findings.push({
      file: file.name,
      message:
        `${file.name} has been MODIFIED since it was approved (baseline ${approved}, ` +
        `on disk ${file.checksum}). The approved templates are the visual source ` +
        'the product is ported from, so an edit is a design change and needs the approval of ' +
        'the owner.\n' +
        '      Once approved, update template-checksums.json AND record the approval in ' +
        'docs/work/WORKLOG.md with a line exactly of this shape:\n' +
        `      ${AUTHORISATION_MARKER} ${file.name} ${file.checksum}`,
    });
  }

  for (const name of Object.keys(baseline)) {
    if (seen.has(name)) continue;

    findings.push({
      file: name,
      message:
        `${name} is in the baseline but no longer exists in docs/template/. Remove the entry ` +
        'in the same change that removed the file — an entry for a missing template claims an ' +
        'approval nothing backs.',
    });
  }

  return findings;
}

/**
 * `sha256(file)`, the only place the checksum is computed.
 *
 * @param {string} path
 * @returns {string}
 */
function checksumOf(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Entry point. */
function main() {
  /** @type {TemplateFile[]} */
  const files = readdirSync(TEMPLATE_DIRECTORY)
    .filter((name) => name.endsWith('.html'))
    .sort()
    .map((name) => ({ name, checksum: checksumOf(join(TEMPLATE_DIRECTORY, name)) }));

  const findings = verifyTemplates({
    files,
    baseline: parseBaseline(readFileSync(BASELINE, 'utf8')),
    authorisations: parseAuthorisations(readFileSync(WORKLOG, 'utf8')),
  });

  if (findings.length > 0) {
    console.error(`check-templates FAILED — ${findings.length} finding(s):\n`);
    for (const finding of findings) {
      console.error(`  - ${finding.message}\n`);
    }
    process.exit(1);
  }

  console.log(
    `check-templates OK — ${files.length} approved template(s) match the baseline; ` +
      'every deviation carries an owner authorisation in docs/work/WORKLOG.md',
  );
}

// Only when run directly, so the spec can import the pure functions
// without executing a filesystem check. The comparison is on
// `process.argv[1]`, which is the conventional Node answer and is what
// `check-route-guards.mjs` does.
if (process.argv[1] !== undefined && process.argv[1].endsWith('check-templates.mjs')) {
  main();
}
