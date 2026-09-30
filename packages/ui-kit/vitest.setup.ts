import '@testing-library/jest-dom/vitest';

/**
 * jsdom does not implement `matchMedia`, and `prefers-reduced-motion` and
 * `prefers-color-scheme` are both load-bearing in this package:
 * `AGENTS.md` 3.2.7 requires reduced motion to be honoured, and `ThemeScript`
 * reads `prefers-color-scheme` before first paint.
 *
 * A stub that reports `false` for everything is a trap: it makes a
 * "reduced motion stops the animation" test pass without the media query ever
 * being consulted. The default below is `false`, and tests that need a
 * specific answer set it explicitly.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

/**
 * jsdom implements the Pointer Events *dispatch* API but not the capture
 * methods on `Element`, and `@radix-ui/react-select` calls
 * `target.hasPointerCapture(...)` on every pointerdown to decide whether a
 * click came from a real pointer. Without this shim the Select test dies with
 * `TypeError: target.hasPointerCapture is not a function` as an *unhandled*
 * error - which is worse than a plain failure, because Vitest reports the suite
 * as passing while an exception is in flight.
 *
 * The shim records nothing and asserts nothing. That is deliberate: these tests
 * assert roles, names and keyboard access, not pointer-capture bookkeeping,
 * which Radix's own suite covers. A stub that pretended to capture would only
 * make the tests look thorough.
 *
 * Guarded on `Element` existing, because this setup file also runs for the
 * `node`-environment token suite, which has no DOM at all.
 */
if (typeof Element !== 'undefined') {
  const noop = () => false;

  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = noop;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = noop;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = noop;
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
}
