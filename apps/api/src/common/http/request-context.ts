/**
 * The slice of an incoming request every authenticated route reads.
 *
 * ## Why this file exists
 *
 * `POST /auth/login` and `POST /auth/setup/complete` each declared their own
 * `RequestWithAddress` and their own `toDeviceContext`, and the OIDC callback needed
 * the same two things. Three copies of "where did this request come from" is three
 * places for an answer about a caller-s source address to drift — and this one is
 * read by a **throttle**, so a drift is a security difference, not a style one.
 *
 * ## Why `express` is still not imported
 *
 * Same reason as `express-cookie-carrier.ts`: `express` is a transitive dependency of
 * `@nestjs/platform-express` and is not in this package's `package.json`, so naming
 * its types would make an undeclared package load-bearing. The real Express request
 * satisfies these shapes structurally.
 *
 * ## Why `trust proxy` is off, and that is load-bearing
 *
 * `app.set('trust proxy', …)` is deliberately not configured, so `ip` is the socket
 * peer. `AGENTS.md` 2.1 makes this a **single application deployment per school**,
 * with no shared load balancer in front of it, so the socket peer is the client.
 *
 * Configuring it wrongly is how a source-keyed throttle becomes trivially bypassable
 * with a forged `X-Forwarded-For`, which is why the setting is absent rather than
 * defaulted to something permissive. Behind a proxy this must be configured, and the
 * decision belongs with whoever owns the deployment.
 */
export interface RequestWithAddress {
  /** Express's resolved client address. The socket peer — see the header. */
  readonly ip?: string | undefined;
  readonly socket?: { readonly remoteAddress?: string | undefined } | undefined;
  readonly headers?: Record<string, string | string[] | undefined> | undefined;
}

/** The same slice, plus a source address that is never absent. */
export interface RequestWithSource extends RequestWithAddress {
  /** `ip` if present, else the socket peer, else this literal. Never `undefined`. */
  readonly sourceAddress: string;
}

/**
 * The literal `'unknown-source'` is a deliberate bucket rather than a fallback for
 * "no address": it is the key every request without a resolvable address shares, so
 * such requests are throttled **together**. That is the safe direction — a flood from
 * callers whose address cannot be determined is bounded as one source instead of
 * escaping the throttle entirely.
 *
 * ## Why blank counts as unresolvable
 *
 * `request.ip ?? request.socket?.remoteAddress ?? …` is the obvious one-liner and it
 * is wrong in a way a test caught. `??` catches `undefined` and `null` but **not** the
 * empty string, so a request whose peer address arrived as `''` would be keyed on
 * `''` — and every such request shares that one key, which sounds like the safe
 * direction until you notice that a *client* controls whether its address looks blank,
 * giving an attacker a bucket of their own with a clean name.
 *
 * Whitespace is treated the same way for the same reason. Hence a non-blank check
 * rather than a nullish one, in both places this reads an address.
 */
export function sourceAddressOf(request: RequestWithAddress): string {
  return (
    presentAddress(request.ip) ?? presentAddress(request.socket?.remoteAddress) ?? UNKNOWN_SOURCE
  );
}

/** A trimmed, non-empty address, or `null`. */
function presentAddress(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** The single key every unresolvable caller shares. Never a credential, never logged. */
const UNKNOWN_SOURCE = 'unknown-source';

/**
 * What to persist about the browser, assembled conditionally.
 *
 * An absent header stays absent rather than becoming `undefined`, because
 * `exactOptionalPropertyTypes` is on and `PrismaSessionRepository` would reject the
 * latter where an absent optional column is meant. Returns `{}` when there is nothing
 * to record, which is also what makes the spread at the call site correct.
 */
export function toDeviceContext(request: RequestWithAddress): {
  readonly device?: { readonly ipAddress?: string; readonly userAgent?: string };
} {
  const ipAddress = presentAddress(request.ip) ?? presentAddress(request.socket?.remoteAddress);
  // An array means the header appeared more than once, which no browser does. Rather
  // than pick one, record none: a wrong user-agent on a session record is worse than
  // none, and this value is for a human reading a device list.
  const header = request.headers?.['user-agent'];
  const userAgent = typeof header === 'string' && header.trim().length > 0 ? header : undefined;

  if (ipAddress === null && userAgent === undefined) return {};
  return {
    device: {
      ...(ipAddress !== null ? { ipAddress } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
    },
  };
}
