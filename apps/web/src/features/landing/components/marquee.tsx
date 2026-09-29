import { getTranslations } from 'next-intl/server';

/**
 * The scrolling module marquee.
 *
 * The track renders the list TWICE and translates by -50%, so the second copy
 * arrives exactly as the first leaves and the loop has no seam. The e2e suite
 * asserts both halves are present, because a single copy produces a visible
 * jump at the wrap point that no unit test would catch.
 *
 * The module names are reused from `nav.*` rather than authored as new keys.
 * They are already translated in all four locales, they are real module areas
 * from the Master Plan, and reusing them means the marquee cannot introduce a
 * key that the parity suite has not already checked.
 *
 * Under `dir="rtl"` the animation direction is reversed — the single
 * `[dir="rtl"]` rule in `landing.css`, and the only one that could not be
 * avoided. `translateX` is physical; a right-to-left reading order runs the
 * other way.
 */
export async function Marquee() {
  const t = await getTranslations('nav');

  const modules = ['academics', 'attendance', 'finance', 'students', 'staff', 'settings'] as const;

  return (
    <div className="landing-marquee">
      <p className="label">{(await getTranslations('landing'))('marqueeLabel')}</p>

      <div data-testid="marquee-track" className="landing-marquee-track" aria-hidden="true">
        {[0, 1].map((half) => (
          <div key={half} style={{ display: 'contents' }}>
            {modules.map((key) => (
              <span key={`${half}-${key}`} data-testid="marquee-item">
                {t(key)}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* The track is decorative and hidden from assistive tech, so the list is
          repeated once as readable text. A screen reader should hear the module
          list once, not twelve times, nor nothing at all. */}
      <ul className="sr-only">
        {modules.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
    </div>
  );
}
