import '@testing-library/jest-dom/vitest';

/**
 * JSDOM does not implement matchMedia, which ThemeScript reads. Without
 * this stub, any test that renders the layout throws rather than testing
 * anything.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
