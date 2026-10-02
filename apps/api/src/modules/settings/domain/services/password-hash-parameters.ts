import type { PasswordHashParameters } from '../../../auth/domain/ports/password-hasher.js';

/**
 * This school's argon2id cost parameters, as the application layer sees them.
 *
 * ## Why this is a rule and not a constant in the adapter
 *
 * `ADR-007` rejected a hard-coded cost factor outright, and `AGENTS.md` §2.14
 * puts every threshold in settings rather than in code. The reason is
 * operational, not stylistic: argon2 is tuned for MEMORY hardness, so the right
 * cost is a property of the hardware the school runs on. One deployment is one
 * school (`ADR-003`), and a school on a small VM cannot afford a factor tuned on
 * a workstation — hashing every login at 64 MiB × 3 passes stalls the morning
 * log-in rush, which is an outage. And the factor lowered to fix that stall is
 * then weak for every school that had the hardware.
 *
 * So the value is per-school, stored on `school_settings`, and the hasher is
 * handed it. The hasher holds no default of its own: `IPasswordHasher.hash`
 * requires its parameters, because an optional argument with an internal
 * default is a hard-coded factor with extra steps.
 *
 * ## The default is a DEFAULT, and this function says so out loud
 *
 * A school that has configured nothing still has to be able to log anyone in.
 * Failing closed here does not protect anybody — it produces a deployment
 * where nobody can sign in — so the absence of settings resolves to a
 * published recommendation rather than to an error.
 *
 * What that default is NOT is a value somebody chose for this hardware. It is
 * the OWASP Password Storage Cheat Sheet's first argon2id recommendation, used
 * because it is a citable external authority rather than a number invented in
 * this repository, and because it is the number an auditor will recognise.
 * `origin` and `replaced` are returned so a caller can SEE that it was a
 * fallback, rather than a later reader assuming an administrator chose 19 MiB.
 *
 * ## Why an unusable value is replaced, not honoured and not fatal
 *
 * Three options for `{ memoryCost: 0 }`, and each of the other two is worse:
 *
 *  - **Honour it** and the native library throws mid-login, which surfaces as a
 *    500 on the authentication path. A configuration mistake becomes an
 *    outage, and the operator learns about it from users rather than from a log.
 *  - **Refuse the login.** Nobody signs in to a school whose settings row has
 *    never been filled in. That is the fail-closed instinct applied to a value
 *    where failing closed has no security benefit at all — the attacker gains
 *    nothing from an unusable memory cost, they just wait for the operator.
 *  - **Replace it with the default and report it.** The school logs in, at a
 *    strength that is documented rather than chosen, and the caller is handed
 *    `replaced` so the substitution can be logged and fixed.
 *
 * The bounds below are the union of two very different kinds of limit, and the
 * difference matters because they are not equally authoritative.
 *
 * **Library limits** (the lower bounds) are argon2's own, measured against
 * `argon2@0.45.1` rather than quoted from memory: memory below 8 KiB is refused
 * as "Memory cost is too small", zero passes are refused as "Time cost is too
 * small", zero lanes are refused as "Too few lanes", and lanes at or above
 * 2^24 are refused as "Parallelism is too large". Memory must also be at least
 * eight times the lane count — 31 KiB over 4 lanes is refused, 32 KiB over 4
 * lanes is accepted — which is why that constraint is cross-field rather than
 * three independent ranges.
 *
 * **Operational ceilings** (the upper bounds) are OURS and are a judgement
 * call, not a security parameter, and they are the weakest numbers in this
 * file. They exist because the alternative is not a slow login, it is a wedged
 * one: measured on this machine, `timeCost: -1` does not return an error, it
 * never returns at all, and a 1 GiB or 4 GiB memory cost likewise ran past five
 * minutes without completing. A settings row is operator input, and operator
 * input reaches the login path. These ceilings need owner review against real
 * school hardware (`AGENTS.md` §6 — a gap in the corpus is recorded as a gap,
 * not filled with a number that looks chosen).
 *
 * There is deliberately NO security floor at the OWASP value. Clamping a school
 * UP to 19 MiB because it configured 8 MiB would defeat the reason these
 * parameters are configurable: a modest VM needs a cost it can actually serve.
 * The default is a recommendation for an unconfigured school, and a school that
 * has made a deliberate choice below it keeps that choice.
 */

/** The three knobs argon2 exposes, named the way node-argon2 names them. */
export type PasswordHashParameterKey = 'memoryCost' | 'timeCost' | 'parallelism';

export const PASSWORD_HASH_PARAMETER_KEYS: readonly PasswordHashParameterKey[] = [
  'memoryCost',
  'timeCost',
  'parallelism',
] as const;

/**
 * The argon2 cost parameters used by a school that has configured none.
 *
 * OWASP Password Storage Cheat Sheet, the argon2id entry, first recommended
 * option: 19 MiB of memory, two passes, one lane. Chosen for provenance, not
 * tuned here — see the header for why a citable recommendation beats an
 * invented number, and for why this is still only a DEFAULT.
 */
