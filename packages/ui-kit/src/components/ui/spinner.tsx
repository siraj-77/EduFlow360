import type { SVGProps } from 'react';

import { cn } from '../../lib/cn';

/**
 * The busy indicator.
 *
 * ## Two deliberate departures from shadcn's `spinner`
 *
 * **1. It is decorative, not `role="status"`.** shadcn's version ships
 * `role="status" aria-label="Loading"`, which is right for a spinner that is
 * the *only* signal a region is loading. Inside a submit button it is not: the
 * button already swaps its own label to the in-progress wording and carries
 * `aria-busy`, so a status region announces "Loading" *on top of* "Signing
 * in..." and the two fight. This component therefore matches `Skeleton` and
 * `ChevronIcon` and is `aria-hidden` - the STATE lives on the control that
 * owns it, which is the only place that knows what is happening. A caller that
 * genuinely needs an announced spinner wraps it in its own live region; that is
 * a decision about the caller's content, not about a glyph.
 *
 * **2. The glyph is drawn here rather than imported from `lucide-react`.**
 * shadcn's implementation is `<LoaderIcon />` from lucide, and this workspace
 * has no lucide dependency on purpose - see `icons.tsx`, which carries the
 * reasoning and the RTL rule every glyph in this package obeys. Two opposing
 * arcs read as a spinner unambiguously and cost eight bytes of path data.
 *
 * ## Reduced motion
 *
 * `motion-reduce:hidden` rather than a slower spin. The global rule in
 * `styles.css` already collapses every animation duration to `0.01ms` under
 * `prefers-reduced-motion`, which would leave a spinner visibly FROZEN - and a
 * frozen spinner reads as a broken control, which is a worse outcome than no
 * spinner. Removing it instead leaves the button label carrying the whole state,
 * which is what a screen-reader user was reading anyway.
 *
 * `motion-safe:` on the animation is belt and braces for the same reason: the
 * class pair states the intent at the call site rather than relying on a
 * distant media query to cancel it.
 */
export function Spinner({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      className={cn('motion-safe:animate-spin motion-reduce:hidden', className)}
      {...props}
    >
      {/* Two opposing arcs rather than a dashed ring: a dash pattern reads as a
          texture at small sizes, an arc pair reads as rotation. */}
      <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" />
      <path d="M12 20.5A8.5 8.5 0 0 1 3.5 12" />
    </svg>
  );
}
