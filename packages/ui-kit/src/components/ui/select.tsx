import * as SelectPrimitive from '@radix-ui/react-select';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';

import { cn } from '../../lib/cn';
import { CheckIcon, ChevronIcon, ChevronUpIcon } from './icons';

/**
 * Select, on Radix.
 *
 * Exists because AGENTS.md 3.2.1 bans a raw `<select>`, which would otherwise
 * make the rule unsatisfiable for any school that needs a picker - language,
 * class, currency, staff role. A compliant target is what turns a ban into a
 * constraint.
 *
 * Radix rather than a styled native `<select>` because the native element
 * cannot be styled consistently across the four locales, cannot show the
 * multi-line labels the school data needs, and offers no control over the
 * popup. The trade-off is that this is a listbox, so the roving-tabindex and
 * typeahead behaviour is Radix's job rather than ours - which is the point.
 *
 * The chevrons are decorative, so they are `aria-hidden` and the trigger keeps
 * the accessible name the caller gave it.
 */
export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(function SelectTrigger({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      data-slot="select-trigger"
      className={cn(
        'flex w-full min-h-[var(--touch-target-min)] items-center justify-between gap-2',
        'rounded-control border border-border bg-surface px-3 py-2 text-text',
        'transition-colors duration-[var(--motion-fast)] ease-[var(--motion-ease)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[placeholder]:text-muted',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronIcon className="size-4 shrink-0 opacity-70" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, position = 'popper', ...props }, ref) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        data-slot="select-content"
        position={position}
        className={cn(
          'relative z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-y-auto',
          'rounded-card border border-border bg-surface text-text shadow-[var(--shadow)]',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
          <ChevronUpIcon className="size-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
          <ChevronIcon className="size-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      data-slot="select-item"
      className={cn(
        'flex min-h-[var(--touch-target-min)] cursor-default select-none items-center gap-2',
        'rounded-control px-2 py-1.5 text-text outline-none',
        'data-[highlighted]:bg-bg data-[highlighted]:text-text',
        'data-[state=checked]:font-medium',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="ms-auto">
        <CheckIcon className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
});

export const SelectLabel = forwardRef<
  ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(function SelectLabel({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn('px-2 py-1.5 text-xs text-muted', className)}
      {...props}
    />
  );
});

export const SelectSeparator = forwardRef<
  ElementRef<typeof SelectPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(function SelectSeparator({ className, ...props }, ref) {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
});
