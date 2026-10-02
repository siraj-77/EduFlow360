import { Injectable } from '@nestjs/common';
import { type IClock } from '../../domain/ports/clock.js';

/**
 * The production clock.
 *
 * `Date.now()` appears here on purpose, and it is the ONLY place in the API
 * where it is allowed to be. The ESLint rule that bans it is scoped to the
 * `domain/` and `use-cases/` folders precisely so that one adapter can reach
 * for ambient time and everything inward of it has to ask.
 *
 * (Those folder globs are written out in words rather than as
 * star-slash-star patterns: `star star slash` contains a comment terminator,
 * and writing it inside a block comment ends the comment early. That is not
 * hypothetical. It cost an afternoon once already, in a different file.)
 *
 * That is the whole design: a rule with no exception is unsatisfiable, and a
 * rule with exceptions everywhere is decoration. One permitted site is a
 * seam, not a loophole.
 *
 * Returns a new `Date` each call because `IClock` promises a copy - see the
 * port for why a shared instance would let any caller move the clock.
 */
@Injectable()
export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}
