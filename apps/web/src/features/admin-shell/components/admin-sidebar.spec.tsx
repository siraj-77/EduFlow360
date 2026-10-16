import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminSidebar } from './admin-sidebar';

describe('AdminSidebar', () => {
  it('renders only console-gated items without deeper permissions', () => {
    render(<AdminSidebar granted={new Set(['ADMIN_CONSOLE_ACCESS'])} renderLabel={(key) => key} />);

    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument();
    expect(screen.getAllByTestId('admin-menu-id')).toHaveLength(2);
  });

  it('renders nested items when their permissions are granted', () => {
    render(
      <AdminSidebar
        granted={new Set(['ADMIN_CONSOLE_ACCESS', 'SETUP_READ', 'USER_ADMIN'])}
        renderLabel={(key) => key}
      />,
    );

    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument();
    expect(screen.getAllByTestId('admin-menu-id')).toHaveLength(4);
  });
});
