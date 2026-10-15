export interface AdminCardRowProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly children?: React.ReactNode;
}

export function AdminCardRow({ title, subtitle, children }: AdminCardRowProps) {
  return (
    <div className="admin-card-row">
      <div className="admin-card-row-main">
        <strong className="admin-card-row-title">{title}</strong>
        {subtitle != null ? <small className="admin-card-row-subtitle">{subtitle}</small> : null}
      </div>
      {children}
    </div>
  );
}
