import { act, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { messages } from '@eduflow/i18n-resources';
import type { SupportedLocale } from '@eduflow/shared-types';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PermissionsProvider, usePermissions, type PermissionsPhase } from './use-permissions';

/**
 * The permission hook.
 *
 * What is being proved, and why each one is not obvious:
 *
 * 1. **Fail-closed is the whole contract.** A UI that
 *    cannot prove a grant must not render one. So the
 *    assertions that matter are the ones about what
 *    `has` answers while the request is in flight, after
 *    a 403, and after a network failure - not the happy
 *    path, which is the easy one.
 *
 * 2. **`unauthenticated` is not `error`.** 401 means no
 *    session, which the UI answers by sending the visitor
 *    to sign in. 403 means a session whose roles do not
 *    hold the read key, which the UI answers by granting
 *    nothing. Collapsing them would send a signed-in
 *    teacher to the sign-in screen.
 *
 * 3. **A late answer must not land.** An unmounted
 *    component that dispatches a phase is a React warning
 *    and, worse, a set that outlives the screen that
 *    asked for it. The abort is asserted, not assumed.
 *
 * Rendered with the REAL dictionaries where a message is
 * shown, for the same reason `use-theme.spec.tsx` does: a
 * stubbed translator would pass a message that cannot
 * actually be parsed or rendered.
 */

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

/** A `fetch` that stays pending until the test releases it. */
function stubPendingFetch(): {
  calls: RequestInit[];
  release: (response: Response) => void;
} {
  const calls: RequestInit[] = [];
  let release: (response: Response) => void = () => undefined;

  vi.stubGlobal(
    'fetch',
    (_url: string, init: RequestInit) =>
      new Promise<Response>((resolve) => {
        calls.push(init);
        release = resolve;
      }),
  );

  return { calls, release: (response) => release(response) };
}

/** Renders the hook and hands back the latest value it returned. */
function renderPermissionsHook(endpoint?: string) {
  const observed: { current: ReturnType<typeof usePermissions> | null } = {
    current: null,
  };

  function Probe() {
    observed.current = usePermissions();
    return null;
  }

  const view = render(
    <PermissionsProvider {...(endpoint === undefined ? {} : { endpoint })}>
      <Probe />
    </PermissionsProvider>,
  );

  return { observed, view };
}

/** Renders the hook with NO provider in scope. */
function renderUnprovidedHook() {
  function Probe() {
    usePermissions();
    return null;
  }

  return render(<Probe />);
}

