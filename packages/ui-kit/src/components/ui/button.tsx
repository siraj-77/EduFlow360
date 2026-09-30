import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

/**
 * The shadcn Button, bound to EduFlow's tokens.
 *
 * This file is inside `components/ui/`, so the `AGENTS.md` 3.2.1 raw-element
 * ban does not apply here - the ban's own message points a developer at this
 * component, and a component that cannot render a `<button>` is not one. The
 * exemption is scoped to this directory, is re-declared in
 * `packages/config/eslint/next.js` so it survives a lint run from either
 * working directory, and **still enforces 3.2.5's colour ban** - a test in
 * `apps/web/src/config/ui-primitive-rules.spec.ts` asserts that.
 *
 * Every colour is a token. `text-white` would have passed the hex-literal lint
 * and still been a hard-coded colour, which is why `--on-brand` and friends
 * exist.
 *
 * The 44px floor comes from `--touch-target-min` and not from a literal, so
 * changing the token changes every control at once. A test asserts the literal
 * is absent, because a hard-coded 44px satisfies the floor today and diverges
 * silently the first time the token moves.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium ' +
    'transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)] ' +
    // AGENTS.md 3.2.2: the floor is on every interactive surface. Not a
    // suggestion and not 44px literally.
    'min-h-[var(--touch-target-min)] px-4 py-2 ' +
    // A disabled control must still be announced as disabled, and the
    // transition must not run for someone who asked for less motion.
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        brand: 'bg-brand text-on-brand hover:bg-brand-2',
        default: 'bg-surface text-text border border-border hover:bg-bg',
        danger: 'bg-danger text-on-danger',
        ghost: 'bg-transparent text-text hover:bg-bg',
        link: 'bg-transparent text-brand underline underline-offset-4 hover:no-underline',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child instead of a `<button>`, keeping the styling. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
});

export { buttonVariants };
