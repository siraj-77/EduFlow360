export interface AdminKpiCardProps {
  readonly title: string;
  readonly value: string | number;
  readonly subtitle?: string;
  readonly tone?: 'neutral' | 'positive' | 'negative';
  readonly testId?: string;
}

export function AdminKpiCard({ title, value, subtitle, tone = 'neutral', testId }: AdminKpiCardProps) {
  return (
    <article className={`admin-kpi-card tone-${tone}`} data-testid={testId ?? 'admin-kpi-card'}>
      <div className="admin-kpi-card-label">{title}</div>
      <strong className="admin-kpi-card-value">{value}</strong>
      {subtitle != null ? <small className="admin-kpi-card-caption">{subtitle}</small> : null}
    </article>
  );
}
