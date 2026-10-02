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
