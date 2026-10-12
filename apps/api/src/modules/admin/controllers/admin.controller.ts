import { Controller, Get, HttpCode } from '@nestjs/common';

import { RequirePermission } from '../../../common/guards/route-guards.decorator.js';

/**
 * The console's API-side mirror.
 *
 * ## Why a route that returns nothing
 *
 * `PLT-1002` AC-4: *"The API enforces the same permission independently
 * of the web guard."* The web side is two UX gates — a middleware that
 * notices a missing cookie and a client wrapper that screens the
 * permission — and `AGENTS.md` 2.3 is explicit that neither is the
 * boundary. This route is the boundary's proof: `GET /admin` refuses
 * with 403 for a session that does not hold `ADMIN_CONSOLE_ACCESS`,
 * whatever the browser did or did not render, because the guard chain
 * runs before any handler.
 *
 * It is registered UNCONDITIONALLY, unlike `PermissionsController`,
 * which the `RbacModule` registers only when a permission reader
 * exists. The difference is what each route is for: a database-less
 * deployment has no staff console to open, so 403 is the honest answer
 * here, where `GET /permissions/me` would be answering a question the
 * deployment can still serve. Fail-closed in both directions
 * (`AGENTS.md` 2.3).
 *
 * ## What replaces it
 *
 * `PLT-1005` ports the shell and its data routes. Those carry the same
 * permission — every console route does — and this probe remains the
 * cheapest one to call: a shell that wants to fail fast before
 * rendering calls this, not a data route. If it ever reads as clutter,
 * the answer is to delete it and let the first data route be the
 * enforcement; the guard machinery does not depend on which route
 * carries the key.
 *
 * It is not `@Audited`: it reads no row, writes nothing, and an audit
 * row per console open would be noise in a trail that exists for
 * sensitive actions (`AGENTS.md` 2.3).
 */
@Controller('admin')
export class AdminController {
  /**
   * The console's door.
   *
   * 204, not 200 with a body: there is nothing to say. A caller who
   * reaches the handler has already passed `SessionGuard` (401
   * otherwise) and `PermissionGuard` (403 without the key), so the
   * status code is the whole answer.
   *
   * The path is `'/'` rather than a bare `@Get()` because
   * `scripts/check-route-guards.mjs` refuses to read a decorator with
   * no string argument — deliberately, so that "could not parse" never
   * looks like "the root route" — and a route the matrix cannot parse is
   * a gate that has stopped gating.
   */
  @RequirePermission('ADMIN_CONSOLE_ACCESS')
  @Get('/')
  @HttpCode(204)
  access(): void {
    // Deliberately empty. The guards are the handler.
  }
}
