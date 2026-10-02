import type { IClock } from '../domain/ports/clock.js';
import type { IPasswordHasher, PasswordHashParameters } from '../domain/ports/password-hasher.js';
import type {
  BootstrapIdentity,
  IBootstrapClaimRepository,
} from '../domain/repositories/bootstrap-claim-repository.js';
import {
  decidePasswordAcceptance,
  type PasswordPolicy,
  type PasswordPolicyRefusal,
} from '../domain/services/password-policy.js';
import type { SetupTokenService } from './setup-token-service.js';

/**
 * `POST /auth/setup/complete` — claiming a fresh deployment.
 *
 * ## What this use-case is
 *
 * The only unauthenticated **write** in the system. Whoever presents the one-time
 * setup token becomes the school's first administrator, so every step below is a
 * security decision rather than plumbing.
 *
 * `STORY_PLT-107` chose option (b): the token lives in two nullable columns on the
 * one `INVITED` user row. That shape has one consequence everything else follows
 * from — **consumption is irreversible and there is no recovery path.** The story
 * records it: a deployment that loses its token must use a console. So on a
 * single-school installation, spending the token wrongly is not an inconvenience,
 * it is a lockout with no way back.
 *
 * ## The ordering is the security content
 *
 *   1. **password policy** — pure, no I/O, no database, no argon2.
 *   2. **token verdict** — a READ (`SetupTokenService.verify`), which by contract
 *      mutates nothing.
 *   3. **hash** — expensive, and still writes nothing.
 *   4. **claim** — one transaction, and the only irreversible step.
 *
 * Every refusal happens before step 4. That is the whole design, and it is what
 * "a rejected attempt does not burn the school's only way in" means in code.
 *
 * ## Why the policy is checked BEFORE the token
 *
 * Two reasons, and the second is the interesting one.
 *
 * First, it is the cheapest check: pure, in-process, no database round trip. A
 * caller who mistypes their new password should not cost the deployment a query.
 *
 * Second, and this is the one worth stating: it means a rejected password produces
 * the SAME refusal whether the token was valid, expired, forged, or never issued.
 * If the token were checked first, a caller with a short password would learn the
 * token's status from the error they got back. The policy is not a secret; the
 * token's existence is (`D58`). Checking the non-revealing thing first keeps the
 * revealing thing from ever being observed through a policy-shaped error.
 *
 * ## Why the argon2 hash happens here and not inside the transaction
 *
 * Because argon2 is expensive and holds memory. Hashing inside the claim's
 * transaction would hold a row lock for the duration of a KDF, turning every
 * concurrent claim into a queue behind the slowest thing in the request. Hashing
 * first also means a hash failure costs nothing, since nothing has been written.
 * See `IBootstrapClaimRepository`.
 *
 * ## Why these are typed errors and not return values
 *
 * `AGENTS.md` 8: typed domain errors, never swallowed. A discriminated result would
 * have to be checked at every call site, and a forgotten branch is a silent
 * fall-through into the claim. A thrown error cannot be ignored by accident, and
 * the controller maps each class to exactly one HTTP status — which is what makes
 * "forged and expired are indistinguishable" true at the wire as well as in the
 * type.
 */

/** No token has ever been issued here. 404: this deployment does not advertise. */
export class SetupUnenrolledError extends Error {
  constructor() {
    super(
      'Not found. This deployment has no setup token outstanding, so there is nothing to ' +
        'complete. (D58: the 404 is a property of DEPLOYMENT STATE, not of the token.)',
    );
    this.name = 'SetupUnenrolledError';
  }
}

/**
 * The presented token is not acceptable: expired, forged, or already superseded.
 *
 * **One class for both causes, deliberately.** D58 scopes non-revelation to within
 * an enrolled deployment, where an expired token and a forged one must be
 * indistinguishable. One class maps to one status and one message, so they cannot
 * be told apart by anything downstream.
 */
