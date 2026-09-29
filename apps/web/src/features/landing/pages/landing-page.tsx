import { CapabilityStrip } from '../components/capability-strip';
import { FeatureGrid } from '../components/feature-grid';
import { Hero } from '../components/hero';
import { SiteFooter } from '../components/site-footer';

/**
 * The landing page.
 *
 * Built from `docs/template/EduFlow — Frontend Template.html`: its section
 * order, its gradient-accented heading, its capability strip and its feature
 * grid. Not its copy. `AGENTS.md` 2.8 is explicit about the difference —
 *
 *   "Take the i18n, RTL and tokens. Do not take the marketing claims —
 *    'Trusted by 200+ schools' and '1.2M Students Managed' are false, and
 *    'Start Free Trial' contradicts a per-school deployment sold on editions."
 *
 * — and the fourth template feature, "Mobile for Everyone", contradicts D5 and
 * ADR-005, which put `apps/mobile` in milestone 2. The e2e suite in
 * `apps/web/tests/e2e/shell.spec.ts` asserts every one of those strings is
 * absent, so a later edit that restores one fails the build rather than
 * quietly shipping a false claim.
 *
 * Every string on this page is a translation key. There is no user-facing
 * literal in this file (AGENTS.md 2.8), and the four locales carry identical
 * key sets, enforced by `packages/i18n-resources`.
 */
export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1">
        <Hero />
        <CapabilityStrip />
        <FeatureGrid />
      </main>
      <SiteFooter />
    </div>
  );
}
