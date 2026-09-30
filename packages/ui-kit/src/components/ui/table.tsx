import {
  forwardRef,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';

import { cn } from '../../lib/cn';

/**
 * Table.
 *
 * The wrapper is a real `<div>` with `overflow-x-auto` rather than a scrolling
 * `<table>`, because AGENTS.md 3.2.2 requires tables to scroll horizontally on
 * narrow screens. `overflow-x-auto` is a physical-ish utility but it is axis,
 * not side, so it does not mirror - and the test's physical-property check
 * deliberately allows it.
 *
 * A raw `<table>` is banned by 3.2.1, which is why this file needs the
 * primitives exemption. It is one of the six cases that make that exemption
 * necessary rather than a loophole.
 */
export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(function Table(
  { className, ...props },
  ref,
) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        ref={ref}
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
});

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TableHeader({ className, ...props }, ref) {
  return (
    <thead
      ref={ref}
      data-slot="table-header"
      className={cn('[&_tr]:border-b [&_tr]:border-border', className)}
      {...props}
    />
  );
});

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TableBody({ className, ...props }, ref) {
  return (
    <tbody
      ref={ref}
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
});

export const TableFooter = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      data-slot="table-footer"
      className={cn('border-t border-border bg-bg font-medium', className)}
      {...props}
    />
  );
});

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  function TableRow({ className, ...props }, ref) {
    return (
      <tr
        ref={ref}
        data-slot="table-row"
        className={cn('border-b border-border transition-colors hover:bg-bg', className)}
        {...props}
      />
    );
  },
);

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  function TableHead({ className, ...props }, ref) {
    return (
      <th
        ref={ref}
        data-slot="table-head"
        className={cn('h-10 px-3 text-start align-middle font-medium text-muted', className)}
        {...props}
      />
    );
  },
);

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  function TableCell({ className, ...props }, ref) {
    return (
      <td
        ref={ref}
        data-slot="table-cell"
        className={cn('p-3 align-middle text-text', className)}
        {...props}
      />
    );
  },
);

export const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  HTMLAttributes<HTMLTableCaptionElement>
>(function TableCaption({ className, ...props }, ref) {
  return (
    <caption
      ref={ref}
      data-slot="table-caption"
      className={cn('mt-3 text-sm text-muted', className)}
      {...props}
    />
  );
});
