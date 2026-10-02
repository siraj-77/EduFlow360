import { type IClock } from '../modules/auth/domain/ports/clock.js';

/**
 * A clock the test drives.
 *
 * It lives here, outside `domain/`, and that placement is not cosmetic.
 * `AGENTS.md` 2.4 and the ESLint rule that enforces it ban `new Date()`
 * anywhere under `domain/` or `use-cases/`, and a clock fake has to construct
 * instants to be a fake at all. Putting it in `src/testing/` keeps the rule
 * absolute rather than punching a test-shaped hole in it.
 *
 * It also means every use-case spec gets the same double, so a test that
 * freezes time does it the same way everywhere.
 */
export class FakeClock implements IClock {
  private current: Date;

  constructor(at: Date | string) {
    this.current = typeof at === 'string' ? new Date(at) : new Date(at.getTime());
  }

  now(): Date {
    // A copy, never the instance. The port promises a fresh object per call,
    // and a fake that quietly violated its own port would be the worst
    // possible place for that to hide.
    return new Date(this.current.getTime());
  }

  /** Move time forward. Negative values go backwards, which some tests need. */
  advance(ms: number): this {
    this.current = new Date(this.current.getTime() + ms);
    return this;
  }

  /** Jump to an absolute instant. */
  set(at: Date | string): this {
    this.current = typeof at === 'string' ? new Date(at) : new Date(at.getTime());
    return this;
  }
}
