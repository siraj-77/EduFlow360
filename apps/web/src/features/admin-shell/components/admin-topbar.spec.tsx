import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminTopBar } from './admin-topbar';

describe('AdminTopBar', () => {
  it('renders search input and toggle', () => {
    render(<AdminTopBar searchPlaceholder="find" />);
    expect(screen.getByTestId('admin-topbar')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('find')).toBeInTheDocument();
  });
});
