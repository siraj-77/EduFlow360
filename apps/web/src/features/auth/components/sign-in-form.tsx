'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, EyeIcon, EyeOffIcon, Input, Spinner } from '@eduflow/ui-kit';

import { CredentialField } from './credential-field';
import { AuthAlert } from './auth-alert';
import { focusTargetFor, useSignIn } from '../hooks/use-sign-in';
import { safeNextPath } from '@/lib/safe-next-path';

/**
 * The sign-in form.
 *
 * ## Layout is stacked, and that is a translation decision
 *
 * Labels sit ABOVE their controls. Side-by-side is the desktop default and it is
 * wrong here for three reasons: Tamil and Sinhala labels are long enough that a
 * fixed label column either wraps or forces a ragged baseline, Arabic mirrors the
 * pair so the label lands where the eye arrives second, and a phone at 320px has
 * no room for two columns at all. Stacking costs one line of vertical space and
 * is correct in all four locales and at every width.
 *
 * ## What the form deliberately does not have
 *
 * **No "Remember me".** `PasswordSignInBody` is `.strict()` and accepts exactly
 * `identifier` and `password`, so a third field is a 400 - and a 400 on a sign-in
 * form is indistinguishable from wrong credentials to the person in front of it.
 * The approved template (`docs/template/EduFlow360_Template_Landing_Auth.html`)
 * carries a "Remember me" checkbox, and this screen does not reproduce it: the
 * API has no persistent-session toggle for the checkbox to mean, and a control
 * that does nothing is worse than a control that is absent. `auth.rememberMe`
 * exists in the dictionaries and is not rendered here; the omission is
 * recorded rather than worked around.
 *
 * **"Forgot your password?" is here now.** The route it links to shipped with
 * `PLT-105` T1/T2, so the link is real rather than a 404 on the front door.
 * The template's position (a link row beside the password field) is kept.
 *
 * **No `name` on the inputs.** See the header in `hooks/use-sign-in.ts`.
 *
 * ## `method="post"` and no `action`
 *
 * A `<form>` defaults to `GET` to the current URL. If this component's JavaScript
 * ever failed to load - a chunk 404, a blocked script, a slow phone - the browser
 * would navigate to `/en/sign-in?identifier=...&password=...`, putting the
 * credential in the URL, in history, in the server's access log and in any
 * screenshot of the address bar. `method="post"` with no `action` sends the same
 * bytes to the same URL as a body instead, where none of those four places see
 * them. The inputs have no `name`, so even that sends nothing at all.
 */
