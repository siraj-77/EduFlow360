import { Module } from '@nestjs/common';

import { AdminController } from './controllers/admin.controller.js';

/**
 * `AdminModule` — the console's routes, and nothing else.
 *
 * ## Why it is a module of its own
 *
 * `PLT-1002` AC-4 requires the API to enforce `ADMIN_CONSOLE_ACCESS`
 * independently of the web guard, and the permission belongs to the
 * console rather than to auth or to RBAC: `RbacModule` owns the
 * permission MACHINERY (the catalogue, the roles, the reader) and the
 * console owns the ROUTES that carry the key. Giving the console its
 * own module is also what `PLT-1005` extends when the shell's data
 * routes arrive, rather than growing an unrelated module.
 *
 * ## Why it has no `forRoot`, no providers and no `PrismaClient`
 *
 * It reads nothing and writes nothing. The only thing it contributes is
 * a controller whose guards run — `SessionGuard` for the 401 and the
 * globally-registered `PermissionGuard` for the 403 — so there is no
 * implementation to select from configuration and no pool to own. A
 * module with a factory that returns a constant would be ceremony, and
 * `AGENTS.md` 2.2's Interface Segregation point is that a thing should
 * be exactly as wide as its job.
 *
 * Its controller is registered unconditionally (see that file for why
 * the database-less branch answers 403 here, where `RbacModule`'s
 * answers 404 for its own controller).
 */
@Module({
  controllers: [AdminController],
})
export class AdminModule {}
