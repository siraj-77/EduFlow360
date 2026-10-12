import type { IClock } from '../domain/ports/clock.js';
import type { IUserCredentialRepository } from '../domain/repositories/user-credential-repository.js';
import type { IEmailDelivery } from '../domain/ports/email-delivery.js';
import type { IPasswordResetTokenRepository } from '../domain/repositories/password-reset-token-repository.js';

/**
 * The device slice a reset request records. Structural, so no import of
 * `common/http/request-context.ts` reaches into the application layer — the
 * controller passes the shape, and `toDeviceContext` produces exactly it.
 */
export interface RequestDeviceContext {
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

/**
 * `RequestPasswordReset` — `PLT-105` T1.
 *
 * ## The enumeration answer, in one sentence: the caller is told the same
 * thing either way
 *
 * Whether or not an account exists, whether or not it is active, and whether
 * or not the mail actually went out, this use-case RESOLVES. The controller's
 * body is therefore a constant, and a caller cannot learn anything from the
 * response. The one thing that differs is invisible to the caller: whether a
 * credential was minted and a link was mailed.
 *
 * ## Why the failure to send is logged and swallowed
 *
 * Two forces pull opposite ways and this is the resolution. The caller must
 * not learn (enumeration). The deployment must know (a reset link nobody
 * received is the support ticket that says "the button did nothing"). So the
 * failure is reported where an operator will see it — `console.error` until
 * `PLT-501` gives this a structured error log — and the answer to the caller
 * does not move.
 *
 * ## Why the token window is a constructor parameter
 *
 * `PASSWORD_RESET_TTL_MS` is configuration (`AGENTS.md` 2.14), and a policy
 * read from the environment is a parameter of the DECISION rather than a
 * fact the use-case reaches out and grabs. The default is here, and the
 * module supplies the configured value.
 */

export interface RequestPasswordResetDeps {
  readonly users: IUserCredentialRepository;
  readonly tokens: IPasswordResetTokenRepository;
  readonly email: IEmailDelivery;
  readonly clock: IClock;
}

export const DEFAULT_RESET_TTL_MS = 3_600_000;

export class RequestPasswordReset {
  constructor(
    private readonly deps: RequestPasswordResetDeps,
    private readonly options: {
      /** From `PASSWORD_RESET_TTL_MS`; one hour by default. */
      readonly ttlMs?: number;
      /**
       * Where the reset link points — the web app's own origin, from
       * `WEB_ORIGIN`. REQUIRED, and deliberately without a fallback: a
       * use-case must not invent where the web app lives (`AGENTS.md`
       * 2.14 — the origin is configuration). It used to default to
       * `http://localhost:3500`, which was dead in production (the
       * module always passes the configured value) and a mailed
       * localhost link waiting to happen the day a caller forgot it.
       */
      readonly webOrigin: string;
    },
  ) {}

  async request(params: {
    readonly email: string;
    readonly sourceAddress?: string;
    readonly device?: RequestDeviceContext | null;
  }): Promise<void> {
    const ttlMs = this.options.ttlMs ?? DEFAULT_RESET_TTL_MS;
    const webOrigin = this.options.webOrigin;

    // ── 1. The account, if there is one ─────────────────────────────────────
    // The credential repository's contract is one indexed read that answers
    // the same way for a missing identifier, so this branch adds no timing
    // difference an attacker could measure.
    const match = await this.deps.users.findByIdentifier(params.email);

    // A suspended account is a real account: it exists, and it gets nothing.
    // A reset link would be a way around the suspension.
    if (!match.matched || match.record.status !== 'ACTIVE') return;

    // ── 2. Mint the credential. The plaintext exists only in `issued`. ──────
    const issued = await this.deps.tokens.issue({
      userId: match.record.userId,
      ttlMs,
      now: this.deps.clock.now(),
      requestedIp: params.sourceAddress ?? null,
      requestedDevice: params.device?.userAgent ?? null,
    });

    // ── 3. The mail. Never carries the token anywhere but the link. ─────────
    const link = `${webOrigin}/en/sign-in/reset?token=${encodeURIComponent(issued.tokenPlaintext)}`;

    try {
      await this.deps.email.send({
        to: params.email,
        subject: 'Reset your EduFlow360 password',
        textBody: [
          'A password reset was requested for your EduFlow360 account.',
          '',
          `Use this link to choose a new password: ${link}`,
          '',
          'The link works once, and it expires in one hour. If you did not',
          'request a reset you can ignore this message — nothing has changed.',
        ].join('\n'),
        htmlBody: null,
      });
    } catch (cause) {
      // Logged, never returned. The message names the account and the
      // failure; the TOKEN IS NOT IN IT (`AGENTS.md` 2.13) — the link above
      // is the only place the token exists outside the store's hash.
      console.error(
        `RequestPasswordReset could not deliver the reset mail for ${params.email}: ` +
          `${cause instanceof Error ? cause.message : String(cause)}. ` +
          'The request still answers as accepted; the token remains valid until it expires.',
      );
    }
  }
}
