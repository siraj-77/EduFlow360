import type {
  ILicencePayloadCache,
  LicenceCacheState,
} from '../../domain/ports/licence-payload-cache.js';

/**
 * The in-process cache (`PLT-301` T2).
 *
 * `ADR-003` gives one deployment one school, so one process holds one
 * certificate's state and there is nothing to share or key by. Redis caching
 * (`PLT-602`) is for state that crosses processes — sessions, permission
 * grants — and a licence that changes between a restart and the next request
 * is a licence somebody is trying to force in; the refresh cadence (at boot
 * and on `PLT-305`'s schedule) is the answer to staleness, not a remote store.
 *
 * See the spec for why a FAILURE is remembered as carefully as a success.
 */
export class InMemoryLicencePayloadCache implements ILicencePayloadCache {
  private state: LicenceCacheState | null = null;

  current(): LicenceCacheState | null {
    return this.state;
  }

  remember(state: LicenceCacheState): void {
    this.state = state;
  }
}
