import type {
  IAllowedEmailDomainStore,
  StoredEmailDomainAllowlist,
} from '../modules/settings/domain/ports/allowed-email-domain-store.js';

/**
 * An `IAllowedEmailDomainStore` that returns one value.
 *
 * ## Why this is a double rather than a real settings row
 *
 * `PrismaAllowedEmailDomainStore` has its own integration spec against a real
 * database, including the missing-row case. What the callback needs to exercise is
 * `decideEmailDomain`'s four refusals — and those are decided by the store handing
 * over an **untyped** column value. Standing up a row per refusal would make the
 * callback suite need PostgreSQL for a decision that is pure.
 *
 * ## Why the value is passed through untouched
 *
 * The port's contract is that the store does NOT normalise, trim or de-duplicate. A
 * fake that "helpfully" tidied the value would hide the very bug the contract
 * exists to prevent, so this returns the value it was given, whatever it is.
 */
export class FakeAllowedEmailDomainStore implements IAllowedEmailDomainStore {
  constructor(private value: StoredEmailDomainAllowlist) {}

  /** Re-point the store, so one test can change what a school has configured. */
  set(value: StoredEmailDomainAllowlist): void {
    this.value = value;
  }

  async readAllowlist(): Promise<StoredEmailDomainAllowlist> {
    return this.value;
  }
}