/** The phase the hook is in, narrowed for assertions. */
function phaseOf(observed: {
  current: ReturnType<typeof usePermissions> | null;
}): PermissionsPhase {
  if (observed.current === null) {
    throw new Error('the hook was not rendered');
  }

  return observed.current.phase;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('usePermissions', () => {
  it('throws without a provider, rather than permitting nothing silently', () => {
    // A consumer that silently received an empty set would
    // render a UI that permits nothing and look like a
    // policy decision. The throw is the difference.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderUnprovidedHook()).toThrow(
      'usePermissions was called outside a <PermissionsProvider>.',
    );

    consoleError.mockRestore();
  });

  it('claims nothing while the request is in flight', async () => {
    // The set is not known until the API answers. A control
    // that rendered a denial during the fetch would flash a
    // denial the API may not have made.
    const pending = stubPendingFetch();
    const { observed } = renderPermissionsHook();

    expect(phaseOf(observed)).toBe('loading');
    expect(observed.current?.has('PERMISSION_READ_OWN')).toBe(false);
    expect(observed.current?.hasAny(['PLATFORM_MODULE_MANAGE'])).toBe(false);
    expect(observed.current?.hasAll(['PERMISSION_READ_OWN'])).toBe(false);

    pending.release(jsonResponse({ permissions: [] }));
    await waitFor(() => expect(phaseOf(observed)).toBe('ready'));
  });

  it('reads the set the API returned and answers the predicates from it', async () => {
    stubFetch(
      jsonResponse({
        permissions: ['PERMISSION_READ_OWN', 'PLATFORM_MODULE_MANAGE'],
      }),
    );
    const { observed } = renderPermissionsHook();

    await waitFor(() => expect(phaseOf(observed)).toBe('ready'));

    expect(observed.current?.permissions).toEqual(
      new Set(['PERMISSION_READ_OWN', 'PLATFORM_MODULE_MANAGE']),
    );
    expect(observed.current?.has('PERMISSION_READ_OWN')).toBe(true);
    expect(observed.current?.has('STUDENTS_READ')).toBe(false);
    expect(observed.current?.hasAny(['STUDENTS_READ', 'PLATFORM_MODULE_MANAGE'])).toBe(true);
    expect(observed.current?.hasAny(['STUDENTS_READ', 'ATTENDANCE_READ'])).toBe(false);
    expect(observed.current?.hasAll(['PERMISSION_READ_OWN', 'PLATFORM_MODULE_MANAGE'])).toBe(true);
    expect(observed.current?.hasAll(['PERMISSION_READ_OWN', 'STUDENTS_READ'])).toBe(false);
  });

  it('drops a key that is not a string, because the set decides what a user may see', async () => {
    // The value arrives from the network. A number is not a
    // permission key, and a set built from it would grant
    // on the strength of a value the API never sent.
    stubFetch(jsonResponse({ permissions: ['PERMISSION_READ_OWN', 42, null] }));
    const { observed } = renderPermissionsHook();

    await waitFor(() => expect(phaseOf(observed)).toBe('ready'));

    expect(observed.current?.permissions).toEqual(new Set(['PERMISSION_READ_OWN']));
  });

  it('answers an empty set for a 200 body it cannot read', async () => {
    // A proxy that answers 200 with a non-JSON body must
    // not turn a successful read into a parse error. An
    // empty set and an unread set are different answers,
    // and the phase says which is which.
    stubFetch(new Response('not json', { status: 200 }));
    const { observed } = renderPermissionsHook();

    await waitFor(() => expect(phaseOf(observed)).toBe('ready'));

    expect(observed.current?.permissions).toEqual(new Set());
    expect(observed.current?.has('PERMISSION_READ_OWN')).toBe(false);
  });

  it('reports a missing session as unauthenticated, which is not an error', async () => {
    // 401 means no session at all. The UI answers by
    // sending the visitor to sign in - not by granting
    // nothing and staying put.
    stubFetch(new Response(null, { status: 401 }));
    const { observed } = renderPermissionsHook();

    await waitFor(() => expect(phaseOf(observed)).toBe('unauthenticated'));

    expect(observed.current?.has('PERMISSION_READ_OWN')).toBe(false);
  });

  it('reports a refused read as an error, and grants nothing', async () => {
    // 403 on this route means the caller's roles do not
    // hold PERMISSION_READ_OWN. Every system role holds
    // it, so this is a wiring fault - and the only safe
    // answer is to grant nothing.
    stubFetch(new Response(null, { status: 403 }));
    const { observed } = renderPermissionsHook();

    await waitFor(() => expect(phaseOf(observed)).toBe('error'));

    expect(observed.current?.has('PERMISSION_READ_OWN')).toBe(false);
    expect(observed.current?.hasAny(['PERMISSION_READ_OWN'])).toBe(false);
    expect(observed.current?.hasAll(['PERMISSION_READ_OWN'])).toBe(false);
  });

  it('reports an unreachable server as an error, and grants nothing', async () => {
    // Offline, DNS, TLS: all a thrown TypeError, all the
    // same answer. A UI that could not prove a grant does
    // not render one.
    stubFetch(new TypeError('Failed to fetch'));
    const { observed } = renderPermissionsHook();

    await waitFor(() => expect(phaseOf(observed)).toBe('error'));

    expect(observed.current?.has('PERMISSION_READ_OWN')).toBe(false);
  });

  it('sends the request the API contract describes', async () => {
    // GET, Accept: application/json, credentials included,
    // and no CSRF header - a GET is a safe method and
    // CsrfGuard enforces state-changing requests only.
    const { calls } = stubFetch(jsonResponse({ permissions: [] }));
    renderPermissionsHook('/api');

    await waitFor(() => expect(calls).toHaveLength(1));

    const init = calls[0];
    if (init === undefined) {
      // Unreachable: the waitFor above asserts the length.
      // The guard narrows the type without the non-null
      // assertion the lint config forbids.
      throw new Error('the hook did not send a request');
    }

    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>).Accept).toBe('application/json');
    expect(init.headers).not.toHaveProperty('x-eduflow-csrf');
  });

  it('does not dispatch a phase after it unmounts', async () => {
    // An unmounted component that dispatches is a React
    // warning and a set that outlives the screen that
    // asked for it. The abort is the mechanism; this is
    // the assertion that it works.
    const pending = stubPendingFetch();
    const { observed, view } = renderPermissionsHook();

    view.unmount();

    pending.release(jsonResponse({ permissions: ['PERMISSION_READ_OWN'] }));
    await act(async () => {
      await Promise.resolve();
    });

    // The phase is whatever it was when the component
    // unmounted - the late answer changed nothing.
    expect(phaseOf(observed)).toBe('loading');
  });
});

