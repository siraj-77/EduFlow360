import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

/**
 * Card. `data-slot` on every part, because that is how a caller finds a
 * sub-part without a wrapper div and without a fragile class selector.
 *
 * Radius comes from `--radius-card` and the shadow from `--shadow`, which is a
 * PAIRED token: a light tint over a light surface, near-black over a dark one.
 * A single shadow value would be correct in one theme and invisible in the
 * other.
 */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="card"
      className={cn(
        'rounded-card border border-border bg-surface text-text shadow-[var(--shadow)]',
        className,
      )}
      {...props}
    />
  );
});

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="card-header"
        className={cn('flex flex-col gap-1.5 p-6', className)}
        {...props}
      />
    );
  },
);

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <h3
        ref={ref}
        data-slot="card-title"
        className={cn('text-lg font-semibold text-text', className)}
        {...props}
      />
    );
  },
);

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      data-slot="card-description"
      className={cn('text-sm text-muted', className)}
      {...props}
    />
  );
});

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return (
      <div ref={ref} data-slot="card-content" className={cn('p-6 pt-0', className)} {...props} />
    );
  },
);

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="card-footer"
        className={cn('flex items-center gap-2 p-6 pt-0', className)}
        {...props}
      />
    );
  },
);
