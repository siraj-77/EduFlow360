import {
  BadRequestException,
  ConflictException,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  Body,
  Req,
} from '@nestjs/common';
// `ZodError` is only ever named as a type here — the value comes from
// `safeParse(...).error` — so `import type` is correct and the lint rule is right.
import type { ZodError } from 'zod';
import { Public } from '../../../common/guards/public.decorator.js';
import { Audited } from '../../../common/guards/route-guards.decorator.js';
import { sourceAddressOf, type RequestWithAddress } from '../../../common/http/request-context.js';
// A VALUE import for `FixedWindowThrottle`, because `@Inject(FixedWindowThrottle)`
// below needs a runtime token. A VALUE import for nothing in this file would be a
// lint error; an `import type` would typecheck perfectly, pass `tsc`, pass lint, and
// then throw `ReferenceError: FixedWindowThrottle is not defined` the moment the
// class was decorated. That is the bug `oidc-sign-in.controller.ts` documents, hit
// again here on a different line, and the spec below caught it.
import { FixedWindowThrottle } from '../../../common/throttle/fixed-window-throttle.js';
// `ThrottlePolicy` really is type-only and is marked as such.
import type { ThrottlePolicy } from '../../../common/throttle/fixed-window-throttle.js';
import { SetupCompletionBody, type SetupCompletionBodyShape } from '../dto/setup-completion.dto.js';
import {
  CompleteFirstAdministratorSetup,
  PasswordRefusedError,
  SetupAlreadyClaimedError,
  SetupTokenInvalidError,
  SetupUnenrolledError,
} from '../use-cases/complete-first-administrator-setup.js';

/**
 * The throttle configuration for this route, as a DI token.
 *
 * Declared HERE rather than in `auth.module.ts` for a structural reason: the module
 * already imports this controller, so importing the token back out of the module
 * would close a cycle. A controller exporting the token it consumes keeps the
 * dependency pointing one way, which is the same reason
 * `oidc-sign-in.controller.ts` declares its response interface locally rather than
 * importing Express.
 */
export const SETUP_THROTTLE_POLICY = Symbol('SETUP_THROTTLE_POLICY');

/**
 * `@Public` justification, as a single-line named constant.
 *
 * Single-line because `check-route-guards.mjs` walks outward from the route
 * decorator absorbing contiguous decorator lines; a multi-line `@Public(...)` is
 * handled, but keeping the call on one line is what the existing controller does
 * and there is no reason to differ. The full argument also lives in
 * `route-guards.allowlist.json`, which is the artefact a reviewer reads.
 */
const SETUP_COMPLETE_PUBLIC_REASON =
  'The one-time setup token IS the credential on this route. A permission check would require the ' +
  'permission the route exists to grant: no account, session or role exists before the token is ' +
  'spent, and the deployment state it reads is precisely what a permission system cannot gate. ' +
  'The route is bounded by the token itself, by argon2id, and by a per-source throttle. AGENTS.md ' +
  '2.3 and 2.13.';

/**
 * The keys this schema knows about, used to bound what a validation failure may
 * report.
 *
 * A Zod issue path is derived from the INPUT, so for a nested or union schema it can
 * contain a key the caller chose. Echoing that back would let a caller put arbitrary
 * text into an error response. Intersecting with the schema's own key set means the
 * response can only ever name a field this route actually has.
 */
const KNOWN_BODY_KEYS: ReadonlySet<string> = new Set(['token', 'password', 'email', 'username']);

