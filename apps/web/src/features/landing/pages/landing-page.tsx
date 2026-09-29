import { FeatureGrid } from '../components/feature-grid';
import { Hero, TopNav } from '../components/hero';
import { Marquee } from '../components/marquee';
import { SiteFooter } from '../components/site-footer';
import '../landing.css';

/**
 * The landing page.
 *
 * Its visual language is the template's, in full: the mesh-gradient hero, the
 * grid overlay, the drifting orbs, the sheening gradient heading, the glowing
 * call to action, the product mockup, the scrolling marquee and the gradient
 * icon cards. See `landing.css` for the port and for why five of those effects
 * cannot be written as utility classes.
 *
 * Its claims are not. `AGENTS.md` 2.8, about this exact file:
 *
 *   "Take the i18n, RTL and tokens. Do not take the marketing claims —
 *    'Trusted by 200+ schools' and '1.2M Students Managed' are false, and
 *    'Start Free Trial' contradicts a per-school deployment sold on editions."
 *
 * A fifth claim the template also made, "Mobile for Everyone", contradicts D5
 * and ADR-005, which put `apps/mobile` in milestone 2. The e2e suite in
 * `apps/web/tests/e2e/shell.spec.ts` asserts every one of those strings is
 * absent, so an edit that restores one fails the build rather than quietly
 * shipping a false claim.
 *
 * Every string on this page is a translation key. There is no user-facing
 * literal in this file (AGENTS.md 2.8), and the four locales carry identical
 * key sets, enforced by `packages/i18n-resources`.
 */
export function LandingPage({ locale }: { locale: string }) {
  return (
    <div className="landing">
      <TopNav locale={locale} />
      <main>
        <Hero />
        <Marquee />
        <FeatureGrid />
      </main>
      <SiteFooter />
    </div>
  );
}
