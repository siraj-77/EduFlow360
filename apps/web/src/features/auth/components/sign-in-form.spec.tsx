import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { messages } from '@eduflow/i18n-resources';
import type { SupportedLocale } from '@eduflow/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SignInForm } from './sign-in-form';

/**
 * The sign-in form, driven the way a person drives it.
 *
 * Rendered with the REAL dictionaries from `@eduflow/i18n-resources`, not a
 * hand-written stub. That is deliberate: the ICU plural in
 * `signIn.refusals.throttled` has six Arabic categories and two Tamil ones, and a
 * stubbed translator would pass a test that the message cannot actually be parsed
 * or rendered - which is the failure mode a translation bug always takes.
 *
 * `fireEvent` rather than `@testing-library/user-event`: the latter is declared
 * in `packages/ui-kit` but not in `apps/web`, and adding it would mean a
 * `pnpm install` that rewrites the shared lockfile. Nothing here needs
 * `user-event`'s pointer-event fidelity - every assertion is about a value, a
 * message or a request - and the keyboard, focus-order and click-on-submit paths
 * are asserted for real in `tests/e2e/sign-in.spec.ts` against Chromium.
 */

const PASSWORD = 'not-a-real-password';

/** `fetch` answering with one canned response, recording every request. */
function stubFetch(response: Response | Error): { calls: RequestInit[] } {
  const calls: RequestInit[] = [];

  vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
    calls.push(init);

    return response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(
          new Response(response.body, {
            status: response.status,
            headers: response.headers,
          }),
        );
  });

  return { calls };
}

function renderForm(locale: SupportedLocale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <SignInForm locale={locale} />
    </NextIntlClientProvider>,
  );
}

/**
 * Interaction locators are by `data-testid`, not by label text.
 *
 * These tests run in four locales, and a label-text locator would either be
 * English-only or need a regex per language - which is exactly how a test suite
 * starts passing for a screen that renders no labels at all. The label
 * ASSOCIATION is asserted explicitly, by label text, in the first test below;
 * everything after that drives the screen through stable hooks.
 */
const identifier = () => screen.getByTestId('sign-in-identifier');
const password = () => screen.getByTestId('sign-in-password') as HTMLInputElement;
const submitButton = () => screen.getByTestId('sign-in-submit');
const message = () => screen.getByTestId('sign-in-form-message');

const type = (field: () => HTMLElement, value: string) =>
  fireEvent.change(field(), { target: { value } });

/** Submit the way the button does, by activating the button itself. */
const submit = () => fireEvent.click(submitButton());

/**
 * Fill both fields and submit.
 *
 * Returns nothing on purpose: the caller knows what it is waiting for, and two
 * of the outcomes here - a 200 and a 400 that named a field - correctly render
 * NO form message. A helper that waited for one would fail against exactly those.
 */
function fillAndSubmit() {
  type(identifier, 'amara@school.lk');
  type(password, PASSWORD);
  submit();
}

/** The outcome every refusal below produces. */
const outcome = () => screen.findByTestId('sign-in-form-message');

/**
 * Flush any pending state update inside `act`.
 *
 * `useSignIn` dispatches twice per attempt - once to mark the form busy, once for
 * the outcome. A test whose assertions all pass on the FIRST of those returns
 * before the second lands, and React then reports an update that happened outside
 * `act`. It is a warning, not a failure, and a suite full of them is a suite
 * nobody reads.
 */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

/**
 * The text a control is described by.
 *
 * `aria-describedby` is a SPACE-SEPARATED list of ids, so it is resolved by
 * splitting it and joining what each id points at. Passing the raw attribute to
 * `getElementById` returns null the moment there is more than one - which is
 * exactly the case that matters, because a described control with an error has
 * both a hint and a message.
 */
function describedTextOf(element: Element): string {
  const ids = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);

  return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
}

