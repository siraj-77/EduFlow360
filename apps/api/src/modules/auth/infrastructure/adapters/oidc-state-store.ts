import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IClock } from '../../domain/ports/clock.js';
import {
  OIDC_STATE_COOKIE_NAME,
  OIDC_STATE_COOKIE_PATH,
  type IOidcStateStore,
  type OidcStateCookie,
  type OidcStatePayload,
  type SealedOidcState,
} from '../../domain/ports/oidc-state-store.js';

/**
 * The OIDC state bundle, signed and carried in a cookie.
 *
 * ## The format, and why it is two segments
 *
 *     eduflow_oidc_state = base64url(payload) "." base64url(HMAC-SHA256(payload))
 *
 * base64url rather than base64 because the value goes into a `Set-Cookie`
 * header, where `+`, `/` and `=` are either escaped or ambiguous. The separator
 * is `.` precisely because base64url's alphabet does not contain it, so the
 * split is unambiguous rather than a search that could pick the wrong dot.
 *
 * ## Why HMAC and not encryption
 *
 * The bundle is not secret. `state` and `nonce` are already in the URL the
 * browser was sent to, and `redirectUri` is this deployment's own configuration.
 * Only `codeVerifier` is genuinely sensitive, and it is protected by being
 * `httpOnly` and by never appearing in a URL — the two properties PKCE relies
 * on. Encrypting would add a key, an algorithm and a nonce-collision question in
 * exchange for confidentiality this flow does not need, and would put a
 * confidentiality bug on the path that decides whether a sign-in may proceed.
 *
 * Integrity is the whole requirement, so the whole mechanism is a MAC.
 *
 * ## Why the MAC is compared in constant time
 *
 * `timingSafeEqual`, with an explicit length check first. Byte-by-byte string
 * comparison leaks how many leading bytes matched, which turns "forge a
 * signature" from 2^256 guesses into a much cheaper search. The length check is
 * not optional: `timingSafeEqual` throws on mismatched lengths, and a throw here
 * would be an unhandled 500 on a request anybody can send.
 *
 * ## The key is `JWT_ACCESS_SECRET`, and that is a compromise worth naming
 *
 * Reusing an existing key avoids adding a configuration variable for one
 * consumer, and the HMAC input is domain-separated below so the value cannot be
 * confused with another use of the same secret.
 *
 * What it does not give is true key separation: a leak of `JWT_ACCESS_SECRET`
 * now also permits forging a state bundle. A dedicated `OIDC_STATE_SECRET` is the
 * better design and is **not** what this is. It is not here because `env.ts`
 * makes the JWT secrets optional at this stage of the build, and requiring a new
 * one to boot would turn a scaffold checkout into a refusal to start. Promote it
 * when the deployment story settles — the change is one constructor argument.
 */

/** Domain separation. See the note on `JWT_ACCESS_SECRET` above. */
const MAC_CONTEXT = 'eduflow:oidc-state:v1:';

/** SHA-256, and therefore the exact length of every signature this store writes. */
const SIGNATURE_BYTES = 32;

/** Bumped if the payload shape ever changes, so old cookies fail closed. */
const PAYLOAD_VERSION = 1;

/** Compact field names. A cookie is a constrained medium, not a log line. */
interface WirePayload {
  readonly v: number;
  readonly s: string;
  readonly n: string;
  readonly c: string;
  readonly r: string;
  readonly t: number;
}

export class InvalidOidcStateStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOidcStateStoreError';
  }
}

export interface HmacOidcStateStoreConfig {
  /** `true` unless explicitly set to `false`. See `SessionCookieAdapter`. */
  readonly secure?: boolean | undefined;
  /**
   * The second of the two independent switches required to drop `secure`.
   *
   * Named for what it asserts, so the configuration file carries the warning
   * rather than depending on the reader having this file open. Mirrors
   * `SessionCookieAdapterAdapterConfig`; it is duplicated rather than shared only
   * because that adapter's resolution is private to it, and two cookies on one
   * origin must make the same choice or one of them is wrong.
   */
  readonly acknowledgeInsecureLocalhostOnly?: boolean | undefined;
}

export interface HmacOidcStateStoreDeps {
  readonly clock: IClock;
  /** At least 32 characters. Never logged, never echoed in an error. */
  readonly secret: string;
  /** How long a bundle stays open. Positive whole milliseconds, or refused. */
  readonly ttlMs: number;
  readonly config?: HmacOidcStateStoreConfig;
}

/** Behind every plausible device clock, so a cleared cookie is really discarded. */
const EPOCH_MS = 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

@Injectable()
export class HmacOidcStateStore implements IOidcStateStore {
  private readonly clock: IClock;
  private readonly key: Buffer;
  private readonly ttlMs: number;
  /** Resolved once at construction; see `SessionCookieAdapter`. */
  private readonly secure: boolean;