export function SignInForm({ locale }: { readonly locale: string }) {
  /**
   * Root-scoped on purpose. Every message key this screen shows is an absolute
   * dotted path - `signIn.refusals.csrf`, `auth.invalidCredentials`,
   * `errors.serverError` - because they come from three namespaces. Inventing a
   * second convention to unify them would put the mapping in a file that exists
   * only to translate keys.
   */
  const t = useTranslations();

  const onSignedIn = () => {
    // `replace`, not `push`: the sign-in page must not survive in history with a
    // submitted password still in its DOM, and Back must not be able to resubmit
    // it.
    //
    // The destination is the `next` parameter when there is one (`PLT-1002`:
    // the console's guard redirects an anonymous caller here carrying the
    // route they asked for), and the interim authenticated landing otherwise.
    // `safeNextPath` is the whole open-redirect answer: the parameter is
    // attacker-controllable, so an absolute or protocol-relative value is
    // dropped rather than honoured.
    const requested =
      typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('next');
    const destination = safeNextPath(requested, `/${locale}/signed-in`);

    window.location.replace(destination);
  };

  const { state, submit: send, edit } = useSignIn({ onSignedIn });

  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  /**
   * The credentials come from the DOM, not from React state.
   *
   * A controlled input makes React write `value` into the DOM as an ATTRIBUTE, so
   * the plaintext password ends up in `document.documentElement.outerHTML` - in a
   * DOM snapshot, in an extension's read, in `page.content()` in a test. The field
   * masks it on screen and nothing else does, but "not in the URL, not in
   * storage, not in a log" is a much weaker statement than it looks when the
   * value is also in the markup. Letting the DOM own both values removes it.
   *
   * The cost is that this cannot clear the field programmatically, which this
   * form has no reason to do: a refused sign-in must not throw away what the user
   * typed.
   */
  const submit = () => {
    send({
      identifier: identifierRef.current?.value ?? '',
      password: passwordRef.current?.value ?? '',
    });
  };

  const [passwordVisible, setPasswordVisible] = useState(false);
  const submitting = state.phase === 'submitting';

  /**
   * Focus after a refusal, and only after one.
   *
   * Guarded by a ref holding the previous outcome signature rather than by an
   * effect dependency, because the effect has to re-run when the *refusal*
   * changes - two different 401s are the same state shape, and a dependency on
   * `state` alone would fire once and then never again. Editing a field does
   * change `state`, so the signature is what stops focus being yanked back to a
   * field the user is currently typing in.
   */
  const lastOutcome = useRef<string | null>(null);
  const outcomeSignature = `${state.phase}|${state.formMessageKey ?? ''}|${
    state.fieldErrors.identifier === undefined ? '' : 'i'
  }${state.fieldErrors.password === undefined ? '' : 'p'}`;

  useEffect(() => {
    if (submitting) return;
    if (outcomeSignature === lastOutcome.current) return;

    lastOutcome.current = outcomeSignature;

    const target = focusTargetFor(state);

    if (target === 'identifier') identifierRef.current?.focus();
    else if (target === 'password') passwordRef.current?.focus();
    else if (target === 'message') messageRef.current?.focus();
  }, [outcomeSignature, state, submitting]);

  const identifierError = translateKey(state.fieldErrors.identifier, t);
  const passwordError = translateKey(state.fieldErrors.password, t);
  const formMessage = translateRefusal(state, t);

  return (
    <form
      method="post"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      aria-busy={submitting}
      className="flex flex-col gap-5"
    >
      <CredentialField
        id="sign-in-identifier"
        label={t('signIn.identifierLabel')}
        hint={t('signIn.identifierHint')}
        error={identifierError}
      >
        {(control) => (
          <Input
            {...control}
            ref={identifierRef}
            data-testid="sign-in-identifier"
            onChange={() => edit('identifier')}
            disabled={submitting}
            // The value is an email address OR a username, never required to look
            // like either, and the API's DTO says exactly that. `type="email"`
            // would put a browser-native validity error on a perfectly valid
            // username, in a language this app does not control, on a field
            // `noValidate` has already told the browser to leave alone.
            // `inputMode` gives the right on-screen keyboard without claiming a
            // format.
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            // 16px, not the inherited 14px: iOS Safari zooms the viewport on any
            // text field below 16px and does not zoom back out, so a 14px input
            // is a phone user who cannot read the page they just zoomed into.
            className="text-base"
            /**
             * The value is LTR even inside an RTL form. An email address and a
             * username are both left-to-right strings, and inheriting
             * `dir="rtl"` from `<html>` right-aligns them and puts the `@` and the
             * TLD on the wrong end. Set on the CONTROL, not on the field, so the
             * label, the hint and the error stay in the page's reading direction.
             */
            dir="ltr"
          />
        )}
      </CredentialField>

      <CredentialField
        id="sign-in-password"
        label={t('auth.password')}
        hint={null}
        error={passwordError}
      >
        {(control) => (
          <div className="relative">
            <Input
              {...control}
              ref={passwordRef}
              data-testid="sign-in-password"
              type={passwordVisible ? 'text' : 'password'}
              onChange={() => edit('password')}
              disabled={submitting}
              autoComplete="current-password"
              spellCheck={false}
              maxLength={1024}
              // `pe-14` clears the reveal button on the END side. `pe` is logical,
              // so the padding moves to the left in Arabic and the button stays on
              // the side the caret finishes on.
              className="text-base pe-14"
              dir="ltr"
            />
            <Button
              type="button"
              variant="ghost"
              // Icon-only, so the accessible name is mandatory and the visible
              // glyph is not it - `baseline-ui` requires an aria-label here, and
              // `AGENTS.md` 3.2.2 puts a 44px floor on the target.
              aria-label={passwordVisible ? t('signIn.hidePassword') : t('signIn.showPassword')}
              aria-pressed={passwordVisible}
              onClick={() => setPasswordVisible((visible) => !visible)}
              disabled={submitting}
              // `end-1.5` is logical, so the button sits on the right in English
              // and the left in Arabic, beside the caret rather than against it.
              className="absolute end-1.5 top-1/2 size-11 -translate-y-1/2 p-0 text-muted"
            >
              {passwordVisible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </Button>
          </div>
        )}
      </CredentialField>

      <div className="flex items-center justify-between gap-3">
        {/*
          The template's "row-between": only the forgot-password link is real
          today (see the header for why remember-me is not). The row keeps the
          template's structure so adding the toggle back is one element, not a
          re-layout.
        */}
        <a
          href={`/${locale}/sign-in/forgot`}
          className="text-sm font-medium text-brand hover:underline"
          data-testid="sign-in-forgot-link"
        >
          {t('auth.forgotPassword')}
        </a>
      </div>

      {/*
        The form-level message, in the template's `.alert` slot.

        `AuthAlert` owns the styling, the `role="alert"` and the polite/
        assertive split, because the template carries ONE `.alert` rule shared
        by all three auth screens and a shared style belongs in one place —
        see the component's own header. What this screen still owns is the
        behaviour the slot cannot: `tabIndex={-1}` and the ref, so the
        focus-after-refusal effect above can move focus here when the message
        is the only thing wrong.
      */}
      {formMessage === null ? null : (
        <AuthAlert ref={messageRef} tone="error" testId="sign-in-form-message" tabIndex={-1}>
          {formMessage}
        </AuthAlert>
      )}

      <Button
        type="submit"
        variant="brand"
        data-testid="sign-in-submit"
        disabled={submitting}
        className="w-full"
      >
        {submitting ? (
          <>
            <Spinner className="size-4" />
            {t('signIn.submitting')}
          </>
        ) : (
          t('signIn.submit')
        )}
      </Button>

      {/*
        The success announcement. It exists because a sign-in that navigates
        silently is a sign-in a screen-reader user cannot confirm: `role="status"`
        is polite, so it is announced without stealing focus - the right priority
        for a message the user is about to be navigated past.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {state.signedIn ? t('signIn.signedIn') : ''}
      </p>
    </form>
  );
}

type Translate = (key: string) => string;

/** A field error key to text. `null` is a valid field and is not an error. */
function translateKey(key: string | undefined, t: Translate): string | null {
  return key === undefined ? null : t(key);
}

/**
 * The message for something that is not one field's fault.
 *
 * The throttled case is the only one with a value, and it is passed as
 * `{ seconds }` so the ICU plural in the message chooses the form. That is the
 * whole reason the message is a message and not a template this file fills in:
 * Arabic has six plural categories and Tamil has two, and concatenating
 * "Try again in " + n + " seconds" here would get all six wrong.
 */
function translateRefusal(
  state: { readonly formMessageKey: string | null; readonly retryAfterSeconds: number | null },
  t: Translate,
): string | null {
  const { formMessageKey, retryAfterSeconds } = state;

  if (formMessageKey === null) return null;

  return retryAfterSeconds === null
    ? t(formMessageKey)
    : (t as unknown as (key: string, values: { seconds: number }) => string)(formMessageKey, {
        seconds: retryAfterSeconds,
      });
}