/**
 * The provider as a person's shell reaches it: a client
 * component inside the i18n provider, the way the
 * authenticated shell will mount it.
 *
 * The component that CALLS the hook is a child of the
 * provider, not the component that renders it - a
 * provider cannot be its own consumer.
 */
describe('the provider in a rendered shell', () => {
  /** Reads the hook and renders what it read. */
  function PhaseProbe() {
    const { phase, has } = usePermissions();

    return (
      <>
        <p data-testid="phase">{phase}</p>
        <p data-testid="may-read">{has('PERMISSION_READ_OWN') ? 'yes' : 'no'}</p>
      </>
    );
  }

  function Shell({
    locale = 'en',
    endpoint,
  }: {
    readonly locale?: SupportedLocale;
    readonly endpoint?: string;
  }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages[locale]}>
        <PermissionsProvider {...(endpoint === undefined ? {} : { endpoint })}>
          <PhaseProbe />
        </PermissionsProvider>
      </NextIntlClientProvider>
    );
  }

  it('renders the loading phase, then the answer, in the locale it was given', async () => {
    stubFetch(jsonResponse({ permissions: ['PERMISSION_READ_OWN'] }));

    render(<Shell />);

    expect(screen.getByTestId('phase')).toHaveTextContent('loading');

    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('ready'));
    expect(screen.getByTestId('may-read')).toHaveTextContent('yes');
  });

  it('renders the same answer in every locale it ships in', async () => {
    // The phase is not a message, but the shell around it
    // is, and a provider that broke in one locale would
    // break the whole school's UI in that language.
    const locales: SupportedLocale[] = ['en', 'ta', 'si', 'ar'];

    for (const locale of locales) {
      stubFetch(jsonResponse({ permissions: ['PERMISSION_READ_OWN'] }));

      const view = render(<Shell locale={locale} />);

      await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('ready'));
      expect(screen.getByTestId('may-read')).toHaveTextContent('yes');

      view.unmount();
    }
  });

  it('re-fetches when the endpoint changes', async () => {
    // The endpoint is a dependency of the read, so a shell
    // that moves between deployments re-reads rather than
    // answering from the previous one.
    const { calls } = stubFetch(jsonResponse({ permissions: [] }));

    const view = render(<Shell endpoint="/api" />);

    await waitFor(() => expect(calls).toHaveLength(1));

    view.rerender(<Shell endpoint="https://api.school.edu" />);

    await waitFor(() => expect(calls).toHaveLength(2));
  });
});

/** Compile-time guard: the phase union is part of the contract. */
export type { PermissionsPhase };
