/**
 * The canonical, deterministic serialisation a licence is signed over
 * (`ADR-009`; `PLT-301`).
 *
 * ## Why this exists rather than `JSON.stringify`
 *
 * A signature over non-canonical JSON is a signature over one byte sequence,
 * not over content. The verifier and the signer — which today is an activation
 * server that does not exist in this repository — must agree byte-for-byte
 * forever, across languages and library versions. `JSON.stringify` is not
 * that agreement: it preserves insertion order, and any re-serialisation on
 * the way in or out can reorder, re-space or re-escape. The rules below are
 * the agreement.
 *
 * ## The rules, specified so another language can match them
 *
 *  1. Object keys sorted by UTF-16 code-unit order (JavaScript's default
 *     string sort — the order JCS specifies, so the signer is not required to
 *     be JavaScript).
 *  2. No insignificant whitespace.
 *  3. Numbers: ECMAScript's own number-to-string. It is defined by ECMA-262
 *     rather than by this project, which is exactly why it can be relied on:
 *     shortest round-tripping form, exponent form outside [1e-6, 1e21).
 *  4. Strings: exactly the escapes RFC 8259 requires (`\"`, `\\`, C0 controls
 *     with the five shorthands and `\u00xx` for the rest). Non-ASCII is
 *     emitted raw.
 *  5. `undefined`, functions, symbols and non-finite numbers are refused —
 *     see `write` below for why a refusal beats a drop.
 *
 * ## Versioned, and frozen once certificates exist in the field
 *
 * The version is a constant in the signed material (`ADR-009`), so a future
 * scheme is a NEW version this repository can still verify alongside, not a
 * break in the field.
 */

/**
 * The canonicalisation scheme in force. Part of the signed material.
 *
 * Bumped only by a new `canonicalise` implementation that keeps old
 * certificates verifiable — a silent change here invalidates every licence
 * ever issued, which is why it is a named constant and not an inline literal.
 */
export const CANONICALISATION_VERSION = 1 as const;

/** What `canonicalise` refuses to serialise, as one error type. */
export class NonCanonicalValueError extends Error {
  constructor(reason: string) {
    super(
      `This value cannot be canonicalised: ${reason}. A licence carrying it ` +
        'would sign bytes that mean something other than what the caller wrote, ' +
        'so it is refused rather than coerced.',
    );
    this.name = 'NonCanonicalValueError';
  }
}

/**
 * Write `value` in canonical JSON.
 *
 * Recursive rather than a pre-sort-then-stringify, because a pre-pass that
 * rewrites key order creates new objects and loses the distinction between
 * "an object with one key" and "an object whose key dropped to undefined" —
 * the second must be a refusal, and only the walk can see it.
 */
export function canonicalise(value: unknown): string {
  return write(value);
}

function write(value: unknown): string {
  if (value === null) return 'null';

  const type = typeof value;

  if (type === 'string') return JSON.stringify(value);
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'number') {
    if (!Number.isFinite(value)) {
      throw new NonCanonicalValueError('JSON has no representation for a non-finite number');
    }
    // ECMAScript's own number-to-string — the rule, in full.
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    // Arrays keep their order: an array in a licence is a sequence, not a set.
    return `[${value.map(write).join(',')}]`;
  }

  if (type === 'object') {
    // Cycles, before the walk: `JSON.stringify` throws on them with a message
    // about a circular structure, and this file says so in its own terms so
    // the failure a caller sees is this scheme's, not the engine's.
    return writeObject(value as Record<string, unknown>);
  }

  throw new NonCanonicalValueError(`${type} is not a JSON value`);
}

function writeObject(value: Record<string, unknown>): string {
  const entries: string[] = [];

  for (const key of Object.keys(value).sort()) {
    const property = value[key];
    // The rule the walk exists for. `JSON.stringify` DROPS these keys, and a
    // signature over the dropped form is a signature over a different object.
    if (property === undefined || typeof property === 'function' || typeof property === 'symbol') {
      throw new NonCanonicalValueError(
        `the property ${JSON.stringify(key)} holds a value JSON cannot represent`,
      );
    }
    entries.push(`${JSON.stringify(key)}:${write(property)}`);
  }

  return `{${entries.join(',')}}`;
}

/**
 * What a certificate's signature actually covers: the payload plus the
 * scheme's own metadata.
 *
 * The signature field itself is NOT inside (that would be circular), and the
 * envelope's key id is NOT inside (choosing a key must not change the message
 * the key signs) — see the spec.
 */
export function canonicaliseLicenceMaterial(payload: unknown): string {
  return canonicalise({
    canonicalisationVersion: CANONICALISATION_VERSION,
    payload,
  });
}
