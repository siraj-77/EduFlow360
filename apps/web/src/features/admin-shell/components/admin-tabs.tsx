import type { ReactNode } from 'react';

import { Button } from '@eduflow/ui-kit';

export interface AdminTab {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface AdminTabsProps {
  readonly tabs: readonly AdminTab[];
  readonly activeId: string;
  readonly onChange: (id: string) => void;
  readonly children?: ReactNode;
}

export function AdminTabs({ tabs, activeId, onChange, children }: AdminTabsProps) {
  return (
    <div className="admin-tabs" data-testid="admin-tabs">
      {tabs.map((tab) => (
        <Button
          type="button"
          key={tab.id}
          className={`admin-tab ${activeId === tab.id ? 'admin-tab-active' : ''}`}
          disabled={tab.disabled}
          onClick={() => onChange(tab.id)}
          aria-pressed={tab.id === activeId}
        >
          {tab.label}
        </Button>
      ))}
      <div className="admin-tabs-children">{children}</div>
    </div>
  );
}
