import { describe, expect, it } from 'vitest';

import { filterMenu, type MenuPermissionSet } from './menu';

describe('filterMenu', () => {
  it('keeps only items whose permission is granted', () => {
    const granted: MenuPermissionSet = new Set(['ADMIN_CONSOLE_ACCESS']);
    const menu = [
      { id: 'dashboard', permission: 'ADMIN_CONSOLE_ACCESS', labelKey: 'dashboard' },
      { id: 'finance', permission: 'FINANCE_READ', labelKey: 'finance' }
    ];

    const result = filterMenu(menu, granted);
    expect(result.map((entry) => entry.id)).toEqual(['dashboard']);
  });

  it('drops children whose parent or own permission is missing', () => {
    const granted: MenuPermissionSet = new Set(['ADMIN_CONSOLE_ACCESS']);
    const menu = [
      {
        id: 'setup',
        permission: 'ADMIN_CONSOLE_ACCESS',
        labelKey: 'setup',
        children: [
          { id: 'general', permission: 'SETUP_READ', labelKey: 'general' },
          { id: 'users', permission: null, labelKey: 'users' }
        ]
      }
    ];

    const result = filterMenu(menu, granted);
    expect(result.map((entry) => entry.id)).toEqual(['setup']);
    expect(result[0].children?.map((entry) => entry.id)).toEqual(['users']);
  });
});
