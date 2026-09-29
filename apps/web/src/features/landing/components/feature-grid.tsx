import { getTranslations } from 'next-intl/server';

/**
 * The four feature cards.
 *
 * Three are carried across from the template, because they describe modules that
 * are genuinely scoped. The fourth is not: the template advertised "Mobile for
 * Everyone", and `apps/mobile` is milestone 2 by D5 and ADR-005. Advertising a
 * feature that is deliberately deferred is the same class of error as
 * advertising a user count that does not exist, so it is replaced with
 * something true today — the append-only audit trail, specified in the Prisma
 * schema and in `prisma/hardening/audit-immutability.sql`.
 *
 * The glyphs are decorative, so they are `aria-hidden` and the heading carries
 * the meaning.
 *
 * `data-testid` is a test contract, not decoration: four is asserted because a
 * dropped or duplicated card changes what the product claims to do, and nothing
 * else in the repository would notice.
 */
export async function FeatureGrid() {
  const t = await getTranslations('landing');

  const features = [
    { icon: '📋', heading: 'f1h', body: 'f1p' },
    { icon: '💰', heading: 'f2h', body: 'f2p' },
    { icon: '🎓', heading: 'f3h', body: 'f3p' },
    { icon: '🛡️', heading: 'f4h', body: 'f4p' },
  ] as const;

  return (
    <section id="features" className="landing-features">
      {features.map((feature) => (
        <article key={feature.heading} data-testid="feature" className="landing-card">
          <div className="ico" aria-hidden="true">
            {feature.icon}
          </div>
          <h3>{t(feature.heading)}</h3>
          <p>{t(feature.body)}</p>
        </article>
      ))}
    </section>
  );
}
