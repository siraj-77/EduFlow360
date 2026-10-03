import type {
  IExternalIdentityRepository,
  ExternalIdentityRecord,
  LinkExternalIdentityOutcome,
  LinkExternalIdentityParams,
} from '../modules/auth/domain/ports/external-identity-repository.js';

/**
 * An in-memory `IExternalIdentityRepository` for tests that are not about the database.
 *
 * ## What it reproduces faithfully
 *
 * **The refusal.** `link` against a `(provider, subject)` bound to a *different*
 * account reports `already-linked-elsewhere` and writes nothing. That is the whole
 * security decision of the port, and a double that quietly returned `{ outcome:
 * 'linked' }` would let a use-case with an `upsert` in it pass every test.
 *
 * A double that ignored the outcome would be the worse version of this file: the
 * refusal is the property, and a collaborator that cannot refuse proves nothing.
 *
 * ## Why there is no `unlink`
 *
 * The port has no `unlink` and neither does this. See the port: it is a recorded gap,
 * not an oversight, and a fake that added one would hide it.
 */
export class FakeExternalIdentityRepository implements IExternalIdentityRepository {
  /** The live table, keyed `${provider}|${subject}`. */
  readonly rows = new Map<string, ExternalIdentityRecord>();

  readonly findCalls: Array<{ readonly provider: string; readonly subject: string }> = [];
  readonly linkCalls: LinkExternalIdentityParams[] = [];

  /** Rows this repository would have written, so a test can assert it wrote none. */
  get size(): number {
    return this.rows.size;
  }

  private key(provider: string, subject: string): string {
    return `${provider}|${subject}`;
  }

  /** Arrange an existing binding without going through `link`. */
  arrange(record: ExternalIdentityRecord): void {
    this.rows.set(this.key(record.provider, record.subject), record);
  }

  async findBySubject(provider: string, subject: string): Promise<ExternalIdentityRecord | null> {
    this.findCalls.push({ provider, subject });
    return this.rows.get(this.key(provider, subject)) ?? null;
  }

  async link(params: LinkExternalIdentityParams): Promise<LinkExternalIdentityOutcome> {
    this.linkCalls.push(params);
    const existing = this.rows.get(this.key(params.provider, params.subject));

    if (existing !== undefined) {
      return existing.userId === params.userId
        ? { outcome: 'already-linked' }
        : { outcome: 'already-linked-elsewhere' };
    }

    this.arrange({
      userId: params.userId,
      provider: params.provider,
      subject: params.subject,
    });
    return { outcome: 'linked' };
  }
}
