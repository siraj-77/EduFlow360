import { describe, expect, it } from 'vitest';
import { decideEmailDomain, normalizeDomain } from './allowed-email-domain.js';

/**
 * The allowed-email-domain rule, as tables.
 *
 * `AGENTS.md` §4.1 asks for table-driven tests on rule engines, and this is one:
 * it is the rule that decides who may sign in to a school, and its interesting
 * behaviour is entirely in its boundaries — what normalises, what is refused,
 * and which of three different refusals is reported.
 *
 * The rows below are adversarial on purpose. `'evilmicrosoft.com'.endsWith(
 * 'microsoft.com')` is `true`, so a suffix comparison written once, casually,
 * to "help" a school that lists a parent-facing domain is an account-takeover
 * path with no other failure mode. If a future edit brings `endsWith`, `includes`
 * on a substring, or `startsWith` back into the match, the rows in "a domain is
 * matched, never a suffix of one" fail.
 */

/** Configured entries that must normalise, and the exact canonical form. */
const ACCEPTS: ReadonlyArray<readonly [string, string]> = [
  ['school.lk', 'school.lk'],
  ['SCHOOL.LK', 'school.lk'],
  ['School.Lk', 'school.lk'],
  ['  school.lk  ', 'school.lk'],
  ['\tschool.lk\n', 'school.lk'],
  // Operators paste the address form, so the leading at sign is forgiven.
  ['@school.lk', 'school.lk'],
  // A trailing dot is the DNS root, not part of the name.
  ['school.lk.', 'school.lk'],
  ['.school.lk', 'school.lk'],
  ['..school.lk..', 'school.lk'],
  // All three at once, which is what a hurried paste actually looks like.
  ['@SCHOOL.LK.', 'school.lk'],
  // Punycode is the canonical form of an internationalised name and is ASCII.
  ['xn--80ak6aa92e.com', 'xn--80ak6aa92e.com'],
  ['a.b.c.school.lk', 'a.b.c.school.lk'],
  ['school-lk.ac.lk', 'school-lk.ac.lk'],
  ['1school.lk', '1school.lk'],
  // A single label is a SHAPE question, not a policy one: rejecting it here
  // would be inventing a rule the corpus does not state.
  ['localhost', 'localhost'],
];

/** Entries that must be refused, and the typed reason for each refusal. */
const REFUSES: ReadonlyArray<readonly [string, string]> = [
  ['', 'empty'],
  ['   ', 'empty'],
  ['\t\n', 'empty'],
  // Dots and at signs only: normalisation empties them, which is still empty.
  ['.', 'empty'],
  ['...', 'empty'],
  ['@', 'empty'],
  ['@.', 'empty'],
  // A domain is not an address. This is the single most likely bad entry: an
  // administrator pasting a colleague's address instead of a domain.
  ['teacher@school.lk', 'contains-at-sign'],
  ['teacher@school.lk@extra.lk', 'contains-at-sign'],
  // Exactly ONE leading at sign is forgiven, so a second one still fails.
  ['@teacher@school.lk', 'contains-at-sign'],
  ['school lk', 'invalid-character'],
  ['school_lk', 'invalid-character'],
  ['school/lk', 'invalid-character'],
  ['school lk.com', 'invalid-character'],
  // An empty label is a typo, not a name, and normalising it away would make
  // 'school..lk' match 'school.lk'.
  ['school..lk', 'empty-label'],
  ['school..lk', 'empty-label'],
  // Internationalised names must arrive as punycode; a raw non-ASCII label is
  // not silently transformed, because two normalisations of one name is the
  // problem this rule exists to prevent.
  ['üñí.lk', 'invalid-character'],
  // A label may not begin or end with a hyphen.
  ['-school.lk', 'invalid-label'],
  ['school-.lk', 'invalid-label'],
  ['school.-lk', 'invalid-label'],
];

