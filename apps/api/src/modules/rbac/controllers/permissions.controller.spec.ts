import { describe, expect, it } from 'vitest';
import { PermissionsController } from './permissions.controller.js';
import type { ReadMyPermissions, MyPermissions } from '../use-cases/read-my-permissions.js';
import type { PrincipalCarrier } from '../../../common/guards/session.guard.js';
import type { RequestWithAddress } from '../../../common/http/request-context.js';
import { PERMISSION_KEY } from '../../../common/guards/route-guards.decorator.js';
import { Reflector } from '@nestjs/core';

/**
 * `GET /permissions/me` — the route `PLT-204` reads its permission set from.
 *
 * ## Why the controller is constructed directly
 *
 * `@Inject` metadata is inert without a Nest application context, so a unit
 * test constructs the controller with a double and asserts the handler's own
 * behaviour: which account it reads for, and what it answers. The wiring —
 * that the use-case is registered and the route is gated — is proved by
 * `rbac.module.spec.ts` and `permissions-over-http.integration.spec.ts`.
 *
 * ## What the metadata assertion adds
 *
 * `Reflect.getMetadata(PERMISSION_KEY, handler)` reads the
 * `@RequirePermission('PERMISSION_READ_OWN')` the decorator wrote, so a route
 * that lost its decorator — or gained the wrong key — fails here rather than
 * only at `check-route-guards` (which scans source text and would not catch a
 * decorator applied to the wrong method).
 */

const USER_ID = '6f1b0c1a-2f3b-4c5d-8e9f-0a1b2c3d4e5f';

/** A recording double for the use-case. */
class FakeReadMyPermissions {
  calls: string[] = [];

  async read(params: { userId: string }): Promise<MyPermissions> {
    this.calls.push(params.userId);
    return { permissions: ['PERMISSION_READ_OWN'] };
  }
}

/** The request shape the handler declares: what `SessionGuard` wrote to. */
type PermissionsRequest = RequestWithAddress & PrincipalCarrier;

const aRequest = (principal?: { userId: string }): PermissionsRequest =>
  ({ principal }) as unknown as PermissionsRequest;

const aController = (): { controller: PermissionsController; useCase: FakeReadMyPermissions } => {
  const useCase = new FakeReadMyPermissions();
  // The cast is the seam: the double satisfies the shape the handler calls,
  // and the handler cannot tell it from the real use-case.
  const controller = new PermissionsController(useCase as unknown as ReadMyPermissions);
  return { controller, useCase };
};

describe('PermissionsController', () => {
  it('answers with the use-case result for the signed-in caller', async () => {
    const { controller, useCase } = aController();

    const result = await controller.myPermissions(aRequest({ userId: USER_ID }));

    expect(result).toEqual({ permissions: ['PERMISSION_READ_OWN'] });
    expect(useCase.calls).toEqual([USER_ID]);
  });

  it('reads the account from the principal, and from nowhere else', async () => {
    // The request carries no userId parameter and no query string: the account
    // is what SessionGuard resolved, so a caller cannot ask for another
    // account's permission set.
    const { controller, useCase } = aController();

    await controller.myPermissions(aRequest({ userId: USER_ID }));

    expect(useCase.calls).toEqual([USER_ID]);
  });

  it('throws when no principal is present, rather than answering for nobody', async () => {
    const { controller, useCase } = aController();

    await expect(controller.myPermissions(aRequest())).rejects.toThrow(
      'No principal on this request.',
    );

    expect(useCase.calls).toEqual([]);
  });

  it('carries the PERMISSION_READ_OWN requirement on the handler', () => {
    // The decorator wrote metadata; read it back. A handler that lost the
    // decorator would be an ungated route that looks gated.
    const metadata = new Reflector().get<string>(
      PERMISSION_KEY,
      PermissionsController.prototype.myPermissions,
    );

    expect(metadata).toBe('PERMISSION_READ_OWN');
  });
});