export class SetupTokenInvalidError extends Error {
  constructor() {
    super(
      'That setup token is not valid. It may have expired, or it may never have been issued to ' +
        'this deployment. The two are deliberately indistinguishable (D58).',
    );
    this.name = 'SetupTokenInvalidError';
  }
}

/** The one claim is already made, or this request lost the race for it. 409. */
export class SetupAlreadyClaimedError extends Error {
  constructor() {
    super(
      'This deployment has already been claimed. The one-time setup token has been spent, and a ' +
        'deployment has exactly one first administrator.',
    );
    this.name = 'SetupAlreadyClaimedError';
  }
}

/**
 * The password failed the policy, and **nothing was spent**.
 *
 * Carries the refusal CODE and never the candidate (`AGENTS.md` 2.13), and that is
 * the only field on the instance — so a log line about this error cannot leak the
 * password even by accident.
 */
export class PasswordRefusedError extends Error {
  constructor(readonly refusal: PasswordPolicyRefusal) {
    super(
      `That password does not meet this deployment's policy (${refusal}). The setup token has ` +
        'NOT been spent, so you can simply try again.',
    );
    this.name = 'PasswordRefusedError';
  }
}

export interface CompleteFirstAdministratorSetupDeps {
  /** The atomic pair: spend the token and write the credential, together. */
  readonly claims: IBootstrapClaimRepository;
  /** Used for `verify` only — a read. `consume` is deliberately never called. */
  readonly tokens: SetupTokenService;
  readonly hasher: IPasswordHasher;
  readonly clock: IClock;
  /** The provisional policy. See `password-policy.ts` for why it is one. */
  readonly policy: PasswordPolicy;
  /** This school's argon2id cost parameters. Never defaulted (`ADR-007`). */
  readonly hashParameters: PasswordHashParameters;
}

export class CompleteFirstAdministratorSetup {
  constructor(private readonly deps: CompleteFirstAdministratorSetupDeps) {}

  async complete(params: {
    readonly setupTokenPlaintext: string;
    readonly password: string;
    /** Optional replacements for the account's login identifiers. */
    readonly identity?: BootstrapIdentity;
  }): Promise<{ readonly userId: string }> {
    const { tokens, claims, hasher, clock } = this.deps;

    // ── 1. The password policy. Cheapest check, and first on purpose. ────────
    // Before the token, so a weak password cannot be used to learn the token's
    // status. See the header.
    const acceptance = decidePasswordAcceptance(params.password, this.deps.policy);
    if (!acceptance.accepted) throw new PasswordRefusedError(acceptance.refusal);

    // ── 2. The token verdict. A READ; mutates nothing by contract. ───────────
    const verdict = await tokens.verify(params.setupTokenPlaintext);

    switch (verdict.action) {
      case 'reject-unclaimed':
        throw new SetupUnenrolledError();
      case 'reject-invalid':
        throw new SetupTokenInvalidError();
      case 'reject-consumed':
        throw new SetupAlreadyClaimedError();
      case 'accept':
        break;
    }

    // ── 3. Hash. Expensive, irreversible-free, and still writes nothing. ─────
    const now = clock.now();
    const hashed = await hasher.hash(params.password, this.deps.hashParameters);

    // ── 4. The claim. One transaction, the only irreversible step. ───────────
    const outcome = await claims.claim({
      setupTokenPlaintext: params.setupTokenPlaintext,
      credential: {
        passwordHash: hashed.hash,
        passwordAlgorithm: hashed.algorithm,
        now,
      },
      now,
      // Conditional spread: `exactOptionalPropertyTypes` is on, and an absent
      // optional is not the same as an explicit `undefined`.
      ...(params.identity !== undefined ? { identity: params.identity } : {}),
    });

    // Losing this race and finding the token already claimed are the same
    // situation — "too late" — and the loser cannot tell which it was. See
    // `SetupAlreadyClaimedError`.
    if (!outcome.claimed) throw new SetupAlreadyClaimedError();

    return { userId: outcome.userId };
  }
}
