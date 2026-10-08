import type { ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '@eduflow/ui-kit';

/**
 * What the control inside a field has to be told for the field to be accessible.
 *
 * Handed to the caller as a render prop rather than attached with
 * `cloneElement`. Three reasons:
 *
 *   - `cloneElement` needs the child to be a valid element, checked at runtime,
 *     and a caller who passes a fragment gets a field that silently loses its
 *     description. A render prop cannot be misused that way.
 *   - The ids are derived here, once, from the field's own `id`. Duplicating
 *     `${id}-hint` and `${id}-error` at the call site is how a label and its
 *     `aria-describedby` end up pointing at different things.
 *   - It keeps the field free of any knowledge of what the control is. An
 *     `<Input>` and a `<Select>` both satisfy it.
 *
 * The keys are the real DOM attribute names, not aliases, so the call site is
 * `<Input {...control} />` with no renaming step where a mistake could hide.
 */
export interface FieldControlProps {
  readonly id: string;
  readonly 'aria-describedby'?: string;
  readonly 'aria-invalid'?: true;
}

export interface CredentialFieldProps {
  /** Unique within the form. Every derived id hangs off it. */
  readonly id: string;
  readonly label: string;
  /** Help text, or `null`. Becomes part of `aria-describedby` when present. */
  readonly hint: string | null;
  /** Already-translated message, or `null` when the field is valid. */
  readonly error: string | null;
  /** Additional ids the caller wants the control described by. */
  readonly alsoDescribedBy?: readonly string[];
  readonly children: (control: FieldControlProps) => ReactNode;
}

/**
 * One labelled field: label, control, hint, error.
 *
 * ## The three chances to get a field wrong, and this component's answer
 *
 * A field is accessible when the label's `for` matches the control's `id`, the
 * hint and the error are named by `aria-describedby`, and `aria-invalid` is set.
 * Miss any one and the field still looks completely correct on screen - an
 * unassociated `<label>` renders its text perfectly - so nothing visual catches
 * it. Here the ids are derived once and `aria-invalid` is derived from `error`,
 * so the three cannot disagree.
 *
 * The list is space-separated and omits ids that are not in the DOM: pointing at
 * an id that does not exist makes a screen reader announce nothing at all, which
 * is the same failure as not pointing anywhere, reached in a way that reads as
 * deliberate.
 */
export function CredentialField({
  id,
  label,
  hint,
  error,
  alsoDescribedBy = [],
  children,
}: CredentialFieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const described = [
    ...alsoDescribedBy,
    ...(hint === null ? [] : [hintId]),
    ...(error === null ? [] : [errorId]),
  ];

  const control: FieldControlProps = {
    id,
    ...(described.length > 0 ? { 'aria-describedby': described.join(' ') } : {}),
    ...(error === null ? {} : { 'aria-invalid': true as const }),
  };

  return (
    <Field invalid={error !== null}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>

      {children(control)}

      {hint === null ? null : <FieldDescription id={hintId}>{hint}</FieldDescription>}
      {error === null ? null : <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}
