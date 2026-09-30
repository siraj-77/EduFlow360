/**
 * The two glyphs the primitives need, inline.
 *
 * Not a dependency. `lucide-react` is not declared anywhere in this workspace,
 * and AGENTS.md 3.2.6 requires directional icons to mirror under RTL - which
 * means the mirror has to be provably correct and testable, not inherited from
 * a package whose default is `LTR-only`. Two 24x24 paths do not justify a
 * runtime dependency or a second place for the RTL decision to be wrong.
 *
 * `ChevronIcon` rotates 180 degrees under RTL so it keeps pointing "the way
 * the popup will go". `CheckIcon` is not directional and does not mirror.
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
      className={className}
    >
      {/* 3.2.6 - mirrored so the chevron agrees with the RTL text direction. */}
      <path d="m6 9 6 6 6-6" className="rtl:rotate-180" />
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
      className={className}
    >
      <path d="m18 15-6-6-6 6" className="rtl:rotate-180" />
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
