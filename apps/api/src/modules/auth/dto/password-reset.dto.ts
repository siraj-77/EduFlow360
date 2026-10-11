import { z } from 'zod';

/**
 * The password-reset bodies (`PLT-105`).
 *
 * ## Transport bounds, in the shape `setup-completion.dto.ts` established:
 * bound what the caller can send, and decide NOTHING
 *
 * The password's length POLICY is `PASSWORD_MIN_LENGTH` /
 * `PASSWORD_MAX_LENGTH` from configuration, decided by
 * `decidePasswordAcceptance` inside the use-case. So this schema carries the
 * widest legal value — non-empty, bounded for the DoS case — and the policy
 * answer comes back as a refusal. A DTO that enforced twelve characters would
 * be a DTO implementing a policy that is explicitly provisional
 * (`password-policy.ts`).
 *
 * The token bound is wide for the same reason the setup token's is: the value
 * is base64url and its length is the generator's business, not the
 * transport's. A 43-character token fits; anything shorter than a real token
 * is refused by the store as unknown, which is the answer it deserves.
 */

/** `POST /auth/password-reset/request`. */
export const PasswordResetRequestBody = z.object({
  email: z.string().trim().min(3).max(320),
});

/** `POST /auth/password-reset/confirm`. */
export const PasswordResetConfirmBody = z.object({
  token: z.string().trim().min(1).max(512),
  password: z.string().min(1).max(1024),
});

export type PasswordResetRequestBodyShape = z.infer<typeof PasswordResetRequestBody>;
export type PasswordResetConfirmBodyShape = z.infer<typeof PasswordResetConfirmBody>;
