import { z } from 'zod';

/**
 * The body of `POST /auth/setup/complete`.
 *
 * ## Where the password policy is NOT
 *
 * Not here. `password` is bounded only by a transport guard; whether it may become
 * this deployment's administrator credential is decided by
 * `decidePasswordAcceptance`, in `domain/services/password-policy.ts`.
 *
 * The reason is the same one `argon2-password-hasher.ts` gives for not putting a
 * length check in the adapter: "can this value be transported" is a question about
 * the request, and "may this account be created with this password" is a policy
 * question. Putting the policy here would make the DTO the security rule, and a
 * security rule that only exists at the edge is a security rule that the
 * use-case spec cannot exercise on its own.
 *
 * ## Why `.strict()`
 *
 * So an unknown key is refused rather than dropped. On this route that matters more
 * than usual: it is the only unauthenticated write in the system, and a client that
 * posts an extra field and receives 200 has been told the field was understood.
 *
 * ## Why `email` and `username` are OPTIONAL here
 *
 * `STORY_PLT-107`'s task list says the route "accepts `token` + `email` +
 * `username` + `password`". Its acceptance criteria, which bind, say nothing about
 * them — and they cannot be authentication inputs, because the one-time token
 * already identifies exactly one row.
 *
 * So they are optional and applied only when supplied. A deployment seeded with
 * `SEED_ADMIN_EMAIL=admin@pending.local` can replace the placeholder at the moment
 * the real principal claims it; a deployment that already has the right values does
 * not have to resend them. Absent means "leave the column alone", which is why they
 * are absent rather than `undefined` — `exactOptionalPropertyTypes` is on and the
 * two are different states.
 *
 * Requiring them would also be worse than tidier: forcing a school to retype an
 * identifier it already has, on a route whose caller may be typing a 43-character
 * token at the same time.
 */

/**
 * A deliberately generous transport ceiling, well above `PASSWORD_MAX_LENGTH`.
 *
 * A body guard, not a policy: it stops a caller streaming megabytes into a route
 * that will refuse the value anyway, while leaving the refusal to the rule that is
 * tested as a rule.
 */
const TRANSPORT_BODY_LIMIT = 1024;

export const SetupCompletionBody = z
  .object({
    /**
     * The one-time setup token, exactly as issued.
     *
     * Bounded rather than length-checked for shape: a stricter rule here would tell
     * an attacker which tokens are worth guessing, and this value is never stored,
     * never logged and never echoed back (`AGENTS.md` 2.13).
     */
    token: z.string().min(1).max(512),

    /** See the header: bounded for transport, judged by the policy rule. */
    password: z.string().min(1).max(TRANSPORT_BODY_LIMIT),

    /** Optional replacement for `User.email`. */
    email: z.string().email().max(320).optional(),

    /** Optional replacement for `User.username`. */
    username: z.string().min(1).max(64).optional(),
  })
  .strict();

export type SetupCompletionBodyShape = z.infer<typeof SetupCompletionBody>;
