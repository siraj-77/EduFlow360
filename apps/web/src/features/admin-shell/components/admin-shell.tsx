import type { ReactNode } from 'react';

export interface AdminShellProps {
  readonly children?: ReactNode;
  readonly locale?: string;
}

export function AdminShell({ children, locale: _locale }: AdminShellProps) {
  return <div className="shell">{children}</div>;
}