describe('normalising a configured domain', () => {
  it.each(ACCEPTS)('normalises %j to %j', (raw, expected) => {
    expect(normalizeDomain(raw)).toEqual({ ok: true, domain: expected });
  });

  it.each(REFUSES)('refuses %j as %j', (raw, reason) => {
    expect(normalizeDomain(raw)).toEqual({ ok: false, reason });
  });

  it('is idempotent, so normalising a configured domain cannot change it later', () => {
    for (const [raw, canonical] of ACCEPTS) {
      const once = normalizeDomain(raw);
      if (!once.ok) throw new Error(`${raw} was expected to normalise`);
      expect(normalizeDomain(once.domain), `${raw} is not stable`).toEqual(once);
      expect(once.domain).toBe(canonical);
    }
  });

  it('never returns a domain with a leading at sign, a trailing dot or upper case', () => {
    // The three shapes normalisation exists to remove, asserted as a property
    // rather than as three more rows, so a later edit that reintroduces one of
    // them is caught even if it also breaks a row above.
    for (const raw of ['@SCHOOL.LK.', '  School.Lk..  ', '@.school.lk.']) {
      const result = normalizeDomain(raw);
      if (!result.ok) throw new Error(`${raw} was expected to normalise`);
      expect(result.domain).not.toMatch(/@/);
      expect(result.domain).not.toMatch(/^\./);
      expect(result.domain).not.toMatch(/\.$/);
      expect(result.domain).toBe(result.domain.toLowerCase());
    }
  });
});

describe('an address inside a configured domain may sign in', () => {
  // The permitted domain is a column of its own rather than a constant, because
  // three of these rows match something other than school.lk and an assertion
  // that hardcoded one expected domain would pass them for the wrong reason.
  const ALLOWS: ReadonlyArray<readonly [unknown, string, string]> = [
    [['school.lk'], 'teacher@school.lk', 'school.lk'],
    // The provider's casing is not the school's, and neither is a trailing dot.
    [['school.lk'], 'Teacher@School.LK', 'school.lk'],
    [['school.lk'], 'teacher@SCHOOL.LK.', 'school.lk'],
    // The configured entry itself is normalised before comparison.
    [[' SCHOOL.LK ', '@school.lk'], 'teacher@school.lk', 'school.lk'],
    [['@School.Lk.'], 'teacher@school.lk', 'school.lk'],
    // More than one domain, and the match may be any of them.
    [['school.lk', 'academy.ac.lk'], 'staff@academy.ac.lk', 'academy.ac.lk'],
    [['academy.ac.lk', 'school.lk'], 'staff@academy.ac.lk', 'academy.ac.lk'],
    [['academy.ac.lk', 'school.lk'], 'staff@school.lk', 'school.lk'],
    [['school.lk'], 'a.b.c@school.lk', 'school.lk'],
    [['xn--80ak6aa92e.com'], 'user@xn--80ak6aa92e.com', 'xn--80ak6aa92e.com'],
    // One unusable entry must not cost the school the domains that are fine.
    [['school.lk', 'not a domain', '@'], 'teacher@school.lk', 'school.lk'],
    [['school.lk', ''], 'teacher@school.lk', 'school.lk'],
  ];

  it.each(ALLOWS)('permits %j to sign in as %j', (allowlist, email, domain) => {
    expect(decideEmailDomain({ allowlist, email })).toEqual({ allowed: true, domain });
  });

  it('reports the normalised domain on a permit, so a caller can log what matched', () => {
    // Not the raw address and not the raw configured entry: a log line has to
    // be comparable across the two spellings the same domain arrives in.
    expect(decideEmailDomain({ allowlist: ['@SCHOOL.LK.'], email: 'T@School.LK' })).toEqual({
      allowed: true,
      domain: 'school.lk',
    });
  });
});

