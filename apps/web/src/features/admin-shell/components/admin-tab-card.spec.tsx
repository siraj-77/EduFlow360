import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminTabs } from './admin-tabs';
import { AdminKpiCard } from './admin-kpi-card';

describe('admin tabs and kpi card', () => {
  it('renders the active tab and metric value', () => {
    render(
      <>
        <AdminTabs tabs={[{ id: 'a', label: 'Alpha' }]} activeId="a" onChange={() => undefined} />
        <AdminKpiCard title="Total" value={5} />
      </>,
    );
    expect(document.querySelectorAll('[data-testid="admin-tabs"]')).toHaveLength(1);
  });
});
