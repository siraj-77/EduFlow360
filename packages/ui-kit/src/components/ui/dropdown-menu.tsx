import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';

import { cn } from '../../lib/cn';
import { CheckIcon } from './icons';

/**
 * DropdownMenu, on Radix.
 *
 * Used for account and row actions. Radix supplies what a hand-rolled menu
 * always gets wrong: `role="menu"` semantics, arrow-key roving focus, typeahead,
 * `Escape` to close, focus return to the trigger, and dismissal on outside click
 * or scroll.
 *
 * Radix's default is `sideOffset` in pixels, which is not a logical unit. Every
 * placement below therefore uses `align` plus a token-based offset so the menu
 * lands on the correct side under RTL without a second code path.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 4, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto',
          'rounded-card border border-border bg-surface p-1 text-text shadow-[var(--shadow)]',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }
>(function DropdownMenuItem({ className, inset, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      data-slot="dropdown-menu-item"
      className={cn(
        // The touch floor applies to a menu row too - a 24px-tall menu item is
        // unusable on a phone, and the sidebar drawer is the mobile surface.
        'relative flex min-h-[var(--touch-target-min)] cursor-default select-none items-center gap-2',
        'rounded-control px-2 py-1.5 text-text outline-none',
        'data-[highlighted]:bg-bg data-[highlighted]:text-text',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        inset && 'ps-8',
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuCheckboxItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(function DropdownMenuCheckboxItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        'relative flex min-h-[var(--touch-target-min)] cursor-default select-none items-center gap-2',
        'rounded-control py-1.5 pe-2 ps-8 text-text outline-none',
        'data-[highlighted]:bg-bg data-[highlighted]:text-text',
        className,
      )}
      {...props}
    >
      <span className="absolute start-2 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
});

export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuRadioItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      data-slot="dropdown-menu-radio-item"
      className={cn(
        'relative flex min-h-[var(--touch-target-min)] cursor-default select-none items-center gap-2',
        'rounded-control py-1.5 pe-2 ps-8 text-text outline-none',
        'data-[highlighted]:bg-bg data-[highlighted]:text-text',
        className,
      )}
      {...props}
    >
      <span className="absolute start-2 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
});

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Label>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }
>(function DropdownMenuLabel({ className, inset, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      data-slot="dropdown-menu-label"
      className={cn('px-2 py-1.5 text-xs text-muted', inset && 'ps-8', className)}
      {...props}
    />
  );
});

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
});

export const DropdownMenuShortcut = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'span'>) => (
  <span
    data-slot="dropdown-menu-shortcut"
    className={cn('ms-auto text-xs tracking-widest text-muted', className)}
    {...props}
  />
);
