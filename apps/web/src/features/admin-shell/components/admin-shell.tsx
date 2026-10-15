import type { ReactNode } from 'react';

export interface AdminShellProps {
  readonly children?: ReactNode;
  readonly sidebar?: ReactNode;
  readonly locale?: string;
}

export function AdminShell({ children, sidebar, locale: _locale }: AdminShellProps) {
  return (
    <div className="shell">
      {sidebar}
      <main className="main" data-testid="admin-main">
        {children}
      </main>
    </div>
  );
}
