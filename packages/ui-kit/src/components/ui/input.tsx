import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

/**
 * Text input. The 44px floor applies: a form field is as reachable as a
 * button, and on a phone it is the control a parent uses most.
 *
 * `aria-invalid` gets a danger border rather than only a colour change, because
 * a red outline that is the *only* signal is invisible to a colour-blind user
 * and to a screen reader.
 */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          'flex w-full min-h-[var(--touch-target-min)] rounded-control border border-border bg-surface px-3 py-2',
          'text-text placeholder:text-muted',
          'transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-danger aria-invalid:focus-visible:outline-danger',
          className,
        )}
        {...props}
      />
    );
  },
);
