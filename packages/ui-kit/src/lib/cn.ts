import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * The shadcn class-merge helper.
 *
 * `clsx` handles conditionals; `tailwind-merge` resolves Tailwind conflicts so
 * a caller-supplied class can override a component's default. Without the
 * second half, `cn('px-2', 'px-4')` emits both and the result depends on
 * stylesheet order, which makes "the consumer can override this" untrue.
 *
 * Every primitive composes its classes through this, so overriding a variant
 * is a documented capability rather than an accident.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
