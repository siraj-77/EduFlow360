import type { MenuItem } from './menu';

import { AdminMenuNav } from './admin-menu-nav';

export const ADMIN_MENU: readonly MenuItem[] = [
  {
    id: 'dashboard',
    labelKey: 'admin.console.dashboard',
    permission: 'ADMIN_CONSOLE_ACCESS',
  },
  {
    id: 'setup',
    labelKey: 'admin.console.setup',
    permission: 'ADMIN_CONSOLE_ACCESS',
    children: [
      { id: 'general', labelKey: 'admin.console.setup.general', permission: 'SETUP_READ' },
      { id: 'users', labelKey: 'admin.console.setup.users', permission: 'USER_ADMIN' },
    ],
  },
];

export interface AdminSidebarProps {
  readonly granted?: Iterable<string> | ReadonlySet<string> | null | undefined;
  readonly renderLabel?: (labelKey: string) => string;
}

export function AdminSidebar({ granted, renderLabel }: AdminSidebarProps) {
  return (
    <nav className="admin-sidebar" data-testid="admin-sidebar">
      <AdminMenuNav
        items={ADMIN_MENU}
        granted={granted}
        {...(renderLabel ? { renderLabel } : {})}
      />
    </nav>
  );
}
