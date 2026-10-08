import { forwardRef, type HTMLAttributes, type LabelHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

/**
 * The field composition: label, control, description, error.
 *
 * ## Why this exists
 *
 * `AGENTS.md` 3.2.1 leaves the accessibility of a form entirely to the caller -
 * a `<Label>` and an `<Input>` side by side associate only if the caller also
 * threads the same `id` through both and wires `aria-describedby` to whatever
 * helper text is showing. That is four chances to ship a field that looks right,
 * passes a visual review, and announces nothing, because a `<label>` with no
 * `for` is not an error - it is silent.
 *
 * shadcn's answer is the `field` family. This is that family, bound to EduFlow's
 * tokens, and it is deliberately **form-library agnostic**: it exports plain
 * elements and a `data-invalid` attribute rather than the react-hook-form
 * bindings shadcn's `form.tsx` wires up. `AGENTS.md` 8 forbids adding a
 * state-management library without explicit instruction, and a two-field sign-in
 * form does not need one; a screen that later does can adopt `form.tsx` without
 * this file having to change.
 *
 * ## What the composition guarantees
 *
 * - `Field` carries `data-invalid` when it is invalid. A caller styles the
 *   error from that attribute rather than from a prop it passes to two
 *   children, so the two halves of a field cannot disagree.
 * - `FieldError` is a `role="alert"` region. An error that only changes colour
 *   is invisible to a screen reader and to a colour-blind user; the `Input`
 *   primitive's `aria-invalid:border-danger` covers the second half.
 * - `FieldLabel` is a real `<label>` and never defaults `htmlFor`, for the
 *   reason `label.tsx` gives: an unassociated label announces nothing.
 * - `FieldGroup` is a `role="group"`, so a screen reader announces the run as
 *   one region rather than as a row of loose controls.
 *
 * ## Logical properties only
 *
 * `3.2.6`: gaps are `gap-*`, insets are `ps-*`/`pe-*`, nothing is `ml-`/`pr-`.
 * Nothing in this file can mirror wrongly, because nothing in it is physical.
 */

/** One field: label, control, description, error. */
export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Marks the field as failing validation.
   *
   * Rendered as `data-invalid`, so a caller styles the control and the message
   * from one source rather than passing a flag to each.
   */
  readonly invalid?: boolean;
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { className, invalid = false, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="field"
      data-invalid={invalid ? 'true' : undefined}
      className={cn('flex w-full flex-col gap-1.5', className)}
      {...props}
    />
  );
});

/**
 * A set of fields. `role="group"` so assistive technology announces the run as
 * one region; `FieldSet` is the semantic choice when the group also needs a
 * visible legend.
 */
export const FieldGroup = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function FieldGroup({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        role="group"
        data-slot="field-group"
        className={cn('flex w-full flex-col gap-5', className)}
        {...props}
      />
    );
  },
);

/**
 * The grouping element for a related run of fields.
 *
 * `<fieldset>` and `<legend>` rather than a div and a paragraph: a browser
 * exposes a fieldset as a group WITH A NAME, and ARIA on a div does that less
 * reliably. It carries no border or padding of its own - the visible frame is
 * the card - because a fieldset that draws a box inside a card that already
 * draws one is two frames saying the same thing.
 */
export const FieldSet = forwardRef<HTMLFieldSetElement, HTMLAttributes<HTMLFieldSetElement>>(
  function FieldSet({ className, ...props }, ref) {
    return (
      <fieldset
        ref={ref}
        data-slot="field-set"
        className={cn('flex min-w-0 flex-col gap-4 border-0 p-0', className)}
        {...props}
      />
    );
  },
);

export const FieldLegend = forwardRef<HTMLLegendElement, HTMLAttributes<HTMLLegendElement>>(
  function FieldLegend({ className, ...props }, ref) {
    return (
      <legend
        ref={ref}
        data-slot="field-legend"
        className={cn('mb-1 p-0 text-sm font-semibold text-text', className)}
        {...props}
      />
    );
  },
);

/**
 * The label for a control.
 *
 * `htmlFor` is passed through and never defaulted, because an unassociated label
 * announces nothing. Callers here pass `htmlFor` and give the control a matching
 * `id`, because the label sits ABOVE the control - which is what a form in four
 * languages needs: a label beside its field forces either a narrow column or a
 * ragged baseline in Tamil and Sinhala, and the Arabic mirror of a side-by-side
 * pair puts the label where the eye lands second.
 */
export const FieldLabel = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  function FieldLabel({ className, ...props }, ref) {
    return (
      <label
        ref={ref}
        data-slot="field-label"
        className={cn('text-[0.8125rem] font-semibold text-text', className)}
        {...props}
      />
    );
  },
);

/**
 * Helper text under a control.
 *
 * Sits where `aria-describedby` points, so it is read AFTER the control's own
 * value rather than instead of it. `text-xs` because a description is read, not
 * scanned, and it must not compete with the label for the first line of attention.
 */
export const FieldDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(function FieldDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      data-slot="field-description"
      className={cn('text-pretty text-xs leading-relaxed text-muted', className)}
      {...props}
    />
  );
});

/**
 * The validation message for a field.
 *
 * `role="alert"` with `aria-live="assertive"`: the content appears after the
 * control has already been read, so it has to interrupt. `assertive` is correct
 * here and would be wrong on a field that validated on every keystroke - which is
 * one of the reasons this component is used on submit rather than live.
 *
 * `text-danger` is a token, so it is legible in both themes, and it is never the
 * only signal: the message states the problem in words, and `Input`'s
 * `aria-invalid:border-danger` states it again to anyone who cannot see this one.
 */
export const FieldError = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  function FieldError({ className, ...props }, ref) {
    return (
      <p
        ref={ref}
        role="alert"
        aria-live="assertive"
        data-slot="field-error"
        className={cn('text-pretty text-xs font-medium leading-relaxed text-danger', className)}
        {...props}
      />
    );
  },
);

/**
 * The control's own slot beside a label, for horizontal layouts where a switch
 * or a checkbox sits before its text.
 *
 * Not used by the sign-in form, which stacks. It is here because the next screen
 * that needs it should not re-invent it, and because a composition that supports
 * only one orientation is one every later form has to work around.
 */
export const FieldContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function FieldContent({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="field-content"
        className={cn('flex flex-1 flex-col gap-0.5', className)}
        {...props}
      />
    );
  },
);

/**
 * A horizontal rule with a caption, for "or continue with" between two ways in.
 *
 * Two `flex-1` spans rather than a border on the caption: a border sits on the
 * caption's box and leaves a gap above and below it, so the rule never looks
 * centred on the text. This keeps it centred at any font size, and in Arabic the
 * caption and its two rules swap sides correctly without a rule of their own.
 */
export const FieldSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function FieldSeparator({ className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="field-separator"
        className={cn('flex items-center gap-3', className)}
        {...props}
      >
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        {children ? <span className="shrink-0 text-xs text-muted">{children}</span> : null}
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
    );
  },
);
