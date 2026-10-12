import { describe, expect, it } from 'vitest';

import {
  AUTHORISATION_MARKER,
  parseAuthorisations,
  verifyTemplates,
} from '../../../../scripts/check-templates.mjs';

/**
 * `PLT-1003` T2 — the template integrity gate.
 *
 * ## The rule, and why it is a gate
 *
 * The three files under `docs/template/` are the owner-approved visual
 * source ("reproduce as-is", `AGENTS.md` 2.8, confirmed by the
 * 2026-10-11 template comparison). Until this check existed, nothing
 * stopped an edit to one of them: a well-meaning change to a token
 * value or a marketing line would flow straight into the next port,
 * and the difference between "the approved design" and "the design as
 * currently on disk" would be invisible.
 *
 * A checksum list alone is not enough — it turns every legitimate
 * change into a broken build, and a gate that is routinely wrong is a
 * gate people learn to bypass. So the shape is the one
 * `route-guards.allowlist.json` already established: a baseline the
 * tree must match, and a REVIEWABLE escape hatch. The hatch here is an
 * `OWNER-AUTHORISED` note in `WORKLOG.md` naming the file and the
 * checksum that was approved — a human wrote it, it sits in the
 * project's log of record, and the check refuses anything less.
 *
 * The failure message is deliberately self-bootstrapping: it prints
 * the exact WORKLOG line to add, including the new checksum, so the
 * honest path is easier than the bypass.
 */

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

/** A template tree: the file's real name and its checksum. */
const file = (name: string, checksum: string) => ({ name, checksum });

/** A baseline: what the repository approved. */
const baseline = (...files: { name: string; checksum: string }[]) =>
  Object.fromEntries(files.map((f) => [f.name, f.checksum]));

/** The findings that name `name`, for an assertion about one file. */
const findingsFor = (findings: readonly { file: string }[], name: string) =>
  findings.filter((finding) => finding.file === name);

describe('verifyTemplates', () => {
  const LANDING = 'EduFlow360_Template_Landing_Auth.html';

  it('passes when every template matches its baseline', () => {
    const findings = verifyTemplates({
      files: [file(LANDING, SHA_A)],
      baseline: baseline({ name: LANDING, checksum: SHA_A }),
      authorisations: new Map(),
    });

    expect(findings).toEqual([]);
  });

  it('fails when a template has been edited, and names both checksums', () => {
    // The central claim. An edited template is a changed design, and the
    // failure has to say so plainly — a diff the reviewer can take to
    // the owner.
    const findings = verifyTemplates({
      files: [file(LANDING, SHA_B)],
      baseline: baseline({ name: LANDING, checksum: SHA_A }),
      authorisations: new Map(),
    });

    expect(findingsFor(findings, LANDING)).toHaveLength(1);
    expect(findings[0]?.message).toContain(LANDING);
    expect(findings[0]?.message).toContain(SHA_A);
    expect(findings[0]?.message).toContain(SHA_B);
  });

  it('fails with the exact WORKLOG line that repairs it', () => {
    // Self-bootstrapping on purpose. The honest path — record the
    // owner's approval — must be the easiest one to find, or the gate
    // teaches people to delete the baseline instead.
    const findings = verifyTemplates({
      files: [file(LANDING, SHA_B)],
      baseline: baseline({ name: LANDING, checksum: SHA_A }),
      authorisations: new Map(),
    });

    expect(findings[0]?.message).toContain(AUTHORISATION_MARKER);
    expect(findings[0]?.message).toContain(`${LANDING} ${SHA_B}`);
  });

  it('passes when WORKLOG carries an owner authorisation for the NEW checksum', () => {
    // The escape hatch, used correctly: the owner approved a change, the
    // authorisation names the file and the checksum that was approved,
    // and the tree proceeds. The baseline is then updated in the same
    // change — which is why the authorisation has to name the NEW one.
    const authorisations = parseAuthorisations(
      `Some prose about a decided thing.\n\n` +
        `## 2026-10-14 — the topnav changed\n\n` +
        `The owner approved the new button arrangement on 2026-10-13.\n` +
        `${AUTHORISATION_MARKER} ${LANDING} ${SHA_B}\n`,
    );

    const findings = verifyTemplates({
      files: [file(LANDING, SHA_B)],
      baseline: baseline({ name: LANDING, checksum: SHA_A }),
      authorisations,
    });

    expect(findings).toEqual([]);
  });

  it('refuses an authorisation naming the OLD checksum', () => {
    // A stale or copy-pasted entry must not authorise the current tree.
    // "Owner approved SHA_A" is not approval of SHA_B, and treating it
    // as such would make every future edit inherit the first approval.
    const authorisations = parseAuthorisations(`${AUTHORISATION_MARKER} ${LANDING} ${SHA_A}\n`);

    const findings = verifyTemplates({
      files: [file(LANDING, SHA_B)],
      baseline: baseline({ name: LANDING, checksum: SHA_A }),
      authorisations,
    });

    expect(findingsFor(findings, LANDING)).toHaveLength(1);
  });

  it('refuses an authorisation naming a DIFFERENT file', () => {
    // One approval is one file. A line about the admin dashboard does
    // not clear the landing page.
    const authorisations = parseAuthorisations(
      `${AUTHORISATION_MARKER} EduFlow360_Template_Admin_Dashboard.html ${SHA_B}\n`,
    );

    const findings = verifyTemplates({
      files: [file(LANDING, SHA_B)],
      baseline: baseline({ name: LANDING, checksum: SHA_A }),
      authorisations,
    });

    expect(findingsFor(findings, LANDING)).toHaveLength(1);
  });

  it('fails on a template the baseline has never seen', () => {
    // Two-way reconciliation, the rule `route-guards` established: a new
    // file is a new design decision, and silently omitting it would make
    // the baseline quietly incomplete.
    const findings = verifyTemplates({
      files: [{ name: 'EduFlow360_Template_SomeNewThing.html', checksum: SHA_A }],
      baseline,
      authorisations: new Map(),
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('not in the baseline');
  });

  it('fails on a baseline entry whose template is gone', () => {
    // The other direction: a deleted file leaves an entry that claims a
    // template is approved when nothing is there to approve.
    const findings = verifyTemplates({
      files: [],
      baseline: baseline({ name: LANDING, checksum: SHA_A }),
      authorisations: new Map(),
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain('no longer exists');
  });

  it('ignores an authorisation-free prose mention of the marker', () => {
    // The marker is a machine-readable prefix, and prose that merely
    // quotes it must not authorise anything.
    const authorisations = parseAuthorisations(
      `The check looks for a line beginning with "${AUTHORISATION_MARKER}".\n`,
    );

    expect(authorisations.size).toBe(0);
  });
});