let replace: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // jsdom does not implement navigation, and `onSignedIn` calls
  // `window.location.replace`.
  replace = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...window.location, replace, href: 'http://localhost:3500/en/sign-in' },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the rendered form', () => {
  it('labels both controls and describes the identifier field', () => {
    // Asserted BY LABEL TEXT and in English on purpose. A `<label>` whose `for`
    // does not match its control's `id` still renders its text perfectly, so a
    // test that finds the inputs by test id and never checks the association
    // would pass against a form that announces nothing.
    renderForm();

    expect(screen.getByLabelText('Email address or username')).toBe(identifier());
    expect(screen.getByLabelText('Password')).toBe(password());

    // `aria-describedby` is the mechanism, so assert the described TEXT rather
    // than the attribute: the ids are an implementation detail, and an attribute
    // being present proves nothing about what it points at.
    expect(describedTextOf(identifier())).toBe('Use whichever of the two your school issued you.');
  });

  it('gives the password reveal button a name, not just a glyph', () => {
    // Icon-only control: without an accessible name it is unnameable.
    renderForm();

    const reveal = screen.getByRole('button', { name: 'Show password' });
    expect(reveal).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles the reveal between the two named states', () => {
    renderForm();
    expect(password()).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));

    expect(password()).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });

  it('sends the request the API contract describes', async () => {
    // `apps/api`: POST, `x-eduflow-csrf` on every state-changing request, and a
    // body of exactly `identifier` and `password` because the DTO is `.strict()`.
    const { calls } = stubFetch(new Response(JSON.stringify({ signedIn: true }), { status: 200 }));
    renderForm();

    fillAndSubmit();

    await waitFor(() => expect(calls).toHaveLength(1));

    const init = calls[0];
    if (init === undefined) {
      // Unreachable: the waitFor above asserts the length. The
      // guard narrows the type without the non-null assertion
      // the lint config forbids.
      throw new Error('the form did not send a request');
    }
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      identifier: 'amara@school.lk',
      password: PASSWORD,
    });
    expect((init.headers as Record<string, string>)['x-eduflow-csrf']).toBeTruthy();
  });

  it('marks the form busy and its controls disabled while it waits', async () => {
    // `AGENTS.md` 3.2.4: disabled plus a spinner while submitting.
    let release: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );

    renderForm();
    fillAndSubmit();

    const busy = await screen.findByRole('button', { name: /signing in/i });
    await waitFor(() => expect(busy).toBeDisabled());
    expect(identifier()).toBeDisabled();

    release(new Response(JSON.stringify({ signedIn: true }), { status: 200 }));
    await waitFor(() => expect(submitButton()).toBeEnabled());
  });

  it('sends ONE request for a repeated activation of the submit button', async () => {
    // A sign-in is not idempotent: two POSTs spend two of the five attempts
    // `LOGIN_MAX_FAILED_ATTEMPTS` allows, so a double click is a lockout the user
    // did not cause. `disabled` alone does not cover it - a second activation
    // before React commits the disabled state still reaches the handler.
    const { calls } = stubFetch(new Response(null, { status: 401 }));
    renderForm();

    type(identifier, 'amara@school.lk');
    type(password, PASSWORD);
    submit();
    submit();
    submit();

    await waitFor(() => expect(message()).toBeInTheDocument());
    expect(calls).toHaveLength(1);
  });
});

