import { OidcSignInController } from '../modules/auth/controllers/oidc-sign-in.controller.js';
import { BeginOidcSignIn } from '../modules/auth/use-cases/begin-oidc-sign-in.js';

/**
 * Supply the decorator metadata `tsc` cannot emit for `OidcSignInController`.
 *
 * ## READ THIS BEFORE TRUSTING A TEST THAT USES IT
 *
 * **The deployed API cannot boot.** That is a production fact, not a test
 * artefact and not a limitation of this harness. Measured on 2026-10-03 against
 * the real built `dist/`:
 *
 *     Reflect.getMetadata('design:paramtypes', OidcSignInController)
 *       -> [ Function ]
 *     NestFactory.create(AppModule.forRoot(config))
 *       -> Error: Nest can't resolve dependencies of the OidcSignInController (?)
 *                 Please make sure that the argument Function at index [0] is
 *                 available in the AuthModule module.
 *
 * ### Why the metadata is wrong
 *
 * `oidc-sign-in.controller.ts` declares its single dependency as
 *
 *     import type { BeginOidcSignIn } from '../use-cases/begin-oidc-sign-in.js';
 *
 * An `import type` is erased, so there is no runtime value for
 * `emitDecoratorMetadata` to name. `tsc` falls back to `Function`; SWC falls back
 * to `Object`. Both are unresolvable DI tokens, and Nest's own error message
 * names the cause exactly: "This commonly occurs when using 'import type'
 * instead of 'import' for injectable classes".
 *
 * ### The fix is one word, and it is NOT here
 *
 *     - import type { BeginOidcSignIn } from '../use-cases/begin-oidc-sign-in.js';
 *     + import { BeginOidcSignIn } from '../use-cases/begin-oidc-sign-in.js';
 *
 * That line is in `auth/controllers/`, which another agent was editing
 * concurrently, so this task did not make the change.
 *
 * ## What this function does, and why it is the least-wrong option
 *
 * It writes the metadata **the compiler should have emitted** and nothing else.
 * No controller is duplicated, no handler is re-implemented, no response is
 * faked, no module graph is rewritten. The real controller class, the real
 * handler body, the real `BeginOidcSignIn`, the real `GoogleOidcProvider`, the
 * real `HmacOidcStateStore`, the real `ExpressCookieCarrier`, the real
 * `CsrfGuard`, the real CORS configuration and a real socket all still take part.
 * That is also why `createApp` needs no seam for substituting the module graph —
 * see the note there.
 *
 * ## Two alternatives that were tried and rejected, with the measurement
 *
 * **Registering the controller as a `useFactory` provider.** It reads like the
 * obvious answer and it does not work. `Injector.loadController` resolves a
 * controller against the module's `controllers` collection, never its `providers`
 * collection, so the pre-built instance is simply not consulted — the reflective
 * construction still happens and still throws. An early version of this file
 * shipped that idea and "passed", which is worth recording: the probe controller
 * used in that check had *correct* metadata, so Nest resolved it natively and the
 * repair was never exercised. A fixture that appears to work because the thing it
 * is repairing was never needed is worse than no fixture, and it is the reason
 * this paragraph exists.
 *
 * **Re-declaring `AuthModule`'s providers in a test module.** That is a second
 * description of the application, which drifts, and every route test would then
 * be evidence about a module graph the product does not use.
 *
 * ## What this cannot support
 *
 * Any claim that the deployed route works today. It cannot: the deployed route
 * cannot boot. `oidc-redirect-over-http.spec.ts` asserts that failure separately
 * and directly against the unpatched graph, so this is never the only evidence in
 * that file.
 *
 * ## When to delete this file
 *
 * As soon as the controller imports its dependency as a value. Then `tsc` and SWC
 * both emit `[BeginOidcSignIn]`, `Reflect.defineMetadata` below becomes a no-op
 * restating the truth, and the two tests that assert the defect will fail — which
 * is the signal to delete them at the same time.
 */
export const repairOidcControllerMetadata = (): void => {
  Reflect.defineMetadata('design:paramtypes', [BeginOidcSignIn], OidcSignInController);
};

/** What the compiler emits today, and what it should emit. Read by the specs. */
export const OIDC_CONTROLLER_PARAMTYPES_TODAY = Reflect.getMetadata(
  'design:paramtypes',
  OidcSignInController,
) as unknown[] | undefined;

/**
 * Put back exactly what the compiler emitted.
 *
 * Exists so the "the shipped graph cannot boot" assertion is order-independent:
 * `Reflect.defineMetadata` is process-wide, so a file that repairs the metadata
 * in one test and then asserts the defect in another would silently assert
 * nothing unless it puts the original back. This makes the pair safe in either
 * order, and makes each test leave the module exactly as it found it.
 *
 * Once the controller imports its dependency as a value this becomes a no-op
 * restating the truth, which is the correct behaviour for it to have.
 */
export const restoreOidcControllerMetadata = (): void => {
  Reflect.defineMetadata(
    'design:paramtypes',
    OIDC_CONTROLLER_PARAMTYPES_TODAY,
    OidcSignInController,
  );
};