/**
 * `POST /auth/setup/complete` — claim a fresh deployment.
 *
 * ## What `@Audited` does and does not do HERE, stated plainly
 *
 * **Nothing yet.** `@Audited('SETUP_COMPLETE')` records a key in route metadata, and
 * `PLT-402` is the story that will write it to `audit_records`. There is no audit
 * writer in this repository, nothing reads the metadata, and `CsrfGuard` is the only
 * control that enforces anything. So no audit row is produced by this route today,
 * and no test in this repository can assert one — asserting that a mock was called
 * would be asserting a fiction.
 *
 * The decorator is here because `AGENTS.md` 2.3 requires it on a sensitive action and
 * because the requirement is easier to honour at the moment the route is written than
 * to retrofit. `check-route-guards` proves the key is PRESENT; it cannot prove
 * anything was recorded, and this comment exists so no reader assumes otherwise.
 *
 * ## Why there is no `@RequireEntitlement`
 *
 * A Basic-edition school must be able to sign in, or it cannot use the product at
 * all. Entitlement gates features, and authentication is not one of them — the same
 * reasoning `oidc-sign-in.controller.ts` gives for its own route.
 *
 * ## The status map, and why 404 is deployment state
 *
 * | situation                                        | status |
 * |--------------------------------------------------|---------|
 * | claimed                                          | 200     |
 * | password failed the policy                       | 400     |
 * | token expired, or forged                         | 400     |
 * | body is not a valid request                      | 400     |
 * | the one claim is already made, or this one lost it| 409    |
 * | this deployment has never been enrolled          | 404     |
 * | more than N attempts from one source             | 429     |
 *
 * `404` is a property of DEPLOYMENT STATE, not of the token (`D58`): an unenrolled
 * deployment must not advertise that the endpoint exists, while within an enrolled
 * deployment an expired token and a forged one must be indistinguishable. The 404
 * versus 400 distinction therefore says whether a bootstrap token has been issued on
 * this deployment — a residual leak that `setup-token.ts` already records, mitigated
 * by the throttle below.
 *
 * The 404 body is Nest's GENERIC not-found body, carrying no information about any
 * token. Byte-identity with Nest's own route-not-found body is NOT aimed at and not
 * achievable: that body echoes the requested path
 * (`{"message":"Cannot POST /auth/no-such-route",...}`), so matching it would mean
 * hand-writing framework text that changes between Nest versions. `D58`'s operative
 * clause is "reveals nothing about any token", and that is what is asserted —
 * `setup-complete-over-http.integration.spec.ts` reads the body back to prove it.
 */
@Controller('auth')
export class SetupCompletionController {
  constructor(
    // `@Inject(...)` with a VALUE import, never `import type`. Two rules collide
    // here and `oidc-sign-in.controller.ts` resolves them the same way; read its
    // header before changing either. `emitDecoratorMetadata` cannot turn a type-only
    // import into a runtime token, and this repository shipped that bug once: the
    // container could not resolve the dependency and the whole application failed to
    // boot while `tsc`, `lint` and the build all reported success.
    @Inject(CompleteFirstAdministratorSetup)
    private readonly completeSetup: CompleteFirstAdministratorSetup,
    @Inject(FixedWindowThrottle) private readonly throttle: FixedWindowThrottle,
    @Inject(SETUP_THROTTLE_POLICY) private readonly throttlePolicy: ThrottlePolicy,
  ) {}

