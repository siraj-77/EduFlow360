import type { IPermissionGrantReader } from '../domain/ports/permission-grant-reader.js';

/**
 * Reading the caller's own permission set — `PLT-204`.
 *
 * ## Why a use-case rather than a controller line
 *
 * The controller has to establish WHO is asking (the principal
 * `SessionGuard` attached) and then hand that identity to something
 * that knows how to read a permission set. Putting the read in the
 * controller would put the port call in the HTTP layer, and the next
 * caller — a future CLI, a future event — would have to repeat it.
 *
 * ## What this use-case deliberately does NOT do
 *
 * It does not filter, sort or deduplicate. The port contract is "the
 * UNION of every role, deduplicated, sorted ascending"
 * (`permission-grant-reader.ts`), and a use-case that re-sorted would
 * be a second place that promise lives and could quietly disagree
 * with the first. It passes the reader's answer through, and the
 * reader owns the shape.
 *
 * ## Why the caller is an argument and not a session read
 *
 * The caller is `GET /permissions/me`, which `SessionGuard` has
 * already authenticated. It passes the principal it read. The
 * use-case does not receive a request, cannot read a cookie, and has
 * no other source for a user id — so the account cannot come from
 * anywhere except the authenticated route. That is the whole of the
 * defence against "session cookie present, therefore read someone
 * else's set": there is no parameter to ask with.
 */

/**
 * A read of the caller's own permission set was asked for without
 * naming the account it is about.
 *
 * Its own class rather than a bare `Error`, because the two failures
 * have nothing in common operationally: a database outage is a
 * propagation the caller surfaces as a 500, while this one means
 * "check the controller that called `read`" — a wiring fault, not a
 * user error and not an outage. Collapsing them would leave an
 * operator debugging the wrong file.
 */
export class UnidentifiedCallerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnidentifiedCallerError';
  }
}

/** The answer: the caller's own permission keys, and nothing else. */
export interface MyPermissions {
  readonly permissions: readonly string[];
}

export class ReadMyPermissions {
  constructor(private readonly grants: IPermissionGrantReader) {}

  /**
   * Read the permission set of the account named in `params`.
   *
   * The account is the principal the authenticated route passed —
   * see the header for why it cannot come from anywhere else. A
   * blank id is refused before the database is asked, because a
   * read for "nobody" is not a permission decision; it is the
   * shape a caller that skipped authentication takes.
   */
  async read(params: { readonly userId: string }): Promise<MyPermissions> {
    if (typeof params.userId !== 'string' || params.userId.trim().length === 0) {
      throw new UnidentifiedCallerError(
        'Refusing to read a permission set with no account. The set belongs to ' +
          'the caller SessionGuard authenticated, and a read that names no account ' +
          'is the shape a request that skipped authentication takes, so this is ' +
          'refused here rather than answered with an empty set that would read ' +
          'like a policy decision. Only a route behind SessionGuard may call this.',
      );
    }

    const permissions = await this.grants.grantedKeys({ userId: params.userId });

    return { permissions };
  }
}
