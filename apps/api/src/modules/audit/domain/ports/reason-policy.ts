/**
 * The port for "does this action require a reason" (`PLT-402` T2).
 *
 * Split from `domain/services/reason-policy.ts` so the DI token lives where
 * every other token in this repository lives — beside the interface it
 * resolves, in `domain/ports/`. `common/interceptors/` imports the token and
 * the type from here and the default implementation not at all.
 */

/** DI token. A symbol because an `interface` has no runtime value to resolve against. */
export const IREASON_POLICY = Symbol('IReasonPolicy');

export interface IReasonPolicy {
  /** Does the record for `action` require a reason the caller must supply? */
  isReasonRequired(action: string): boolean;
}