  @Public(SETUP_COMPLETE_PUBLIC_REASON)
  @Audited('SETUP_COMPLETE')
  @Post('setup/complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @Body() body: unknown,
    @Req() request: RequestWithAddress,
  ): Promise<{ readonly userId: string }> {
    // ── Throttle, FIRST, before the body is even parsed. ─────────────────────
    // Before parsing so a caller cannot spend server CPU on JSON validation and
    // argon2 by sending bodies it was always going to have refused.
    //
    // Keyed on the source address because an attacker holds no token to key on.
    const decision = this.throttle.check(sourceAddressOf(request), this.throttlePolicy);
    if (!decision.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          // Names the WINDOW, not the caller, and never the token.
          message:
            'Too many attempts from this source. Try again after the interval below. The setup ' +
            'token has NOT been spent.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const parsed = SetupCompletionBody.safeParse(body);
    if (!parsed.success) throw toBadRequest(parsed.error);

    try {
      return await this.completeSetup.complete({
        setupTokenPlaintext: parsed.data.token,
        password: parsed.data.password,
        // Conditional spread: `exactOptionalPropertyTypes` is on, and an absent
        // optional is not an explicit `undefined`. See `setup-completion.dto.ts` for
        // why these are optional at all.
        ...(parsed.data.email !== undefined || parsed.data.username !== undefined
          ? {
              identity: {
                ...(parsed.data.email !== undefined ? { email: parsed.data.email } : {}),
                ...(parsed.data.username !== undefined ? { username: parsed.data.username } : {}),
              },
            }
          : {}),
      });
    } catch (cause) {
      throw toHttpException(cause);
    }
  }
}

/**
 * One typed domain error, one HTTP status, one message.
 *
 * Centralised so the mapping cannot drift between a refusal and its twin. The
 * pairing that matters most: an EXPIRED token and a FORGED one are the same class,
 * so they are the same status and the same body by construction rather than by two
 * branches happening to agree.
 */
export function toHttpException(cause: unknown): HttpException {
  if (cause instanceof SetupUnenrolledError) {
    // **A bare `NotFoundException`, with no message of our own**, and that is the
    // whole point rather than a terseness choice.
    //
    // `D58` says an unenrolled deployment "answers 404 to every request and therefore
    // reveals nothing about any token". A 404 with a bespoke body saying "no setup token
    // outstanding" does NOT satisfy that: Nest's own not-found response for an unknown
    // path reads `{"message":"Cannot POST /whatever","error":"Not Found",...}`, so an
    // attacker could tell "the route exists and is unenrolled" from "the route does not
    // exist here" — which is the advertisement `D58` exists to prevent.
    //
    // The explanation is not lost, it is moved: it lives on `SetupUnenrolledError` for
    // anything that logs the error, and `AuthModule` already warns at boot when neither
    // database nor school is configured, which is the case an operator needs explained.
    return new NotFoundException();
  }
  if (cause instanceof SetupTokenInvalidError) {
    return new BadRequestException(
      'That setup token is not valid. It may have expired, or it may never have been issued to ' +
        'this deployment. The two are deliberately indistinguishable (D58).',
    );
  }
  if (cause instanceof SetupAlreadyClaimedError) {
    return new ConflictException(
      'This deployment has already been claimed. The one-time setup token has been spent, and a ' +
        'deployment has exactly one first administrator.',
    );
  }
  if (cause instanceof PasswordRefusedError) {
    return new BadRequestException(
      `That password does not meet this deployment's policy (${cause.refusal}). The setup token ` +
        'has NOT been spent, so you can simply try again.',
    );
  }
  // Anything else is a genuine fault. Rethrown rather than translated: a 500 on this
  // route means something is broken, and hiding that behind a 400 would make an
  // outage look like a user's mistake.
  throw cause;
}

/**
 * A validation failure, as a 400 that can only name this route's own fields.
 *
 * The Zod error's own message is discarded rather than reformatted: Zod's default
 * text quotes the offending VALUE in some issue types, and this route's values are
 * a token and a password (`AGENTS.md` 2.13). Only the schema's own key names survive,
 * which are fixed strings this file can enumerate.
 */
export function toBadRequest(error: ZodError): BadRequestException {
  const fields = [
    ...new Set(
      error.issues
        .map((issue) => issue.path[0])
        .filter((segment): segment is string => typeof segment === 'string')
        .filter((segment) => KNOWN_BODY_KEYS.has(segment)),
    ),
  ].sort();

  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    message:
      'The request body is not valid for this route.' +
      (fields.length > 0 ? ` Check: ${fields.join(', ')}.` : ''),
    // Names only. Never a submitted value, never the token, never the password.
    fields,
  });
}

/** Re-exported so a spec can state a body shape without importing Zod. */
export type { SetupCompletionBodyShape };