  constructor(deps: HmacOidcStateStoreDeps) {
    this.clock = deps.clock;

    if (!isNonEmptyString(deps.secret) || deps.secret.trim().length < 32) {
      // The offending value is deliberately absent from this message:
      // AGENTS.md 2.13, and the caller may already be holding a real secret.
      throw new InvalidOidcStateStoreError(
        'The OIDC state cookie cannot be signed without a signing key of at least 32 ' +
          'characters. JWT_ACCESS_SECRET is what this store is given. Generate one with ' +
          '`openssl rand -base64 32` and set it, or sign-in cannot start a flow.',
      );
    }

    if (!Number.isSafeInteger(deps.ttlMs) || deps.ttlMs <= 0) {
      throw new InvalidOidcStateStoreError(
        'The OIDC state window (OIDC_STATE_TTL_MS) must be a positive whole number of ' +
          'milliseconds. A value that is not finite, or is fractional, produces an Expires ' +
          'attribute the browser discards — leaving a state cookie with no expiry at all.',
      );
    }

    this.key = Buffer.from(deps.secret, 'utf8');

    const wantsInsecure = deps.config?.secure === false;
    const acknowledged = deps.config?.acknowledgeInsecureLocalhostOnly === true;

    if (wantsInsecure && !acknowledged) {
      throw new InvalidOidcStateStoreError(
        'Refusing to build an OIDC state cookie with secure: false. The cookie carries the ' +
          'PKCE verifier, so over cleartext HTTP anyone on the network path can read it and ' +
          'redeem an intercepted authorization code. This is safe to disable ONLY for local ' +
          'plain-HTTP development (browsers treat http://localhost as a secure context, so the ' +
          'usual local case does not need it). To proceed you must also set ' +
          'acknowledgeInsecureLocalhostOnly: true.',
      );
    }

    this.secure = !wantsInsecure;
    this.ttlMs = deps.ttlMs;
  }

  seal(payload: OidcStatePayload): OidcStateCookie {
    const issuedAtMs = this.clock.now().getTime();
    const encoded = this.encode({ ...payload, issuedAtMs });

    return this.cookie(encoded, issuedAtMs + this.ttlMs);
  }

  open(raw: string | undefined): SealedOidcState | null {
    if (!isNonEmptyString(raw)) return null;

    // Exactly one separator. `indexOf` plus a re-scan for a second one, because a
    // third segment is an attempt to smuggle something past the split.
    const split = raw.indexOf('.');
    if (split <= 0 || raw.indexOf('.', split + 1) !== -1) return null;

    const encodedPayload = raw.slice(0, split);
    const providedSignature = raw.slice(split + 1);
    if (!this.signatureMatches(encodedPayload, providedSignature)) return null;

    const decoded = this.decode(encodedPayload);
    if (decoded === null) return null;

    // The server-side age check. `Expires` is a request to the browser, and the
    // browser is the party an attacker controls.
    if (this.clock.now().getTime() - decoded.t >= this.ttlMs) return null;

    return {
      state: decoded.s,
      nonce: decoded.n,
      codeVerifier: decoded.c,
      redirectUri: decoded.r,
      issuedAtMs: decoded.t,
    };
  }

  expired(): OidcStateCookie {
    return this.cookie('', EPOCH_MS);
  }

  private signatureMatches(encodedPayload: string, provided: string): boolean {
    if (provided.length === 0) return false;

    const expected = createHmac('sha256', this.key)
      .update(MAC_CONTEXT)
      .update(encodedPayload)
      .digest();

    let given: Buffer;
    try {
      given = Buffer.from(provided, 'base64url');
    } catch {
      return false;
    }

    // Before the comparison, because the comparison throws on a length mismatch
    // and a throw here would be a 500 on a request anybody can send.
    if (given.length !== SIGNATURE_BYTES || expected.length !== SIGNATURE_BYTES) return false;

    return timingSafeEqual(expected, given);
  }

  private encode(payload: OidcStatePayload & { readonly issuedAtMs: number }): string {
    const wire: WirePayload = {
      v: PAYLOAD_VERSION,
      s: payload.state,
      n: payload.nonce,
      c: payload.codeVerifier,
      r: payload.redirectUri,
      t: payload.issuedAtMs,
    };

    const encodedPayload = Buffer.from(JSON.stringify(wire), 'utf8').toString('base64url');

    return `${encodedPayload}.${this.signatureFor(encodedPayload)}`;
  }

  private signatureFor(encodedPayload: string): string {
    return createHmac('sha256', this.key)
      .update(MAC_CONTEXT)
      .update(encodedPayload)
      .digest('base64url');
  }

  /**
   * `null` for anything that is not a well-formed, current payload.
   *
   * Unreachable through the public API — only this store can produce a valid
   * signature — so the JSON and shape checks below are defence against a *bug*
   * rather than against an attacker, and are deliberately fail-closed: a parse
   * failure is a refusal, never a 500.
   */
  private decode(encodedPayload: string): WirePayload | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }

    if (typeof parsed !== 'object' || parsed === null) return null;
    const wire = parsed as Partial<WirePayload>;

    if (wire.v !== PAYLOAD_VERSION) return null;
    if (!isNonEmptyString(wire.s) || !isNonEmptyString(wire.n)) return null;
    if (!isNonEmptyString(wire.c) || !isNonEmptyString(wire.r)) return null;
    if (typeof wire.t !== 'number' || !Number.isFinite(wire.t)) return null;

    return {
      v: wire.v,
      s: wire.s,
      n: wire.n,
      c: wire.c,
      r: wire.r,
      t: wire.t,
    };
  }

  private cookie(value: string, expiresAtMs: number): OidcStateCookie {
    return {
      name: OIDC_STATE_COOKIE_NAME,
      value,
      attributes: {
        // The PKCE verifier is in here. A script-readable sibling would hand an
        // XSS the one secret PKCE exists to protect.
        httpOnly: true,
        secure: this.secure,
        // `Strict` would withhold the cookie from the top-level navigation that
        // completes the sign-in, so every login would render signed-out.
        sameSite: 'lax',
        path: OIDC_STATE_COOKIE_PATH,
        expiresAt: new Date(expiresAtMs),
      },
    };
  }
}
