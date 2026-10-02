import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PASSWORD_POLICY,
  decidePasswordAcceptance,
  type PasswordPolicy,
} from './password-policy.js';

/**
 * The provisional password policy.
 *
 * ## The gap this file exists because of
 *
 * `STORY_PLT-107` has an acceptance criterion — "given a password that fails the
 * password policy, then the token is not consumed" — and **there is no password
 * policy in the requirements corpus.** `EduFlow_School_Setup_Workflow_v1.md`
 * line 452 lists "Password policy (length, complexity, history, expiry if any)"
 * as a **Phase 4** item, and line 395 tells the first administrator to set "a
 * strong password (policy from Phase 4 defaults)" — a reference to something
 * that does not exist yet.
 *
 * `AGENTS.md` 6 says a gap in the corpus is recorded as a gap and never filled
 * with an invented threshold. That rule cannot be satisfied and the acceptance
 * criterion honoured at the same time, so this file takes the second option and
 * makes the first one visible:
 *
 *   - it implements the SMALLEST rule that makes the criterion testable —
 *     length bounds and nothing else;
 *   - it refuses composition rules, because NIST SP 800-63B is explicit that
 *     character-class requirements make passwords worse, and inventing them
 *     would be inventing policy this repository has been told does not exist;
 *   - every number carries its provenance in `env.ts`, where it is configuration
 *     and therefore reviewable.
 *
 * **This is a placeholder and must be replaced when Phase 4 designs the policy.**
 * The `provisional` field on `DEFAULT_PASSWORD_POLICY` exists so a caller can
 * see that from the value rather than from a comment.
 */

const policy = DEFAULT_PASSWORD_POLICY;

describe('the provisional policy, stated on the value', () => {
  it('declares itself provisional, so a caller need not read a comment to know', () => {
    expect(policy.provisional).toBe(true);
  });

  it('twelve characters minimum, 128 maximum', () => {
    expect(policy.minimumLength).toBe(12);
    expect(policy.maximumLength).toBe(128);
  });

  it('has a maximum strictly above its minimum, or no password could satisfy it', () => {
    // The schema refuses this at boot (`env.ts`), and asserting it here too means
    // a hand-written policy object cannot smuggle an impossible pair past it.
    expect(policy.maximumLength).toBeGreaterThan(policy.minimumLength);
  });
});

describe('accepting a password', () => {
  it.each([
    { label: 'exactly the minimum length', candidate: 'a'.repeat(12) },
    { label: 'well past the minimum', candidate: 'Correct-Horse-Battery-9' },
    { label: 'spaces, which are characters', candidate: '            ' },
    { label: 'the maximum length exactly', candidate: 'z'.repeat(128) },
  ])('accepts $label', ({ candidate }) => {
    expect(decidePasswordAcceptance(candidate, policy)).toEqual({ accepted: true });
  });

  it('accepts a single character class, because composition rules are not this policy', () => {
    // The deliberate omission. `Password1!` satisfies every classic composition
    // rule and is barely harder to guess than `aaaaaaaaaaaa`; NIST SP 800-63B
    // §3.1.1.2 says so, and Phase 4 owns the real policy.
    expect(decidePasswordAcceptance('aaaaaaaaaaaa', policy)).toEqual({ accepted: true });
  });
});

describe('refusing a password', () => {
  it('refuses one below the minimum, and says which bound it broke', () => {
    expect(decidePasswordAcceptance('a'.repeat(11), policy)).toEqual({
      accepted: false,
      refusal: 'too-short',
    });
  });

  it('refuses an empty password', () => {
    expect(decidePasswordAcceptance('', policy)).toEqual({
      accepted: false,
      refusal: 'too-short',
    });
  });

  it('refuses one past the maximum, because the request body is attacker-controlled', () => {
    // The bound is a DoS guard: this value reaches an intentionally expensive
    // function, and an unbounded one is an unbounded amount of work per request.
    expect(decidePasswordAcceptance('z'.repeat(129), policy)).toEqual({
      accepted: false,
      refusal: 'too-long',
    });
  });
});

describe('the rule reads the policy it is given, not a constant', () => {
  // `AGENTS.md` 2.14: thresholds are settings. A rule that ignored its argument
  // would make `PASSWORD_MIN_LENGTH` configuration in name only — the definition
  // of a silent default.
  const strict: PasswordPolicy = { provisional: true, minimumLength: 24, maximumLength: 64 };
  const lenient: PasswordPolicy = { provisional: true, minimumLength: 8, maximumLength: 256 };

  it('honours a stricter minimum', () => {
    expect(decidePasswordAcceptance('a'.repeat(12), strict)).toEqual({
      accepted: false,
      refusal: 'too-short',
    });
  });

  it('honours a more permissive minimum and maximum together', () => {
    expect(decidePasswordAcceptance('a'.repeat(12), lenient)).toEqual({ accepted: true });
    expect(decidePasswordAcceptance('z'.repeat(200), lenient)).toEqual({ accepted: true });
    expect(decidePasswordAcceptance('z'.repeat(200), DEFAULT_PASSWORD_POLICY)).toEqual({
      accepted: false,
      refusal: 'too-long',
    });
  });

  it('measures in characters, and counts a code point once', () => {
    // `String.length` counts UTF-16 code units, so an emoji or a Devanagari
    // conjunct counts as two. A principal typing Tamil or Sinhala — this product's
    // own languages — must not be refused for typing in them, so the rule counts
    // code points via the spread operator rather than `.length`.
    expect(decidePasswordAcceptance('🔒'.repeat(12), DEFAULT_PASSWORD_POLICY)).toEqual({
      accepted: true,
    });
    expect(decidePasswordAcceptance('🔒'.repeat(6), DEFAULT_PASSWORD_POLICY)).toEqual({
      accepted: false,
      refusal: 'too-short',
    });
  });
});

describe('the refusal carries no part of the password', () => {
  it('never echoes the candidate, so a log line cannot leak it', () => {
    // `AGENTS.md` 2.13. The refusal is a bare reason code precisely so that
    // whatever writes it has nothing sensitive to write.
    const secret = 'hunter2-and-my-birthday';
    const verdict = decidePasswordAcceptance(secret, { ...policy, minimumLength: 64 });

    expect(JSON.stringify(verdict)).not.toContain(secret);
    expect(JSON.stringify(verdict)).not.toContain('hunter2');
  });
});