describe('a domain is matched, never a suffix of one', () => {
  // Each row is a way a suffix comparison says yes when it must say no.
  // 'evilmicrosoft.com' is the canonical one and the reason this file exists.
  const IMPERSONATIONS: ReadonlyArray<readonly [string, string]> = [
    ['evilmicrosoft.com', 'microsoft.com'],
    ['notmicrosoft.com', 'microsoft.com'],
    ['xmicrosoft.com', 'microsoft.com'],
    ['microsoft.com.attacker.lk', 'microsoft.com'],
    ['microsoft.co', 'microsoft.com'],
    ['microsoft.como', 'microsoft.com'],
    ['school.lk.evil.example', 'school.lk'],
    ['evilschool.lk', 'school.lk'],
    ['school.lk2', 'school.lk'],
    ['school.l', 'school.lk'],
  ];

  it.each(IMPERSONATIONS)('refuses %j under a configured %j', (attacker, configured) => {
    expect(
      decideEmailDomain({ allowlist: [configured], email: `attacker@${attacker}` }),
      `${attacker} must not match a configured ${configured}`,
    ).toEqual({ allowed: false, reason: 'domain-not-permitted' });
  });
});

describe('a subdomain is permitted only when it is configured', () => {
  // THE DECISION, asserted in both directions so it cannot be changed silently.
  //
  // Exact equality, not "equality with a dot-prefixed suffix". The dot-prefixed
  // variant is safe against 'evilmicrosoft.com' and is still wrong here: an
  // administrator cannot enumerate their own subdomains, so honouring all of
  // them grants access to names nobody in the school chose — and the subdomain
  // a school hands to a third party is exactly the one an attacker wants.
  // A school that wants staff.school.lk lists staff.school.lk.
  it('refuses a subdomain of a configured domain', () => {
    expect(decideEmailDomain({ allowlist: ['school.lk'], email: 'student@sub.school.lk' })).toEqual(
      {
        allowed: false,
        reason: 'domain-not-permitted',
      },
    );
    expect(
      decideEmailDomain({ allowlist: ['school.lk'], email: 'student@deep.sub.school.lk' }),
    ).toEqual({ allowed: false, reason: 'domain-not-permitted' });
  });

  it('permits that same subdomain once it is configured in its own right', () => {
    expect(
      decideEmailDomain({
        allowlist: ['school.lk', 'sub.school.lk'],
        email: 'student@sub.school.lk',
      }),
    ).toEqual({ allowed: true, domain: 'sub.school.lk' });
  });

  it('still refuses the parent when only the subdomain is configured', () => {
    // The inverse of the decision above. A rule that honoured "equal or a
    // subdomain of" in one direction only would pass both of the tests above
    // and still be wrong.
    expect(decideEmailDomain({ allowlist: ['sub.school.lk'], email: 'teacher@school.lk' })).toEqual(
      { allowed: false, reason: 'domain-not-permitted' },
    );
  });
});

