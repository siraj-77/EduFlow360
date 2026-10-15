'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import { Button } from '@eduflow/ui-kit';

import '../admin-shell.css';

export interface AdminShellProps {
  readonly children?: ReactNode;
  readonly sidebar?: ReactNode;
  readonly topbar?: ReactNode;
  readonly locale?: string;
  readonly menuLabel?: string;
  readonly closeLabel?: string;
}

export function AdminShell({ children, sidebar, topbar, menuLabel = 'Open navigation menu', closeLabel = 'Close navigation menu' }: AdminShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="admin-shell" data-testid="admin-shell">
      <aside className={`admin-shell-sidebar ${open ? 'open' : 'closed'}`}>{sidebar}</aside>

      <div className="admin-main-region">
        <div className="admin-topbar">
          <Button type="button" variant="ghost" aria-label={menuLabel} onClick={() => setOpen(true)}>
            ☰
          </Button>
          {topbar}
          <Button type="button" className={`scrim ${open ? 'show' : ''}`} variant="ghost" aria-label={closeLabel} onClick={() => setOpen(false)} />
        </div>

        <main className="admin-main" data-testid="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
