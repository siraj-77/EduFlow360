import { Controller, Get, Inject, Req } from '@nestjs/common';
import { requirePrincipal, type PrincipalCarrier } from '../../../common/guards/session.guard.js';
import { RequirePermission } from '../../../common/guards/route-guards.decorator.js';
import type { RequestWithAddress } from '../../../common/http/request-context.js';
// A VALUE import, used by `@Inject` below — deliberately not `import type`.
// See `oidc-link.controller.ts` for the two rules that collide here and how
// the collision is resolved, and `D60` for what it costs to get it wrong:
// the deployed application cannot boot, while `tsc`, lint and the build all
// report success.
import { ReadMyPermissions, type MyPermissions } from '../use-cases/read-my-permissions.js';

/**
 * `GET /permissions/me` — the route `PLT-204` reads its permission set from.
 *
 * ## Why this route exists
 *
 * A signed-in account has to be able to ask "what can I do?" — the
 * web shell renders only the modules and actions the caller's roles
 * grant, and it cannot know which those are without an endpoint that
 * answers for the CALLER. The alternative, handing every session the
 * whole catalogue, would be both a leak of what the school has
 * configured and an oracle about what it has not.
 *
 * ## Why it is gated on `PERMISSION_READ_OWN` and not merely on a session
 *
 * A session proves authentication; it says nothing about
 * authorisation. Every system role holds this key from the first
 * seed (`system-roles.ts`), so the gate is satisfied by every
 * legitimate account — and a role that did not hold it would be
 * refused 403 rather than answered, which is the direct-API bypass
 * `PLT-205` T3 proves over a real socket in
 * `permissions-over-http.integration.spec.ts`.
 *
 * ## Why the handler reads a principal and nothing else
 *
 * `requirePrincipal` is the ONLY source of the account whose set is
 * read. There is no `?userId=` and no route parameter: a route that
 * accepted one would let a caller read any account's permission set,
 * which is the same class of bug the open redirect
 * `oidc-sign-in.controller.ts` refuses to be able to express.
 */

/**
 * What to persist about the request. The principal is there because
 * `SessionGuard` put it there; `requirePrincipal` throws rather than
 * returning `null`, so this handler has no "and if there is no caller"
 * branch to forget to check.
 */
type PermissionsRequest = RequestWithAddress & PrincipalCarrier;

@Controller('permissions')
export class PermissionsController {
  constructor(@Inject(ReadMyPermissions) private readonly readMyPermissions: ReadMyPermissions) {}

  /**
   * The signed-in caller's own permission keys, sorted ascending.
   *
   * The use-case owns the read; this handler owns only the two things
   * that are genuinely HTTP: which account is asking, and the shape of
   * the answer.
   */
  @RequirePermission('PERMISSION_READ_OWN')
  @Get('me')
  async myPermissions(@Req() request: PermissionsRequest): Promise<MyPermissions> {
    const principal = requirePrincipal(request);

    return this.readMyPermissions.read({ userId: principal.userId });
  }
}
