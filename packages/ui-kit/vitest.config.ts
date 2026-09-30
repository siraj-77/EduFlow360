import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * ui-kit test config.
 *
 * `environment` stays `node` on purpose. The pre-existing `src/index.spec.ts`
 * reads the token file with `readFileSync(new URL('./styles.css',
 * import.meta.url))`, and under jsdom `import.meta.url` is an `http://` URL
 * rather than a `file://` one, so `readFileSync` throws "The URL must be of
 * scheme file" for all six of its token assertions. That suite passed before
 * B-1 and is not being changed to accommodate a new one.
 *
 * The component suite opts into jsdom with a `@vitest-environment jsdom`
 * docblock instead, which keeps the DOM scoped to the tests that render
 * something. The alternative - a second Vitest project - was rejected as more
 * machinery than one file's worth of difference.
 *
 * `jsdom` and `@testing-library/react` are declared here rather than assumed
 * from a consumer: pnpm's isolated node_modules means a package can only import
 * what it declares itself.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
