import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from 'react';

import { cn } from '../../lib/cn';

/**
 * Dialog and Sheet, on Radix.
 *
 * Radix is here for the behaviour a hand-rolled dialog gets wrong and a test
 * never catches: focus trapping, `Escape` to close, scroll locking, restoring
 * focus to the trigger, and the `aria-modal` / `role="dialog"` wiring. None of
 * that is worth reimplementing, and all of it is accessibility-critical for a
 * school deploying this to staff with assistive technology.
 *
 * `Sheet` is the same primitive with different slide edges, and the edges are
 * **logical** (`inset-inline-start` / `end`) so the mobile drawer opens from the
 * correct side in Arabic. `left-0` would open it on the wrong one.
 *
 * The raw-element ban of AGENTS.md 3.2.1 covers `<dialog>`, so this file is
 * inside the primitives exemption. Radix renders a `<div role="dialog">`, not
 * the native element, so the ban would not have caught this case anyway.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function DialogContent({ className, children, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      {/* AGENTS.md 2.13 and 3.2.7: the backdrop is a scrim, not decoration, and
          the global reduced-motion rule in styles.css covers its transition. */}
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-text/40" />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="dialog-content"
        className={cn(
          'fixed start-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
          'rounded-card border border-border bg-surface p-6 text-text shadow-[var(--shadow)]',
          'duration-[var(--motion-base)]',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="dialog-header" className={cn('flex flex-col gap-1.5', className)} {...props} />
  );
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      data-slot="dialog-title"
      className={cn('text-lg font-semibold text-text', className)}
      {...props}
    />
  );
});

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      data-slot="dialog-description"
      className={cn('text-sm text-muted', className)}
      {...props}
    />
  );
});

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

/**
 * Sheet - the mobile sidebar. AGENTS.md 3.2.1 requires the sidebar to be a
 * `Sheet` drawer on mobile and a full sidebar from `lg`.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

export type SheetSide = 'start' | 'end';

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: SheetSide }
>(function SheetContent({ className, children, side = 'start', ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-text/40" />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          'fixed inset-y-0 z-50 w-3/4 max-w-sm bg-surface p-6 text-text shadow-[var(--shadow)]',
          // Logical, so the drawer opens from the correct edge in Arabic.
          side === 'end' ? 'end-0 border-s' : 'start-0 border-e',
          'border-border',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="sheet-header" className={cn('flex flex-col gap-1.5', className)} {...props} />
  );
}

export function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2', className)}
      {...props}
    />
  );
}
