import swc from 'unplugin-swc';

/**
 * The SWC transform Vitest uses instead of esbuild, for every `apps/api` suite.
 *
 * ## Why this file exists at all
 *
 * **esbuild does not implement `emitDecoratorMetadata`.** Vitest transforms with
 * esbuild by default, so under the stock configuration
 * `Reflect.getMetadata('design:paramtypes', SomeClass)` is `undefined` for every
 * decorated class in `apps/api`. `nest build` uses `tsc`, which does emit it, so
 * the production artifact in `dist/` is correct and the gap was test-only.
 *
 * ## What that gap actually did, measured 2026-10-03 — and why it is worse
 * than a build failure
 *
 * The obvious assumption is "Nest cannot resolve anything, so container builds
 * fail loudly". **That is not what happens.** A class whose constructor takes
 * dependencies is instantiated with **`undefined` for each of them**, with no
 * error anywhere. Measured on the real application, without this transform:
 *
 *     app.init()                                     -> succeeds
 *     app.get(OidcSignInController)                  -> succeeds
 *     controller.beginSignIn                         -> undefined
 *     controller.begin(response)                     -> TypeError:
 *                                                       Cannot read properties of undefined (reading 'begin')
 *
 * So the route answers 500 and the container reports itself healthy. A test that
 * only asserted "the container compiled" would have been green over a controller
 * that could not work. `nest-dependency-injection.spec.ts` asserts the
 * *injected value*, not the compile, for exactly this reason — and
 * `oidc-redirect-over-http.spec.ts` asserts the response, which is the only
 * level at which this class of defect is visible at all.
 *
 * ## Why these packages, and what was rejected
 *
 * **`unplugin-swc` + `@swc/core`.** SWC is the only widely-used transformer that
 * implements `emitDecoratorMetadata`; esbuild has said it will not, and `tsc` is
 * not a Vite plugin. Between the SWC *bindings* and the SWC *Vite plugin* there
 * is a choice, and the alternatives were:
 *
 * - **A hand-written Vite plugin calling `@swc/core`'s `transformSync`
 *   directly.** One fewer package, but it means owning ~40 lines of build
 *   configuration that can be wrong in ways that produce a subtly broken
 *   transform rather than an error. Rejected: the bug this file exists to close
 *   is a *silent* one, so the transform should be maintained code.
 * - **`@swc/wasm`.** No native binary, so nothing to approve in
 *   `pnpm-workspace.yaml`. Rejected as the primary because it is materially
 *   slower on every transform and the native binary turned out to need no build
 *   approval anyway (see below).
 *
 * ## The options are INFERRED from `tsconfig.json`, deliberately
 *
 * `unplugin-swc` reads `experimentalDecorators` and `emitDecoratorMetadata` out
 * of `apps/api/tsconfig.json` and sets `jsc.parser.decorators`,
 * `jsc.transform.legacyDecorator`, `jsc.transform.decoratorMetadata` and
 * `jsc.keepClassNames` to match. No `jsc` block is passed here on purpose.
 *
 * The alternative — spelling the four options out in this file — creates a
 * second source of truth for a security-relevant setting. `tsconfig.json` would
 * remain the thing a developer edits, this file would remain the thing that
 * silently disagreed with it, and the two would differ only in the case that
 * matters. `nest-dependency-injection.spec.ts` is the tripwire for the
 * disagreement, so a single source of truth plus an assertion beats two sources
 * and a comment.
 *
 * `unplugin-swc` reads only `compilerOptions`, not `include`/`exclude`. That
 * matters: `apps/api/tsconfig.json` excludes `*.spec.ts`, and a tsconfig-honouring
 * transform would leave every spec file without metadata — which is the state
 * this file exists to end.
 *
 * ## There is deliberately NO `.swcrc`
 *
 * An `.swcrc` in `apps/api` would be inert for the production build (`nest build`
 * uses `tsc`) while looking authoritative to the next reader — the same trap
 * `pnpm-workspace.yaml` documents for the inert `onlyBuiltDependencies` key: "a
 * key that reads back correctly and does nothing is worse than a key that is
 * absent". Every option this transform needs is inferred from a file that *is*
 * the build's source of truth, so there is nothing for a second file to hold.
 *
 * ## `@swc/core`'s install script is DENIED, and the transform works anyway
 *
 * `pnpm-workspace.yaml` carries `'@swc/core': false`. `@swc/core` has a
 * `postinstall`, pnpm 11 blocks unlisted build scripts, and allowing it would
 * have been a second owner-approval question for a script that turns out to be
 * unnecessary: the native binding arrives as a platform-specific
 * **optional dependency** (`@swc/core-win32-x64-msvc` and siblings), which pnpm
 * installs regardless. Verified by transform probe — `design:paramtypes` is
 * emitted with the postinstall denied. Denying it keeps the supply-chain
 * allow-list exactly as tight as it was before this file existed.
 */

/**
 * `unplugin-swc` exports one factory with per-bundler methods. `vite()` is the
 * Vite-shaped plugin, which is what both `vitest.config.ts` and
 * `vitest.integration.config.ts` consume.
 *
 * Returned as a function so a config calls `swcPlugin()` rather than sharing one
 * plugin *instance* across two `defineConfig` calls. Vite plugin objects carry
 * per-build state; a shared instance across two runners in one process is the
 * kind of cross-contamination that only shows up when both run.
 */
export const swcPlugin = () => swc.vite();
