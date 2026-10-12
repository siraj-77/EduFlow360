import type { ReactNode } from 'react';

import { RequirePermission } from '@/features/rbac/components/require-permission';
import { PermissionsProvider } from '@/features/rbac/hooks/use-permissions';

/**
 * The console's guard, applied once to everything under `/admin`.
 *
 * `PLT-1002` T1. Two gates stand in front of this route group and they
 * are deliberately different shapes:
 *
 *   - `middleware.ts` answers "is there a session cookie at all" before
 *     any rendering, so an anonymous caller is redirected rather than
 *     shown a skeleton that disappears. It is a UX gate: presence is not
 *     validity.
 *   - THIS wrapper answers the permission question, from the API's own
 *     answer about this session. It is also a UX gate — `AGENTS.md` 2.3
 *     is explicit that the frontend gate is never the boundary — but it
 *     is the one that screens a signed-in caller whose roles do not
 *     grant the console, sending them to `forbidden`.
 *
 * A layout rather than a per-page wrapper, so a page added under
 * `/admin` cannot forget the guard. That is the same reason the guard
 * lives here rather than in the page: the cheap mistake to make is a
 * new page without the check, and a layout removes the choice.
 *
 * ## Why the provider is mounted HERE
 *
 * This is `PermissionsProvider`'s first production mount — `PLT-205`
 * built it test-first and no route had needed it until the console did.
 * It reads `GET /permissions/me` with the session cookie, so it belongs
 * above the wrapper that consumes it and BELOW nothing that would fetch
 * it for every public page: the landing page has no session and gains
 * nothing from the round trip. An authenticated route group is the
 * narrowest correct scope, and the locale layout — shared with the
 * public pages — would be too wide.
 *
 * The API enforces the same permission independently (`PLT-1002` AC-4),
 * on `GET /admin` and every route that follows it.
 */
export default function AdminLayout({ children }: { readonly children: ReactNode }) {
  return (
    <PermissionsProvider>
      <RequirePermission permission="ADMIN_CONSOLE_ACCESS">{children}</RequirePermission>
    </PermissionsProvider>
  );
}
