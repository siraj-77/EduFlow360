import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  sourceAddressOf,
  toDeviceContext,
  type RequestWithAddress,
} from '../../../common/http/request-context.js';
// A VALUE import, because `@Inject(FixedWindowThrottle)` needs the class at
// runtime — the import-type trap `setup-completion.controller.ts` documents.
import { FixedWindowThrottle } from '../../../common/throttle/fixed-window-throttle.js';
import type { ThrottlePolicy } from '../../../common/throttle/fixed-window-throttle.js';
import { Audited } from '../../../common/guards/route-guards.decorator.js';
import { Public } from '../../../common/guards/public.decorator.js';
import { PasswordResetConfirmBody, PasswordResetRequestBody } from '../dto/password-reset.dto.js';
import { RequestPasswordReset } from '../use-cases/request-password-reset.js';
import { ConfirmPasswordReset } from '../use-cases/confirm-password-reset.js';

/**
 * The throttle configuration for the request route, as a DI token.
 *
 * Declared here rather than in `auth.module.ts` for the structural reason
 * `setup-completion.controller.ts` gives: the module imports the controller,
 * so a token declared in the module would close a cycle.
 */
export const PASSWORD_RESET_THROTTLE_POLICY = Symbol('PASSWORD_RESET_THROTTLE_POLICY');

/**
 * The two `@Public` justifications, as single-line named constants.
 *
 * Single-line because `check-route-guards.mjs` walks outward from the route
 * decorator absorbing contiguous decorator lines; the full arguments also
 * live in `route-guards.allowlist.json`, which is the artefact a reviewer
 * reads.
 */
const PASSWORD_RESET_REQUEST_PUBLIC_REASON =
  'A caller who has forgotten a password has no session to be authorised against - that is the ' +
  'entire population this route serves. The action is bounded instead: the account is resolved by ' +
  'email with one indexed read, the response body is a CONSTANT whether or not the account exists ' +
  '(enumeration), a valid ACTIVE account is required before any credential is minted, and a ' +
  'per-source throttle bounds outbound mail. AGENTS.md 2.3, 2.13, 2.14.';

const PASSWORD_RESET_CONFIRM_PUBLIC_REASON =
  'The reset token IS the credential on this route, exactly as it is on /auth/setup/complete: it ' +
  'is single-use, time-limited, stored only as a SHA-256 hash, and it consumes nothing until the ' +
  'policy accepts the new password. There is no session to gate with - the caller is someone who ' +
  'cannot sign in - so a permission check would gate the very recovery the route exists to ' +
  'provide. Bounded by the token, by argon2id, and by the password policy. AGENTS.md 2.3, 2.13.';

/** The frozen 400 bodies, as constants rather than inline objects. */
const REFUSED_PASSWORD_BODY = Object.freeze({
  statusCode: 400,
  error: 'Bad Request',
  message:
    'That password does not meet this deployment\u2019s policy. Nothing was spent, so you can try again.',
});

/**
 * The frozen, INDISTINGUISHABLE answer for a forged, used or expired link.
 *
 * A caller probing links must not learn which one they hold — the same
 * posture as the sign-in refusal, applied to a credential sitting in a
 * mailbox someone else might read.
 */
const REFUSED_TOKEN_BODY = Object.freeze({
  statusCode: 400,
  error: 'Bad Request',
  message:
    'That reset link is not valid. It may have expired, or it may already have been used. ' +
    'The two are deliberately indistinguishable.',
});

const THROTTLED_BODY = Object.freeze({
  statusCode: 429,
  error: 'Too Many Requests',
  message:
    'Too many reset requests from this source. Try again after the interval. No mail was sent ' +
    'by the requests in this window.',
});

/**
 * `POST /auth/password-reset/{request,confirm}` — `PLT-105`.
 *
 * ## Why the answer never reveals whether the account exists
 *
 * Both routes answer a constant body on every path: the request route answers
 * 200 for a known address, an unknown one and a suspended one alike, and the
 * confirm route answers the same frozen 400 for a forged, used or expired
 * link. This is the sign-in route's enumeration control applied to a
 * credential that lives in a mailbox.
 *
 * ## Frontend
 *
 * The pages that call these routes (`/[locale]/sign-in/forgot`,
 * `/[locale]/sign-in/reset`) are `PLT-105` T3 and WAIT for the app shell
 * (`PLT-EPIC-10`, the next web epic): a pair of pages built without the shell
 * would be a second dead layer after the one `PermissionsProvider` already
 * left. Recorded rather than faked.
 */
@Controller('auth')
export class PasswordResetController {
  constructor(
    @Inject(RequestPasswordReset)
    private readonly requestReset: RequestPasswordReset,
    @Inject(ConfirmPasswordReset)
    private readonly confirmReset: ConfirmPasswordReset,
    // The request route's throttle: keyed on the source address, because an
    // attacker holds no account to key on — the same reasoning
    // `setup-completion.controller.ts` gives.
    @Inject(FixedWindowThrottle)
    private readonly throttle: FixedWindowThrottle,
    @Inject(PASSWORD_RESET_THROTTLE_POLICY)
    private readonly throttlePolicy: ThrottlePolicy,
  ) {}

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @Public(PASSWORD_RESET_REQUEST_PUBLIC_REASON)
  @Audited('PASSWORD_RESET_REQUEST')
  async request(
    @Body() body: unknown,
    @Req() request: RequestWithAddress,
  ): Promise<{ readonly accepted: true }> {
    // ── Throttle, FIRST, before the body is even parsed. ────────────────────
    // Before parsing so a caller cannot spend JSON validation and a mail
    // send on a body that was always going to be refused — and, more to the
    // point, before the route can be made to send unbounded mail on someone
    // else's SMTP relay.
    const decision = this.throttle.check(sourceAddressOf(request), this.throttlePolicy);
    if (!decision.allowed) {
      throw new HttpException(THROTTLED_BODY, HttpStatus.TOO_MANY_REQUESTS);
    }

    const parsed = PasswordResetRequestBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'A valid email address is required.',
      });
    }

    const email: string = parsed.data.email;
    await this.requestReset.request({
      email,
      sourceAddress: sourceAddressOf(request),
      device: toDeviceContext(request).device ?? null,
    });

    // The constant answer, whatever the use-case did. See the header.
    return { accepted: true };
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @Public(PASSWORD_RESET_CONFIRM_PUBLIC_REASON)
  @Audited('PASSWORD_RESET_CONFIRM')
  async confirm(
    @Body() body: unknown,
    // The request is deliberately UNUSED: the confirm route attaches no audit
    // actor, because the handler never learns which account a valid token
    // belonged to — the use-case resolves it. The record therefore carries
    // `actorId: null`, which is the honest answer rather than a claim.
  ): Promise<{ readonly reset: true }> {
    const parsed = PasswordResetConfirmBody.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'A valid token and new password are required.',
      });
    }

    const outcome = await this.confirmReset.confirm({
      token: parsed.data.token,
      newPassword: parsed.data.password,
    });

    switch (outcome.outcome) {
      case 'reset':
        return { reset: true };

      case 'password-refused':
        // Names the FIELD and never the candidate, and never the refusal
        // code — `AGENTS.md` 2.13, and the shape the setup route gives.
        throw new BadRequestException(REFUSED_PASSWORD_BODY);

      case 'token-refused':
        throw new BadRequestException(REFUSED_TOKEN_BODY);
    }
  }
}
