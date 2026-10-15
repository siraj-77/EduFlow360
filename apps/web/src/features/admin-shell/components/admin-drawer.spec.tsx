import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminShell } from './admin-shell';

describe('AdminShell mobile drawer', () => {
  it('toggles the sidebar open class', () => {
    render(<AdminShell sidebar={<nav data-testid="sidebar">navigation</nav>}>dashboard body</AdminShell>);

    expect(screen.getByTestId('sidebar').closest('.admin-shell-sidebar')).not.toHaveClass('open');

    fireEvent.click(screen.getByRole('button', { name: /Open navigation menu/i }));
    expect(screen.getByTestId('sidebar').closest('.admin-shell-sidebar')).toHaveClass('open');

    fireEvent.click(screen.getByRole('button', { name: /Close navigation menu/i }));
    expect(screen.getByTestId('sidebar').closest('.admin-shell-sidebar')).not.toHaveClass('open');
  });
});