describe('nothing configured permits nothing', () => {
  // `D49`: fail-closed when empty, and the refusal must be its OWN reason so an
  // operator who has never configured a list is told that, rather than being
  // told they typed the wrong domain and left to guess.
  const UNCONFIGURED: ReadonlyArray<readonly [unknown]> = [
    [null],
    [undefined],
    [[]],
    // Entries that normalise to nothing leave the school with zero domains,
    // which is the same administrative state and the same remedy.
    [['   ']],
    [['']],
    [['@']],
    [['.', '..']],
    // An address was pasted where a domain belongs, and it is the only entry.
    [['teacher@school.lk']],
    // An array whose every entry is the wrong TYPE is the same state as an
    // empty one, not a malformed one: entries that cannot be used are dropped
    // rather than treated as fatal, so a stray value cannot lock out the domains
    // beside it. These rows live here rather than in MALFORMED because
    // "malformed" is reserved for a value that is not a list at all.
    [[42, 43]],
    [[null, undefined]],
  ];

  // Present but of the wrong SHAPE entirely — not a list at all. Kept in a
  // separate table because it is a different refusal with a different remedy,
  // and putting it in the table above would have quietly collapsed the two.
  const MALFORMED: ReadonlyArray<readonly [unknown]> = [
    ['school.lk'],
    [{ domains: ['school.lk'] }],
    [42],
    [true],
    [{ school: 'school.lk' }],
  ];

  it.each(UNCONFIGURED)('refuses every address when the allowlist is %j', (allowlist) => {
    // Several addresses, because "permits nothing" has to mean nothing rather
    // than "refuses the one address in the example".
    for (const email of [
      'teacher@school.lk',
      'parent@gmail.com',
      'anyone@anywhere.example',
      'not-an-address',
    ]) {
      expect(
        decideEmailDomain({ allowlist, email }),
        `${email} under ${String(allowlist)}`,
      ).toEqual({
        allowed: false,
        reason: 'allowlist-not-configured',
      });
    }
  });

  it.each(MALFORMED)('refuses every address when the allowlist is %j', (allowlist) => {
    // A wrong shape permits nothing either. It is only the REASON that differs,
    // so the reason is asserted here too rather than left to the test below.
    for (const email of ['teacher@school.lk', 'parent@gmail.com', 'not-an-address']) {
      expect(decideEmailDomain({ allowlist, email })).toEqual({
        allowed: false,
        reason: 'allowlist-malformed',
      });
    }
  });

  it('tells an unconfigured school apart from a mistyped domain', () => {
    // The distinction the whole reason for a typed reason exists to carry. Both
    // are refusals; collapsing them would leave an administrator with no idea
    // that they have a list at all.
    expect(decideEmailDomain({ allowlist: [], email: 'teacher@school.lk' })).not.toEqual(
      decideEmailDomain({ allowlist: ['school.lk'], email: 'teacher@school.lk' }),
    );
  });

  it('names a stored value of the wrong shape as malformed rather than merely empty', () => {
    // Distinct from `allowlist-not-configured` because the remedy differs: a
    // school with a good list that reads as empty cannot configure its way out
    // of a data fault it cannot see, and "malformed" is what tells a developer
    // to go and look at the row.
    expect(
      decideEmailDomain({ allowlist: { domains: ['school.lk'] }, email: 'teacher@school.lk' }),
    ).toEqual({ allowed: false, reason: 'allowlist-malformed' });
  });
});

describe('the refusal is reported, never thrown', () => {
  it('checks the allowlist before it looks at the address, so a locked school leaks nothing', () => {
    // Ordering is the security content. With an empty list there is nothing to
    // decide about the address, so an address that is not an address must not
    // produce a DIFFERENT refusal — that difference would be an oracle telling
    // a caller which addresses this school recognises.
    expect(decideEmailDomain({ allowlist: [], email: 'not-an-address' })).toEqual(
      decideEmailDomain({ allowlist: [], email: 'teacher@school.lk' }),
    );
    expect(decideEmailDomain({ allowlist: [], email: 'not-an-address' })).toEqual({
      allowed: false,
      reason: 'allowlist-not-configured',
    });
  });

  it('reports a malformed address only once there is a list it could have matched', () => {
    expect(decideEmailDomain({ allowlist: ['school.lk'], email: 'not-an-address' })).toEqual({
      allowed: false,
      reason: 'address-malformed',
    });
    for (const email of ['', '@', 'teacher@', 'teacher@school lk', 'a@b@c']) {
      expect(
        decideEmailDomain({ allowlist: ['school.lk'], email }),
        `${email} is not an address in any configured domain`,
      ).toEqual({ allowed: false, reason: 'address-malformed' });
    }
  });

  it('does not mutate the array it was given', () => {
    // The stored value is somebody's configuration. Normalising into it would
    // make a read have a write effect, and the row would drift away from what
    // the administrator typed for no reason they could see.
    const allowlist = [' SCHOOL.LK ', 'not a domain'];
    const snapshot = [...allowlist];

    decideEmailDomain({ allowlist, email: 'teacher@school.lk' });

    expect(allowlist).toEqual(snapshot);
  });

  it('treats a duplicated configured entry as one domain', () => {
    // Not a rule anybody asked for, but a list built by repeated edits must not
    // accumulate enough copies to be mistaken for breadth.
    expect(
      decideEmailDomain({
        allowlist: ['school.lk', 'SCHOOL.LK', '@school.lk'],
        email: 't@school.lk',
      }),
    ).toEqual({ allowed: true, domain: 'school.lk' });
  });
});
