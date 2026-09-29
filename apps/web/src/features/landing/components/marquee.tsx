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
 * avoided. `translateX` is a physical transform; a right-to-left reading order
 * runs the other way.
 *
 * TWO HALVES, EXPLICITLY WRAPPED rather than flattened with
 * `display: contents`. `display: contents` made each half disappear as a box,
 * which meant the reduced-motion fallback in `landing.css` had nothing to hide.
 * A cancelled animation left a `width: max-content` strip inside an
 * `overflow: hidden` holder — a row of words with the first and last sliced off
 * at the viewport edges, which reads as a layout fault rather than as a
 * considered degradation. The halves need to be addressable boxes so the
 * fallback can drop the duplicate and let the rest wrap.
 *
 * The animated track is `aria-hidden`, and the list is repeated once in an
 * `sr-only` element for assistive tech. A screen reader hears the six modules
 * once, not twelve times, and not while they slide past.
 */
export async function Marquee() {
  const t = await getTranslations('nav');

  const modules = ['academics', 'attendance', 'finance', 'students', 'staff', 'settings'] as const;

  return (
    <div className="landing-marquee">
      <p className="label">{(await getTranslations('landing'))('marqueeLabel')}</p>

      <div data-testid="marquee-track" className="landing-marquee-track" aria-hidden="true">
        {[0, 1].map((half) => (
          <div key={half} className="landing-marquee-half" data-half={half}>
            {modules.map((key) => (
              <span key={`${half}-${key}`} data-testid="marquee-item">
                {t(key)}
              </span>
            ))}
          </div>
        ))}
      </div>

      <ul className="sr-only">
        {modules.map((key) => (
          <li key={key}>{t(key)}</li>
        ))}
      </ul>
    </div>
  );
}
