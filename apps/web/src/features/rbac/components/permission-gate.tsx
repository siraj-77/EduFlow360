'use client';

import type { ReactNode } from 'react';

import { usePermissions } from '../hooks/use-permissions';

/**
 * Renders children only when the caller holds a permission.
 *
 * ## What this is, and what it is not
 *
 * This is the UI half of `PLT-204`: a nav item, an action
 * button, a section - anything that should simply not exist
 * for a caller who cannot use it. It is NOT a security
 * boundary. `AGENTS.md` 2.3 is explicit that the frontend
 * permission gate is UX only, and the API's own
 * `@RequirePermission` is the enforcement. A caller who
 * calls the API directly is answered by the API, not by
 * this component - which is the whole of the
 * direct-API-bypass story `PLT-205` T3 proves.
 *
 * ## Why `fallback` defaults to null
 *
 * The common case is "this does not exist for you", not
 * "here is a disabled version". A disabled button still
 * announces the feature, and a feature the caller's roles
 * do not grant is not theirs to be teased with. When a
 * fallback is wanted - a lock icon, a "ask your
 * administrator" note - it is passed explicitly.
 *
 * ## Fail-closed
 *
 * `has` answers false unless the permission set was read
 * successfully, so a gate renders its fallback while the
 * request is in flight, after a 403, and after a network
 * failure. A gate that could not prove a grant does not
 * render one.
 */
export function PermissionGate({
  permission,
  fallback = null,
  children,
}: {
  /** The permission key the caller must hold. */
  readonly permission: string;
  /** What to render instead. `null` by default. */
  readonly fallback?: ReactNode;
  readonly children: ReactNode;
}) {
  const { has } = usePermissions();

  return has(permission) ? <>{children}</> : <>{fallback}</>;
}
