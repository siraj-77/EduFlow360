import { z } from 'zod';

/**
 * The body of `POST /auth/login`.
 *
 * ## One identifier field, not an `email` and a `username`
 *
 * `PLT-101` is "Email/Username + Password", and the repository decides which of the
 * two an identifier names. Two optional fields would need a rule for the case where
 * both are sent, and — worse — a caller who sent the wrong one would get a different
 * answer from a caller who sent the right one. That is a small enumeration oracle,
 * handed out for free by the shape of the request.
 *
 * ## Why the password is NOT length-checked here
 *
 * Because a policy constrains what a credential may BE, not what may be PRESENTED.
 * An account may predate the policy, may have been set by a console procedure, or
 * may have been set under a configuration this deployment has since tightened.
 * Refusing a short password at this DTO would lock such an account out of its own
 * sign-in and reveal nothing useful to anyone.
 *
 * The upper bound is a transport guard, not a policy: it stops a caller streaming
 * megabytes into a route that runs argon2, and it is far above any value
 * `PASSWORD_MAX_LENGTH` would accept.
 */
const TRANSPORT_PASSWORD_LIMIT = 1024;

export const PasswordSignInBody = z
  .object({
    /** An email address OR a username. Never required to look like either. */
    identifier: z.string().min(1).max(320),

    /** See the header. */
    password: z.string().min(1).max(TRANSPORT_PASSWORD_LIMIT),
  })
  .strict();

export type PasswordSignInBodyShape = z.infer<typeof PasswordSignInBody>;
