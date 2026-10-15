import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminShell } from './admin-shell';

describe('AdminShell', () => {
  it('exports the shell component', () => {
    expect(AdminShell).toBeDefined();
  });

  it('renders the sidebar and the main region with its children', () => {
    render(<AdminShell sidebar={<nav data-testid="sidebar">menu</nav>}>dashboard body</AdminShell>);

    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('admin-main')).toHaveTextContent('dashboard body');
  });
});