describe('client-side validation', () => {
  it('refuses an empty submit without asking the server', async () => {
    // A 400 from a credential route is a refusal the user cannot tell from a
    // wrong password, so it is worth never generating one.
    const { calls } = stubFetch(new Response(JSON.stringify({ signedIn: true }), { status: 200 }));
    renderForm();

    submit();

    await waitFor(() => expect(calls).toHaveLength(0));
    expect(screen.getByText('Enter your email address or username.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });

  it('marks the offending controls invalid and describes them by the message', async () => {
    // `aria-invalid` for anyone who cannot see the red border, and the message
    // added to `aria-describedby` so it is read after the value rather than
    // replacing it.
    renderForm();

    submit();

    await waitFor(() => expect(identifier()).toHaveAttribute('aria-invalid', 'true'));
    expect(password()).toHaveAttribute('aria-invalid', 'true');

    // The message is ADDED to the hint rather than replacing it, so the
    // description still carries the help text and adds the problem.
    expect(describedTextOf(identifier())).toContain(
      'Use whichever of the two your school issued you.',
    );
    expect(describedTextOf(identifier())).toContain('Enter your email address or username.');
  });

  it('moves focus to the first field that needs changing', async () => {
    renderForm();

    submit();

    await waitFor(() => expect(identifier()).toHaveFocus());
  });

  it('clears a field error as soon as that field is edited, and only that one', async () => {
    renderForm();

    submit();
    await screen.findByText('Enter your password.');

    type(identifier, 'a');

    // The password is still empty, so its message is still true.
    expect(screen.queryByText('Enter your email address or username.')).not.toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });

  it('does not impose a password policy on a password being presented', async () => {
    const { calls } = stubFetch(new Response(JSON.stringify({ signedIn: true }), { status: 200 }));
    renderForm();

    type(identifier, 'amara');
    type(password, 'a');
    submit();

    await waitFor(() => expect(calls).toHaveLength(1));
  });
});

describe('refusals', () => {
  /**
   * The account-enumeration defence, asserted at the only level it can be undone
   * at - the rendered text.
   *
   * The API already serialises every refusal to one frozen body. What could
   * still turn that back into an oracle is this screen rendering two different
   * messages for two different server answers.
   */
  it('shows the same message for a wrong password and for an unknown user', async () => {
    const read = async (payload: unknown) => {
      stubFetch(new Response(JSON.stringify(payload), { status: 401 }));
      const view = renderForm();
      fillAndSubmit();
      const text = (await outcome()).textContent;
      view.unmount();
      return text;
    };

    const wrongPassword = await read({ message: 'That password is wrong.' });
    const noSuchUser = await read({ message: 'No account with that identifier.' });

    expect(wrongPassword).toBe(noSuchUser);
    expect(wrongPassword).toBe('Email or password is incorrect.');
  });

  it('never renders a message the server supplied', async () => {
    // The API's own copy is English, and `AGENTS.md` 2.8 forbids showing a user a
    // string the app cannot translate.
    stubFetch(
      new Response(JSON.stringify({ message: 'Those credentials were not accepted.' }), {
        status: 401,
      }),
    );
    renderForm();

    fillAndSubmit();

    expect((await outcome()).textContent).not.toContain('Those credentials were not accepted.');
  });

  it('moves focus to the message when no single field is at fault', async () => {
    // A screen-reader user who hears "incorrect" with no focus change has been
    // told nothing about where to look next.
    stubFetch(new Response(null, { status: 401 }));
    renderForm();

    fillAndSubmit();

    await waitFor(() => expect(message()).toHaveFocus());
  });

  it('explains a 403 as a refused request rather than a bad credential', async () => {
    // 403 is what `CsrfGuard` returns. It is never the user's fault, so "email or
    // password is incorrect" would send them to retype a password that was never
    // the problem.
    stubFetch(new Response(null, { status: 403 }));
    renderForm();

    fillAndSubmit();

    expect((await outcome()).textContent).toContain('could not be verified');
  });

  it('puts a 400 on the field the API named', async () => {
    stubFetch(
      new Response(JSON.stringify({ fields: ['password'], message: 'Check: password.' }), {
        status: 400,
      }),
    );
    renderForm();

    fillAndSubmit();

    // A 400 that named a field is fully explained by the field's own message, so
    // no form-level banner renders. Waiting for the OUTCOME that does exist - the
    // field's own `aria-invalid` - rather than for a banner is the assertion:
    // a component that always showed a banner would describe neither.
    await waitFor(() => expect(password()).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.queryByTestId('sign-in-form-message')).not.toBeInTheDocument();

    settle();
  });

  it('reports an unreachable server as a connection problem', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    renderForm();

    fillAndSubmit();

    expect((await outcome()).textContent).toContain('could not reach the server');
  });

  it('re-enables the form after a refusal, so a second attempt is possible', async () => {
    stubFetch(new Response(null, { status: 401 }));
    renderForm();

    fillAndSubmit();
    await screen.findByTestId('sign-in-form-message');

    expect(submitButton()).toBeEnabled();
    expect(password()).toBeEnabled();
  });
});

/**
 * The plural rules, in every locale.
 *
 * "Try again in 5 seconds" is not a string this codebase is allowed to assemble:
 * Tamil has two plural categories and Arabic has six, so a concatenated sentence
 * is wrong in at least four of them. The number inside a plural is additionally
 * formatted by the locale - and WHICH digits that produces is a CLDR decision,
 * not an application's: bare `ar` defaults to Latin digits while `ar-EG` uses
 * Arabic-Indic. That is precisely why the app must not choose, and why these
 * tests compare against `Intl.NumberFormat` rather than a literal.
 */
describe('the throttled message exercises the plural rules', () => {
  const renderThrottled = async (locale: SupportedLocale, retryAfter: string) => {
    stubFetch(new Response(null, { status: 429, headers: { 'Retry-After': retryAfter } }));

    // Unmounted explicitly: RTL's automatic cleanup runs between TESTS, not
    // between renders inside one, and four renders of the same testid in one
    // document makes every later query ambiguous.
    const view = renderForm(locale);
    fillAndSubmit();
    const text = (await outcome()).textContent ?? '';
    view.unmount();

    return text;
  };

  it('uses the singular for one second', async () => {
    expect(await renderThrottled('en', '1')).toContain('Try again in 1 second.');
  });

  it('uses the plural for more', async () => {
    expect(await renderThrottled('en', '5')).toContain('Try again in 5 seconds.');
  });

  it('renders a Tamil count with its own plural form', async () => {
    const one = await renderThrottled('ta', '1');
    const many = await renderThrottled('ta', '5');

    expect(one).not.toBe(many);
    expect(many).toContain('5');
  });

  it('renders Arabic plural categories with the locale own number formatting', async () => {
    const one = await renderThrottled('ar', '1');
    const two = await renderThrottled('ar', '2');
    const few = await renderThrottled('ar', '3');
    const many = await renderThrottled('ar', '11');

    // Arabic has six categories, so one/two/few/many must be four distinct
    // sentences. A component that concatenated the number would produce the same
    // string four times, and this is the assertion that notices.
    expect(new Set([one, two, few, many]).size).toBe(4);

    // Compared against `Intl`, not a literal. Bare `ar` renders Latin digits
    // (`Intl.NumberFormat('ar-EG')` renders `٣`), and the correct behaviour is
    // whatever the locale says - not whatever this test hard-codes.
    expect(few).toContain(new Intl.NumberFormat('ar').format(3));
    expect(many).toContain(new Intl.NumberFormat('ar').format(11));
  });

  it('renders Tamil and Sinhala counts through the same mechanism', async () => {
    // One and many must differ in both, or a locale is shipping a single plural
    // form for every count.
    for (const locale of ['ta', 'si'] as const) {
      const one = await renderThrottled(locale, '1');
      const many = await renderThrottled(locale, '7');

      expect(one, `${locale} renders one and many identically`).not.toBe(many);
      expect(many).toContain(new Intl.NumberFormat(locale).format(7));
    }
  });
});

describe('success', () => {
  it('announces the sign-in for assistive technology before navigating', async () => {
    // A silent navigation is a sign-in a screen-reader user cannot confirm. The
    // status region is polite so it does not steal focus from the redirect.
    stubFetch(new Response(JSON.stringify({ signedIn: true }), { status: 200 }));
    renderForm();

    fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Signed in. Taking you to your dashboard.',
      ),
    );
    // The interim authenticated landing, not the public landing page: a
    // school that just signed in must not be bounced to a page that behaves
    // as though nothing happened. Replaced by the app shell when it lands
    // (`PLT-EPIC-10`), and `replace` keeps the sign-in page out of history
    // with its submitted password still in the DOM.
    expect(replace).toHaveBeenCalledWith('/en/signed-in');
  });

  it('returns the caller to the route the console guard carried in `next`', async () => {
    // `PLT-1002` AC-1, the half that makes the redirect a round trip: an
    // anonymous caller to /en/admin is sent to sign-in with
    // `?next=%2Fen%2Fadmin`, and the password check must land them THERE.
    // Landing on the interim screen instead would strand them one click
    // short of the console they asked for.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...window.location,
        replace,
        href: 'http://localhost:3500/en/sign-in?next=%2Fen%2Fadmin',
        search: '?next=%2Fen%2Fadmin',
      },
    });

    stubFetch(new Response(JSON.stringify({ signedIn: true }), { status: 200 }));
    renderForm();

    fillAndSubmit();

    // The status region, not the form message: a successful sign-in
    // renders no form message by design, and this is the announcement the
    // screen makes instead.
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Signed in. Taking you to your dashboard.',
      ),
    );

    expect(replace).toHaveBeenCalledWith('/en/admin');
  });

  it('ignores a `next` pointing at another origin, and lands on the default', async () => {
    // The parameter is attacker-controllable — the guard echoes it into the
    // URL, and anyone can type the URL by hand. `safeNextPath` is the whole
    // answer, and this is its proof from the form's side: an absolute URL is
    // dropped rather than honoured, and the caller lands somewhere this app
    // actually serves.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...window.location,
        replace,
        href: 'http://localhost:3500/en/sign-in?next=https%3A%2F%2Fevil.example',
        search: '?next=https%3A%2F%2Fevil.example',
      },
    });

    stubFetch(new Response(JSON.stringify({ signedIn: true }), { status: 200 }));
    renderForm();

    fillAndSubmit();
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Signed in. Taking you to your dashboard.',
      ),
    );

    expect(replace).toHaveBeenCalledWith('/en/signed-in');
    expect(replace).not.toHaveBeenCalledWith('https://evil.example');
  });

  it('leaves no trace of the password in the DOM, even as an attribute', async () => {
    // `AGENTS.md` 2.13. The field masks the value on screen, and `type="password"`
    // keeps it out of anything a person reads - but React writes a CONTROLLED
    // input's value into the DOM as an attribute, which puts the plaintext in
    // `document.documentElement.outerHTML`, in a DOM snapshot and in
    // `page.content()`. The inputs are deliberately uncontrolled so it is not
    // there at all. This assertion is the reason.
    stubFetch(new Response(null, { status: 401 }));
    const { container } = renderForm();

    fillAndSubmit();

    // Let the refusal land first. The assertions are about the DOM as it is
    // AFTER a submit, and reading synchronously would read it while the fetch is
    // still in flight - a different document from the one a user would see.
    await outcome();

    expect(container.innerHTML).not.toContain(PASSWORD);
    expect(document.body.innerHTML).not.toContain(PASSWORD);
    // The DOM PROPERTY still holds it, which is unavoidable and is not a leak:
    // a script already on the page can read `.value` regardless.
    expect(password().value).toBe(PASSWORD);
  });

  it('never puts the password in the URL', async () => {
    // The form is `method="post"` with no `action` and unnamed inputs, so even a
    // submission that escaped the JavaScript could not put the credential in the
    // query string, in history or in an access log.
    stubFetch(new Response(null, { status: 401 }));
    const { container } = renderForm();

    fillAndSubmit();

    const form = container.querySelector('form');
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBeNull();
    expect(container.querySelector('input[name]')).toBeNull();
    expect(window.location.href).not.toContain(PASSWORD);

    // Let the refusal land before the test ends. Otherwise the state update from
    // the resolved `fetch` happens after teardown and React reports an unwrapped
    // update - a warning that is really about the test ending mid-flight.
    await outcome();
  });
});
