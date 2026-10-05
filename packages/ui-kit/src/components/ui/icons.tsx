import { cn } from '../../lib/cn';

/**
 * The glyphs the primitives need, inline.
 *
 * Not a dependency. `lucide-react` is not declared anywhere in this workspace,
 * and AGENTS.md 3.2.6 requires directional icons to mirror under RTL - which
 * means the mirror has to be provably correct and testable, not inherited from
 * a package whose default is `LTR-only`. Two 24x24 paths do not justify a
 * runtime dependency or a second place for the RTL decision to be wrong.
 *
 * ## The rule this file exists to make mechanical
 *
 * An icon in this codebase is EITHER directional or it is not, and which one
 * it is must be readable from the markup rather than from a designer's memory:
 *
 *   - DIRECTIONAL  (`ChevronIcon`, `ChevronUpIcon`, `ArrowIcon`,
 *     `ArrowBackIcon`) - it means "forwards", "backwards", "onward". Under
 *     `dir="rtl"` the reading order reverses, so the glyph rotates 180 degrees
 *     and points the way the action will actually go.
 *   - NOT DIRECTIONAL (`CheckIcon`, `EyeIcon`, `EyeOffIcon`, `AlertIcon`) -
 *     it names a thing or a state. Mirroring it would be a bug, so it carries
 *     no `rtl:` class at all. `EyeOffIcon`'s diagonal slash is deliberately
 *     excluded: a slash has no reading direction, and flipping it would make
 *     the eye look open on one side of the app and shut on the other.
 *
 * ## WHY `rtl:rotate-180` GOES ON THE `<svg>`, NOT ON THE `<path>`
 *
 * This file got it wrong once already, and the reason is worth writing down
 * because it is invisible in LTR and total in RTL.
 *
 * A CSS `rotate` / `transform` on an SVG **child element** resolves its origin
 * against the nearest SVG viewport's ORIGIN, not its centre: a `<path>` has no
 * CSS layout box, so the `50% 50%` default is `(0, 0)` in user units. Rotating
 * 180 degrees about `(0, 0)` throws the glyph clean out of its own box. Measured
 * on a chevron in an Arabic `Select`, the screen CTM came back
 * `a: -0.667, d: -0.667, e: 601, f: 586`, painting the arrow at x 588-598 while
 * the `<svg>` occupied x 601-617 - so the icon was not mirrored, it was
 * **absent**, and nothing in LTR was wrong, so it shipped green.
 *
 * `transform-box: fill-box` narrows the reference box to the element's own
 * bounding box and corrects the geometry, but it is an extra declaration on
 * every mirrored glyph to explain and to remember.
 *
 * The `<svg>` has a real CSS layout box, so `50% 50%` is the centre of its
 * `size-*` and the rotation is exact. That is the whole fix: the class moves up
 * one element. Sizing and rotation are independent, so `size-*` and any caller
 * transform are unaffected.
 *
 * The paths are 24x24 on the same grid as the originals so a caller can size
 * any of them with `size-4` and get the same optical weight.
 */

type IconProps = { className?: string };

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      // 3.2.6 - mirrored, so the chevron agrees with the RTL text direction. On
      // the `<svg>`, for the reason in the file header.
      className={cn('rtl:rotate-180', className)}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronUpIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('rtl:rotate-180', className)}
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * A right-pointing arrow. DIRECTIONAL - it means "onward" or "continue", so it
 * is the glyph most likely to be wrong under RTL and therefore one that carries
 * the `rtl:rotate-180` rule.
 *
 * The head is at the path's end rather than drawn as a separate marker so the
 * whole glyph rotates as one piece.
 */
export function ArrowIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('rtl:rotate-180', className)}
    >
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

/**
 * A left-pointing arrow: "back", "return", "previous". DIRECTIONAL, and the
 * mirror case that {@link ArrowIcon} gets wrong if there is only one of them.
 *
 * A single arrow glyph used for both directions is a bug that renders perfectly
 * and reads backwards - the shape is fine, the meaning is inverted, and no
 * visual check catches it because the icon is symmetrical about its own shaft.
 * So the direction is part of the glyph's identity: this one starts left in LTR
 * and, rotated, starts right in Arabic, which is where "back" is.
 */
export function ArrowBackIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('rtl:rotate-180', className)}
    >
      <path d="M20 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </svg>
  );
}

/** An open eye. Not directional - it names the control, it does not point. */
export function EyeIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * The hidden-eye state of {@link EyeIcon}. Not directional.
 *
 * The slash is drawn inside the same 24x24 box rather than as a separate
 * rotated overlay, and it carries no `rtl:` class: see the rule at the top of
 * this file.
 */
export function EyeOffIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.7 3.6" />
      <path d="M6.3 7.8A16.7 16.7 0 0 0 2.5 12S6 18.5 12 18.5a9.4 9.4 0 0 0 4-.9" />
      <path d="M10 10a3 3 0 0 0 4 4" />
      <path d="m3.5 3.5 17 17" />
    </svg>
  );
}

/**
 * An exclamation in a triangle. Not directional - it names a severity, and
 * severity has no reading direction.
 */
export function AlertIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 4.2 2.9 19.4a1 1 0 0 0 .87 1.5h16.46a1 1 0 0 0 .87-1.5L12 4.2Z" />
      <path d="M12 10v4" />
      <path d="M12 17.2h.01" />
    </svg>
  );
}

/**
 * A sun. Not directional - it names a state, not a direction, so it carries no
 * `rtl:` class. Rotating a sun under RTL would be a bug with no upside, and the
 * file header's rule is that the directional/non-directional split must be
 * readable from the markup rather than remembered.
 */
export function SunIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>
  );
}

/**
 * A crescent moon. Not directional, for the reason `SunIcon` gives.
 */
export function MoonIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a7 7 0 0 0 11.1 11.1Z" />
    </svg>
  );
}
