/**
 * Reading the current instant.
 *
 * `AGENTS.md` 2.4 forbids `Date.now()`, `new Date()` and `Math.random()`
 * anywhere under `domain/**` or `use-cases/**`, and that rule is enforced by
 * ESLint rather than by convention. It exists because those calls are not
 * injectable: a test of session expiry, licence grace, leave accrual or a
 * hold boundary cannot set the clock, so it either asserts nothing or reaches
 * for a real sleep. Both are worse than an interface.
 *
 * **A port, not a service.** There is no behaviour here to test, which is why
 * the test beside this file exercises a *fake* rather than the production
 * implementation: the fake is the part that carries the contract. The real
 * one is four lines and is covered in `infrastructure/adapters/`.
 *
 * This is the seam `PLT-101` needed and did not have — Google's credential
 * ends at a boundary where EduFlow mints its own session, and a session has
 * an `expiresAt`.
 */
export interface IClock {
  /**
   * The current instant.
   *
   * Returns a **new** `Date` on every call rather than a shared instance. A
   * caller that mutates the returned value would otherwise be mutating the
   * clock, and the next reader would get the moved time. Returning a copy
   * makes "now" read-only by construction instead of by discipline.
   */
  now(): Date;
}

/**
 * The DI token for a clock.
 *
 * ## Why this exists rather than injecting `SystemClock` by class
 *
 * Because `IClock` is an interface, and an interface has no runtime value for Nest
 * to resolve against — the same trap `@Inject` exists to avoid, and the one that
 * made this repository's application fail to boot once. Injecting the concrete
 * `SystemClock` by class works, and it also **binds every consumer to the wall
   clock**, which is the opposite of what the seam is for.
 *
 * That binding is not theoretical. `password-sign-in.controller.spec.ts` built a
 * controller with the real clock while its use-case held a `FakeClock`; the two
 * disagreed by fifteen hours, the cookie TTL came out positive instead of
 * negative, and a test asserting the session's *remaining* lifetime passed for the
 * wrong reason until the clock was injected as a port. A clock seam that cannot be
 * faked at the last point of use is not a seam.
 *
 * `AuthModule` registers `SystemClock` as the implementation of this token.
 */
export const CLOCK = Symbol('IClock');
