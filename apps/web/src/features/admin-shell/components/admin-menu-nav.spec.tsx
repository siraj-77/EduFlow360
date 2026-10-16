import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminMenuNav } from './admin-menu-nav';

describe('AdminMenuNav', () => {
  it('renders the permission-filtered children passed to it', () => {
    const menu = [
      {
        id: 'dashboard',
        labelKey: 'dashboard',
        permission: 'ADMIN_CONSOLE_ACCESS',
        children: [
          { id: 'general', labelKey: 'general', permission: 'SETUP_READ', children: [] },
          { id: 'users', labelKey: 'users', permission: null, children: [] }
        ]
      }
    ];

    render(<AdminMenuNav items={menu} granted={new Set(['ADMIN_CONSOLE_ACCESS', 'SETUP_READ'])} renderLabel={(key) => key} />);

    expect(screen.getByTestId('admin-menu-nav')).toBeInTheDocument();
    expect(screen.getAllByTestId('admin-menu-id')).toHaveLength(3);
  });
});