export const DEFAULT_PASSWORD_HASH_PARAMETERS: PasswordHashParameters = Object.freeze({
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

/**
 * Operational ceilings, ours rather than argon2's. See the header.
 *
 * 256 MiB is thirteen times the default, so no school on real hardware is
 * likely to reach it; the point is that a fat-fingered value cannot turn a
 * login into an outage. Ten passes at the default memory is roughly a quarter
 * of a second on a modern core, so the ceiling is generous for any deployment
 * that is not already broken.
 */
export const PASSWORD_HASH_PARAMETER_CEILINGS = Object.freeze({
  memoryCost: 262_144,
  timeCost: 10,
});

/** argon2's own floor on memory, in KiB, and the multiplier it applies to lanes. */
const MINIMUM_MEMORY_COST = 8;
const MEMORY_PER_LANE = 8;

/** argon2's own bounds on the other two. */
const MINIMUM_TIME_COST = 1;
const MINIMUM_LANES = 1;
const MAXIMUM_LANES = 2 ** 24 - 1;

/** Where the numbers came from, so a caller can tell the two kinds apart. */
export type PasswordHashParameterOrigin =
  /** Every key was present and usable, so the school chose all three. */
  | 'configured'
  /**
   * At least one key was missing or unusable, so the documented default stands
   * for it. Reported so the substitution is visible rather than silent.
   */
  | 'default';

export interface PasswordHashParameterResolution {
  /** What the hasher is to be given. Always complete; never partially filled. */
  readonly parameters: PasswordHashParameters;
  readonly origin: PasswordHashParameterOrigin;
  /**
   * Which keys did not survive validation, in a stable order.
   *
   * Always present and possibly empty, never absent. `exactOptionalPropertyTypes`
   * is on, so an optional here would mean spreading conditionally at every call
   * site to distinguish "nothing was replaced" from "the field is missing" —
   * two states that mean the same thing.
   */
  readonly replaced: readonly PasswordHashParameterKey[];
}

/**
 * Is this a plain object we can read keys out of?
 *
 * Excludes arrays and null, both of which are objects at runtime and both of
 * which have no keys worth reading. `Json` columns return whatever was written,
 * so this is a real state rather than a theoretical one.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A usable value for one knob: a whole number inside the range argon2 accepts.
 *
 * Integer-ness is checked explicitly rather than left to `Number.isInteger`
 * alone, and the reason is measured: `timeCost: 1.5` is ACCEPTED by the native
 * library and written into the digest as `t=1.5`. A fractional pass count is
 * nonsense that round-trips cleanly enough to look valid later, so it is
 * refused here instead.
 *
 * `NaN` and `Infinity` are excluded by the same test for the same reason:
 * `NaN` is rejected downstream as "Memory cost is too small", but relying on
 * that means the rule lives in a C library rather than in a tested function.
 */
function usable(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Resolve what a school has configured into parameters the hasher can use.
 *
 * Pure, and free of any argon2 import: it reads a settings value and decides.
 * The knowledge that these three keys mean what node-argon2 calls
 * `memoryCost`/`timeCost`/`parallelism` is asserted end to end in
 * `argon2-password-hasher.spec.ts`, which hashes with a deliberately unusual
 * cost and reads the encoded parameters back out of the digest.
 */
export function resolvePasswordHashParameters(stored: unknown): PasswordHashParameterResolution {
  const configured: Record<string, unknown> = isRecord(stored) ? stored : {};
  const replaced: PasswordHashParameterKey[] = [];

  // The lane count is resolved FIRST because the memory floor depends on it:
  // argon2 requires memory to be at least eight times the lanes, so validating
  // memory first would mean assuming a lane count, and assuming one is how a
  // floor gets set below what the library will accept.
  let lanes = DEFAULT_PASSWORD_HASH_PARAMETERS.parallelism;
  if (usable(configured.parallelism, MINIMUM_LANES, MAXIMUM_LANES)) {
    lanes = configured.parallelism;
  } else {
    replaced.push('parallelism');
  }

  const memoryFloor = Math.max(MINIMUM_MEMORY_COST, MEMORY_PER_LANE * lanes);
  let memory = DEFAULT_PASSWORD_HASH_PARAMETERS.memoryCost;
  if (usable(configured.memoryCost, memoryFloor, PASSWORD_HASH_PARAMETER_CEILINGS.memoryCost)) {
    memory = configured.memoryCost;
  } else {
    replaced.push('memoryCost');
  }

  let time = DEFAULT_PASSWORD_HASH_PARAMETERS.timeCost;
  if (usable(configured.timeCost, MINIMUM_TIME_COST, PASSWORD_HASH_PARAMETER_CEILINGS.timeCost)) {
    time = configured.timeCost;
  } else {
    replaced.push('timeCost');
  }

  return {
    parameters: { memoryCost: memory, timeCost: time, parallelism: lanes },
    // `replaced` empty means every key was configured and usable, which is the
    // only state in which the school genuinely chose all three numbers.
    origin: replaced.length === 0 ? 'configured' : 'default',
    replaced,
  };
}
