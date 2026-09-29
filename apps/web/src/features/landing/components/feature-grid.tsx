import { getTranslations } from 'next-intl/server';

/**
 * The four feature blocks.
 *
 * Three are carried across from the template, because they describe modules
 * that are genuinely scoped. The fourth is not: the template advertised
 * "Mobile for Everyone", and `apps/mobile` is milestone 2 by D5 and ADR-005.
 * Advertising a feature that is deliberately deferred is the same class of
 * error as advertising a user count that does not exist, so it is replaced with
 * something true today — the append-only audit trail, which is specified in the
 * schema and in `prisma/hardening/audit-immutability.sql`.
 *
 * `data-testid` is the handle the e2e suite counts. It is a test contract, not
 * decoration: four is asserted because a dropped or duplicated feature block
 * changes what the product claims to do, and nothing else in the repository
 * would notice.
 */
export async function FeatureGrid() {
  const t = await getTranslations('landing');

  const features = [
    { heading: 'f1h', body: 'f1p', accent: 'bg-brand' },
    { heading: 'f2h', body: 'f2p', accent: 'bg-accent' },
    { heading: 'f3h', body: 'f3p', accent: 'bg-brand-2' },
    { heading: 'f4h', body: 'f4p', accent: 'bg-ok' },
  ] as const;

  return (
    <section id="features" className="mx-auto w-full max-w-5xl px-6 py-16">
      <h2 className="text-muted text-center text-sm font-semibold tracking-wide uppercase">
        {t('marqueeLabel')}
      </h2>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <li
            key={feature.heading}
            data-testid="feature"
            className="border-border bg-surface rounded-card border p-6"
          >
            <span className={`block h-1 w-10 rounded-full ${feature.accent}`} aria-hidden="true" />
            <h3 className="mt-4 text-lg font-semibold">{t(feature.heading)}</h3>
            <p className="text-muted mt-2 text-sm">{t(feature.body)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
