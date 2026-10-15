import '../admin-shell.css';

import type { ReactNode } from 'react';

export interface AdminShellProps {
  readonly children?: ReactNode;
  readonly sidebar?: ReactNode;
  readonly topbar?: ReactNode;
  readonly locale?: string;
}

export function AdminShell({ children, sidebar, topbar, locale: _locale }: AdminShellProps) {
  return (
    <div className="admin-shell" data-testid="admin-shell">
      {sidebar}
      <div className="admin-main-region">
        {topbar}
        <main className="admin-main" data-testid="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
