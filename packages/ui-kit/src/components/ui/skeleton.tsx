import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

/**
 * Loading placeholder.
 *
 * `aria-hidden`, because a screen reader announcing "skeleton" while data loads
 * is noise, not information. The busy state belongs on the region that is
 * loading, which is the caller's job and is the only place that knows what is
 * arriving.
 *
 * The pulse is neutral in colour - `bg-border` is a token and works in both
 * themes - and `prefers-reduced-motion` is handled globally in `styles.css`,
 * so this does not need its own media query.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn('animate-pulse rounded-control bg-border', className)}
      {...props}
    />
  );
}
