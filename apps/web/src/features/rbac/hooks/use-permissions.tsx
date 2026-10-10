'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  buildPermissionsRequest,
  parsePermissionsBody,
  permissionsEndpoint,
} from '../permissions-request';

/**
 * The signed-in caller's permission set, and how to ask it.
 *
 * ## Why there is a provider at all
 *
 * Every permission-aware control on a page - the nav, the
 * action buttons, the route wrappers - needs the same set.
 * Fetching it per control would be one request per module the
 * school has licensed, and the answers could disagree if the
 * API's view changed between them. `PermissionsProvider`
 * fetches once; `usePermissions` is how a consumer reads the
 * answer. A consumer with no provider in scope throws, rather
 * than silently reporting an empty set - which would be a UI
 * that looks rendered and permits nothing.
 *
 * ## Why the first render claims nothing
 *
 * The set is not known until the API answers. A control that
 * rendered "you may not do this" during the fetch would flash
 * a denial the API may not have made, and one that rendered
 * "you may" would flash a grant that a 403 may take back. So
 * `phase` starts as `loading` and every predicate answers
 * false until the answer arrives.
 *
 * ## Fail-closed, and why the error phase is not a denial
 *
 * `has`/`hasAny`/`hasAll` answer false unless the phase is
 * `ready`. A caller who cannot be answered - the API is
 * unreachable, or the API refused the read itself (403, which
 * for this route means the caller's roles do not hold
 * `PERMISSION_READ_OWN`) - may do NOTHING, which is what the
 * predicates say. That is the direct-API-bypass defence
 * `PLT-205` T3 is about, held on the client as well as the
 * socket: a UI that could not prove a grant does not render
 * one.
 *
 * The `error` phase is deliberately not a third refusal kind
 * the UI can branch on into "show something". There is no
 * safe something: rendering the restricted content would be a
 * grant, rendering a denial would be a policy decision the
 * API never made. So the phase is reported, and the caller
 * decides - `RequirePermission` renders nothing and stays put.
 *
 * ## Where the provider is mounted
 *
 * Not in the root layout. The layout is shared by the sign-in
 * screen, which has no session and would fetch a 401 on every
 * visit. The provider belongs to the first authenticated
 * shell, and until that shell exists the hook is unused -
 * which is why its tests mount their own provider rather than
 * reaching for one that is not there.
 */

/**
 * What is known about the caller's permission set.
 *
 * `loading` - the request is in flight; nothing is claimed.
 * `ready` - the API answered 200 and `permissions` is the set.
 * `unauthenticated` - 401; there is no session to read a set for.
 * `error` - 403, network or unexpected; the set could not be read,
 * and every predicate answers false.
 */
export type PermissionsPhase = 'loading' | 'ready' | 'unauthenticated' | 'error';

export interface PermissionsControls {
  readonly phase: PermissionsPhase;
  /**
   * The caller's permission keys. Empty unless `phase` is
   * `ready` - an empty set and an unread set are different
   * answers, and only the phase says which is which.
   */
  readonly permissions: ReadonlySet<string>;
  /** False unless the phase is `ready` and the set holds the key. */
  readonly has: (permission: string) => boolean;
  /** False unless the phase is `ready` and the set holds any of the keys. */
  readonly hasAny: (permissions: readonly string[]) => boolean;
  /** False unless the phase is `ready` and the set holds every key. */
  readonly hasAll: (permissions: readonly string[]) => boolean;
}

const PermissionsContext = createContext<PermissionsControls | null>(null);

export interface PermissionsProviderProps {
  /** Overrides the API base URL. Tests only. */
  readonly endpoint?: string;
  readonly children: ReactNode;
}

export function PermissionsProvider({ endpoint, children }: PermissionsProviderProps) {
  const [phase, setPhase] = useState<PermissionsPhase>('loading');
  const [permissions, setPermissions] = useState<ReadonlySet<string>>(() => new Set<string>());

  useEffect(() => {
    const controller = new AbortController();
    // Set when the effect's request settles, so a late answer
    // cannot land after the component is gone.
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(permissionsEndpoint(endpoint), {
          ...buildPermissionsRequest({ signal: controller.signal }),
        });

        if (response.status === 200) {
          // Read once, defensively: a proxy that answers 200
          // with a body that is not JSON must not turn a
          // successful read into a parse error.
          const body: unknown = await response.json().catch(() => null);

          if (!cancelled) {
            setPermissions(new Set<string>(parsePermissionsBody(body)));
            setPhase('ready');
          }
          return;
        }

        if (!cancelled) {
          // 401 is the one refusal with its own phase: it
          // means "no session", which the UI answers by
          // sending the visitor to sign in. Every other
          // refusal - 403 above all - means the set could
          // not be read, and the fail-closed phase is the
          // only safe answer.
          setPhase(response.status === 401 ? 'unauthenticated' : 'error');
        }
      } catch {
        // Offline, DNS, TLS or a CORS rejection all arrive
        // here as a thrown TypeError with no status, and
        // all of them mean the same thing: the set could
        // not be read, so nothing may be granted.
        if (!cancelled) {
          setPhase('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [endpoint]);

  /**
   * Fail-closed by construction: the phase is checked first,
   * so a set that was never read answers false no matter what
   * the (empty) set contains.
   */
  const has = useCallback(
    (permission: string) => phase === 'ready' && permissions.has(permission),
    [phase, permissions],
  );

  const hasAny = useCallback(
    (requested: readonly string[]) =>
      phase === 'ready' && requested.some((permission) => permissions.has(permission)),
    [phase, permissions],
  );

  const hasAll = useCallback(
    (requested: readonly string[]) =>
      phase === 'ready' && requested.every((permission) => permissions.has(permission)),
    [phase, permissions],
  );

  // Stable across renders, so a control in a memoised subtree
  // does not re-render on every keystroke elsewhere on the page.
  const value = useMemo<PermissionsControls>(
    () => ({ phase, permissions, has, hasAny, hasAll }),
    [phase, permissions, has, hasAny, hasAll],
  );

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

/**
 * Read the caller's permission set.
 *
 * Throws without a `PermissionsProvider`, because a consumer
 * that silently received an empty set would render a UI that
 * permits nothing and look like a policy decision.
 */
export function usePermissions(): PermissionsControls {
  const controls = useContext(PermissionsContext);

  if (controls === null) {
    throw new Error('usePermissions was called outside a <PermissionsProvider>.');
  }

  return controls;
}
