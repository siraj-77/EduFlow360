import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { messages } from '@eduflow/i18n-resources';
import type { SupportedLocale } from '@eduflow/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PermissionGate } from './permission-gate';
import { PermissionsProvider } from '../hooks/use-permissions';

/**
 * The permission gate.
 *
 * What is being proved:
 *
 * 1. **The gate renders children only for a granted key.**
 *    The set comes from the API, so the test stubs the
 *    fetch and asserts the rendered output - not that a
 *    function was called.
 *
 * 2. **The fallback is what renders when the key is absent,
 *    and `null` is the default.** A gate that rendered
 *    children for an ungranted key would be a client-side
 *    grant, which is the failure mode this component
 *    exists to prevent.
 *
 * 3. **Fail-closed.** While the request is in flight, and
 *    after any refusal, the gate renders the fallback. The
 *    assertions below cover the in-flight case; the refusal
 *    cases are the hook's, and the gate inherits them by
 *    construction - which is why there is no 403 test here
 *    and there is a loading one.
 */

/** `fetch` answering with one canned response. */
function stubFetch(response: Response | Error): void {
  vi.stubGlobal('fetch', (_url: string, _init: RequestInit) =>
    response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve(
          new Response(response.body, {
            status: response.status,
            headers: response.headers,
          }),
        ),
  );
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Renders the gate inside a provider that answers with the given set. */
function renderGate({
  permission = 'PLATFORM_MODULE_MANAGE',
  fallback,
  locale = 'en',
}: {
  readonly permission?: string;
  readonly fallback?: React.ReactNode;
  readonly locale?: SupportedLocale;
} = {}) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <PermissionsProvider>
        <PermissionGate permission={permission} fallback={fallback}>
          <p data-testid="gated">The thing being gated.</p>
        </PermissionGate>
      </PermissionsProvider>
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PermissionGate', () => {
  it('renders the children when the caller holds the key', async () => {
    stubFetch(jsonResponse({ permissions: ['PLATFORM_MODULE_MANAGE'] }));

    renderGate();

    await waitFor(() => expect(screen.getByTestId('gated')).toBeInTheDocument());
  });

  it('renders nothing when the caller does not hold the key', async () => {
    // The default fallback is null: a feature the caller's
    // roles do not grant is not theirs to be teased with.
    stubFetch(jsonResponse({ permissions: ['PERMISSION_READ_OWN'] }));

    renderGate();

    await waitFor(() => expect(screen.queryByTestId('gated')).not.toBeInTheDocument());
  });

  it('renders the fallback when one is given', async () => {
    stubFetch(jsonResponse({ permissions: ['PERMISSION_READ_OWN'] }));

    renderGate({
      fallback: <p data-testid="locked">Ask your administrator.</p>,
    });

    await waitFor(() => expect(screen.getByTestId('locked')).toBeInTheDocument());
    expect(screen.queryByTestId('gated')).not.toBeInTheDocument();
  });

  it('renders the fallback while the request is in flight', async () => {
    // Fail-closed: a gate that could not prove a grant does
    // not render one. The pending fetch is never released,
    // so the gate stays in the loading phase for the whole
    // test.
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );

    renderGate({
      fallback: <p data-testid="locked">Ask your administrator.</p>,
    });

    expect(screen.getByTestId('locked')).toBeInTheDocument();
    expect(screen.queryByTestId('gated')).not.toBeInTheDocument();

    // Releasing after the assertion proves the gate was
    // waiting on the answer, not on the render.
    release(jsonResponse({ permissions: ['PLATFORM_MODULE_MANAGE'] }));
    await waitFor(() => expect(screen.getByTestId('gated')).toBeInTheDocument());
  });

  it('renders the fallback after a refused read', async () => {
    // 403: the set could not be read, so nothing may be
    // granted. The gate inherits the hook's fail-closed
    // answer.
    stubFetch(new Response(null, { status: 403 }));

    renderGate({
      fallback: <p data-testid="locked">Ask your administrator.</p>,
    });

    await waitFor(() => expect(screen.getByTestId('locked')).toBeInTheDocument());
  });

  it('gates on the key it was given, not on any key', async () => {
    // A gate for key A must not open on key B. The set
    // holds B and not A, and the gate asks for A.
    stubFetch(jsonResponse({ permissions: ['STUDENTS_READ'] }));

    renderGate({ permission: 'STUDENTS_WRITE' });

    await waitFor(() => expect(screen.queryByTestId('gated')).not.toBeInTheDocument());
  });

  it('renders the same decision in every locale it ships in', async () => {
    // The gate's decision is not a message, but the
    // fallback is, and a gate that broke in one locale
    // would break the whole school's UI in that language.
    const locales: SupportedLocale[] = ['en', 'ta', 'si', 'ar'];

    for (const locale of locales) {
      stubFetch(jsonResponse({ permissions: ['PLATFORM_MODULE_MANAGE'] }));

      const view = renderGate({ locale });

      await waitFor(() => expect(screen.getByTestId('gated')).toBeInTheDocument());

      view.unmount();
    }
  });
});
