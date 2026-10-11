import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { Audited } from '../../../common/guards/route-guards.decorator.js';
import { Public } from '../../../common/guards/public.decorator.js';
import { ActivationEnvelopeBody } from '../dto/activation-envelope.dto.js';
import { ActivateOfflineLicence } from '../use-cases/activate-offline-licence.js';

/**
 * The one `@Public` justification this route's pair carries, as a single
 * line: `check-route-guards.mjs` walks outward from the route decorator
 * absorbing contiguous decorator lines, and the full argument is in
 * `route-guards.allowlist.json`, which is what a reviewer reads.
 */
const LICENCE_ACTIVATION_PUBLIC_REASON =
  'The signed certificate IS the credential, exactly as the setup token is on ' +
  '/auth/setup/complete: a deployment being licensed for the first time has no session to ' +
  'authorise with, and no role to hold - the first administrator exists but holds no roles. ' +
  'The authorisation is the ECDSA P-256 signature over the canonical payload (ADR-009), which ' +
  'only the holder of the licence private key can produce, plus a binding to THIS school ' +
  '(a certificate naming another school is refused). Nothing is granted by the route itself: ' +
  'it validates, binds, stores, and refreshes the cache, and every other route through ' +
  'EntitlementGuard is unchanged by anything but a stored certificate. Bounded by argon2-free ' +
  'verification cost, by the one-row-per-school constraint, and by @Audited. AGENTS.md 2.3, 2.13.';

/** The frozen refusal bodies, as constants rather than inline objects. */
const REFUSED_BODY = Object.freeze({
  statusCode: 400,
  error: 'Bad Request',
  message:
    'This certificate could not be activated. It may not be genuine, it may not be for this ' +
    'school, or it may have expired. The audit record carries the attempt.',
});

const MISMATCH_BODY = Object.freeze({
  statusCode: 400,
  error: 'Bad Request',
  message:
    'This certificate is genuine but was issued for a different school. An administrator gets ' +
    'the right certificate from the vendor.',
});

/**
 * `POST /licensing/activate` — the offline half of `PLT-304` (and the local
 * half of `PLT-303`).
 *
 * ## The story this serves
 *
 * A school at an air-gapped site cannot reach an activation server, so the
 * exchange is manual: the vendor hands over a `.lic` file, an administrator
 * uploads it, the school runs. The file IS the envelope
 * `ValidateLicenceCertificate` judges, so "identical validation rigour" is
 * satisfied by construction — the same validator the boot refresh runs.
 *
 * ## Why the response says nothing about WHY it refused
 *
 * Three different refusals (forged, wrong school, expired) answer the same
 * 400. An attacker probing with edited certificates learns nothing about
 * which check they failed, which is the same posture the sign-in refusal and
 * the reset-link refusal take. The detail lives in the audit record and the
 * server log, where an administrator can see it.
 */
@Controller('licensing')
export class LicensingController {
  constructor(
    @Inject(ActivateOfflineLicence)
    private readonly activate: ActivateOfflineLicence,
  ) {}

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @Public(LICENCE_ACTIVATION_PUBLIC_REASON)
  @Audited('LICENCE_ACTIVATION')
  async activateLicence(@Body() body: unknown): Promise<{ readonly activated: true }> {
    const parsed = ActivationEnvelopeBody.safeParse(body);
    if (!parsed.success) {
      // The body is not an envelope at all. That is a caller mistake, and
      // naming the shape a `.lic` file has is not a disclosure.
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message:
          'A certificate envelope needs a certificate, a canonicalisation version, a key id and a signature.',
      });
    }

    const outcome = await this.activate.activate({ certificate: parsed.data });

    switch (outcome.outcome) {
      case 'activated':
        // `PLT-303`'s AC is satisfied by the CACHE write the use-case does,
        // not by a restart: the next request through `EntitlementGuard`
        // answers from the refreshed state.
        return { activated: true };

      case 'school-mismatch':
        throw new BadRequestException(MISMATCH_BODY);

      default:
        // `refused` and `storage-failed` answer identically: neither
        // unlocked anything, and the audit record carries the reason.
        throw new BadRequestException(REFUSED_BODY);
    }
  }
}
