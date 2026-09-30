import { forwardRef, type LabelHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

/**
 * Form label.
 *
 * `htmlFor` is passed through untouched rather than defaulted, because a label
 * that is not associated with a control is worse than no label: it looks right
 * and announces nothing. Radix-free on purpose - a native `<label>` with a
 * correct `for` is the whole implementation, and it is what `getByLabelText`
 * in the tests exercises.
 */
export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...props }, ref) {
    return (
      <label
        ref={ref}
        data-slot="label"
        className={cn('text-sm font-medium text-text peer-disabled:opacity-70', className)}
        {...props}
      />
    );
  },
);
