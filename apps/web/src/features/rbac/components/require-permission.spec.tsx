import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { messages } from '@eduflow/i18n-resources';
import type { SupportedLocale } from '@eduflow/shared-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequirePermission } from './require-permission';
import { PermissionsProvider } from '../hooks/use-permissions';

/**
 * The route wrapper.
 *
 * What is being proved:
 *
 * 1. **The three answers are three.** Loading renders
 *    a skeleton; ready-and-permitted renders the
 *    children; ready-and-not-permitted redirects to
 *    the forbidden page. A wrapper that rendered the
 *    children for an ungranted key would be a
 *    client-side grant, which is the failure mode
 *    this component exists to prevent.
 *
 * 2. **The redirect replaces, and is locale-aware.**
 *    `replace` keeps the restricted route out of
 *    history, and the path carries the locale the
 *    provider was given - `/ar/forbidden`, not
 *    `/en/forbidden` for an Arabic visitor.
 *
 * 3. **Error renders nothing and redirects nowhere.**
 *    There is no safe destination when the set could
 *    not be read, so the wrapper stays put. This is
 *    the fail-closed answer, and it is asserted
 *    rather than assumed.
 *
 * `next/navigation`'s router is mocked because jsdom
 * has no Next.js router; the mock records the
 * destination so the test asserts where the caller
 * was sent, not that a function was called.
 */

const routerMock = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

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

/** A `fetch` that stays pending until the test releases it. */
function stubPendingFetch(): {
  release: (response: Response) => void;
} {
  let release: (response: Response) => void = () => undefined;

  vi.stubGlobal(
    'fetch',
    () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );

  return { release: (response) => release(response) };
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Renders the wrapper around gated content, in a chosen locale. */
function renderRequired({
  locale = 'en',
  permission = 'STUDENTS_READ',
}: {
  readonly locale?: SupportedLocale;
  readonly permission?: string;
} = {}) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <PermissionsProvider>
        <RequirePermission permission={permission}>
          <p data-testid="protected">The protected content.</p>
        </RequirePermission>
      </PermissionsProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  routerMock.replace.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RequirePermission', () => {
  it('renders a skeleton while the permission set is unread', () => {
    // The set has not been read, so nothing is
    // claimed either way. A skeleton, not a denial
    // and not the content.
    stubPendingFetch();

    renderRequired();

    expect(screen.getByTestId('permission-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('renders the children when the caller holds the key', async () => {
    stubFetch(jsonResponse({ permissions: ['STUDENTS_READ'] }));

    renderRequired();

    await waitFor(() => expect(screen.getByTestId('protected')).toBeInTheDocument());
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('redirects to the forbidden page when the key is not granted', async () => {
    // The set was read, and it does not hold the key.
    // The route is not the caller's to see.
    stubFetch(jsonResponse({ permissions: ['PERMISSION_READ_OWN'] }));

    renderRequired();

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/en/forbidden'));
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  it('redirects to sign in when there is no session', async () => {
    // 401 means no session at all, which is a
    // different problem from a refusal and is
    // answered by signing in, not by a forbidden page.
    stubFetch(new Response(null, { status: 401 }));

    renderRequired();

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/en/sign-in'));
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  it('renders nothing and redirects nowhere when the read was refused', async () => {
    // 403: the set could not be read. There is no
    // safe destination - the content would be a
    // grant, the forbidden page would be a policy
    // decision the API never made, and sign-in
    // would be a lie about why. Stay put, show
    // nothing.
    stubFetch(new Response(null, { status: 403 }));

    renderRequired();

    await waitFor(() => expect(screen.queryByTestId('permission-loading')).not.toBeInTheDocument());

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('renders nothing and redirects nowhere when the server is unreachable', async () => {
    // The same fail-closed answer for a network
    // failure: the set could not be read, so
    // nothing may be granted and nowhere is safe
    // to send the caller.
    stubFetch(new TypeError('Failed to fetch'));

    renderRequired();

    await waitFor(() => expect(screen.queryByTestId('permission-loading')).not.toBeInTheDocument());

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('sends the caller to the forbidden page of THEIR locale', async () => {
    // An Arabic visitor is sent to /ar/forbidden, not
    // to /en/forbidden - the locale comes from the
    // provider the shell mounted, not from a default.
    stubFetch(jsonResponse({ permissions: ['PERMISSION_READ_OWN'] }));

    renderRequired({ locale: 'ar' });

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/ar/forbidden'));
  });

  it('gates on the key it was given, not on any key', async () => {
    // The set holds STUDENTS_READ and the wrapper
    // asks for STUDENTS_WRITE. A wrapper that opened
    // on any granted key would be a grant for every
    // route it wrapped.
    stubFetch(jsonResponse({ permissions: ['STUDENTS_READ'] }));

    renderRequired({ permission: 'STUDENTS_WRITE' });

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/en/forbidden'));
  });
});
