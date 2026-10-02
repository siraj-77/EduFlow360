/**
 * Constructing a fixed instant.
 *
 * `AGENTS.md` 2.4 and its ESLint rule ban `new Date()` anywhere under
 * `domain/` or `use-cases/`. The rule is absolute on purpose — a guard with
 * an exception shaped exactly like the tests is a guard that gets widened.
 *
 * A test table full of fixed timestamps still needs to make `Date` objects.
 * So they are made here, one function, in the test-support folder alongside
 * `FakeClock`, for the same reason that one is not under `domain/`.
 *
 * `Date.parse` alone would return a number and every call site would need a
 * cast. This returns a real `Date`, so nothing is lying about its type.
 */
export const instant = (iso: string): Date => new Date(iso);

/** `now`-relative, for the common "N minutes ago" shape in test tables. */
export const minutesAgo = (minutes: number, from: Date = new Date()): Date =>
  new Date(from.getTime() - minutes * 60_000);
