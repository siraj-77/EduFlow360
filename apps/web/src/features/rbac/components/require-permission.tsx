'use client';

import { useEffect, type ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Skeleton } from '@eduflow/ui-kit';

import { usePermissions } from '../hooks/use-permissions';

/**
 * Wraps a route: the caller must hold the permission, or
 * the route is not theirs to see.
 *
 * ## The three answers, and why they are three
 *
 * **Loading** renders a `Skeleton`. The set has not been
 * read, so nothing is claimed either way - a flash of
 * the restricted content would be a grant the API never
 * made, and a flash of a denial would be a policy
 * decision the API never made. `AGENTS.md` 3.2.4 puts
 * a skeleton on async data; this is async data.
 *
 * **Ready and permitted** renders the children. This is
 * the only path that does.
 *
 * **Ready and not permitted** redirects to the locale's
 * forbidden page. `replace`, not `push`: the restricted
 * route must not survive in history, because Back must
 * not be able to return a caller to a page their roles
 * do not grant - the browser's own cache would show it
 * even though the API would refuse the data behind it.
 *
 * **Unauthenticated** redirects to sign in, CARRYING THE DESTINATION.
 * `next` is the path the caller was on, so the password check can return
 * them to it (`PLT-1002` AC-1) instead of to the generic signed-in
 * screen. It is encoded, because it becomes a query parameter, and it is
 * the middleware's own redirect shape — the two halves fail the same
 * way, whether the session cookie was absent or merely invalid.
 *
 * A route wrapper is the one place that knows the caller is looking at
 * something that needs a session, so it is the right place to send
 * them.
 *
 * **Error** - the set could not be read, because the
 * API refused the read (403) or never answered - renders
 * NOTHING and redirects nowhere. This is the fail-closed
 * answer, and it is deliberate: there is no safe
 * destination. Rendering the content would be a grant;
 * rendering the forbidden page would be a policy decision
 * the API never made; sending the caller to sign in
 * would be a lie about why. The screen stays put and
 * shows nothing, which is what a caller who cannot be
 * answered is owed.
 *
 * ## Why this is not a security boundary
 *
 * `AGENTS.md` 2.3: the frontend permission gate is UX
 * only. The API's `@RequirePermission` is the
 * enforcement, and `PLT-205` T3 proves the bypass over
 * a real socket. This wrapper exists so a caller who
 * cannot use a route does not SEE it - not so that a
 * caller who calls the API directly is stopped.
 */
export function RequirePermission({
  permission,
  children,
}: {
  /** The permission key the caller must hold. */
  readonly permission: string;
  readonly children: ReactNode;
}) {
  const { phase, has } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  // `has` is already fail-closed: it answers false
  // unless the phase is `ready`, so `permitted` is
  // false during the fetch, after a 403 and after a
  // network failure, without a second check.
  const permitted = has(permission);

  useEffect(() => {
    if (phase === 'ready' && !permitted) {
      router.replace(`/${locale}/forbidden`);
      return;
    }

    if (phase === 'unauthenticated') {
      // The destination is this route's own path — the caller was
      // trying to reach it. Encoded because it becomes a query
      // parameter; the sign-in screen validates it with
      // `safeNextPath` before honouring it, so a tampered value is
      // dropped there rather than trusted here.
      const next = pathname === null ? '' : `?next=${encodeURIComponent(pathname)}`;
      router.replace(`/${locale}/sign-in${next}`);
    }
  }, [phase, permitted, router, locale, pathname]);

  if (phase === 'loading') {
    return <Skeleton data-testid="permission-loading" className="h-48 w-full" />;
  }

  if (permitted) {
    return <>{children}</>;
  }

  // `error` (fail-closed, stay put), or `ready`
  // without the key / `unauthenticated` (the effect
  // is redirecting). Nothing to render either way.
  return null;
}
