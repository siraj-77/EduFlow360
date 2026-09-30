import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-control border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-border bg-bg text-muted',
        brand: 'border-transparent bg-brand text-on-brand',
        danger: 'border-transparent bg-danger text-on-danger',
        ok: 'border-transparent bg-ok text-on-brand',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
