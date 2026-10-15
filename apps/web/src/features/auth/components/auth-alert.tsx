import type { ReactNode, Ref } from 'react';

/**
 * The template's `.alert` slot (`docs/template/EduFlow360_Template_Landing_Auth.html`),
 * as the one component the three auth screens share.
 *
 * ## Why this exists rather than three class lists
 *
 * The template carries one `.alert` element per screen — `#loginAlert`,
 * `#forgotAlert`, `#resetAlert` — all three sharing a single `.alert` rule
 * with `.alert.error` and `.alert.ok` for the two states. The port had the
 * same visual language written out three times, in slightly different
 * spellings, which is how a design drifts: each edit fixes one screen and
 * leaves the other two on the old number. `PLT-1004` T2 requires the
 * screens to show server responses "using the template's alert styles", and
 * a requirement about a shared style wants a shared object.
 *
 * ## The classes are the template's rule, and the spec reads the template
 *
 * Every value below is derived from the template's own CSS at test time by
 * `auth-alert.spec.tsx`, not transcribed from it here, so the two cannot
 * quietly disagree. `rounded-control` is the token that carries the
 * template's `border-radius: 9px` — the kit's `--radius-control` is 9px in
 * light, which is the half the template actually specifies, and the dark
 * half's difference is a recorded divergence the spec pins rather than a
 * number anyone has to remember.
 *
 * ## Why the role is derived from the tone
 *
 * The template's `.alert` is a demo `<div>` with no role at all, and the port
 * cannot copy that: a sign-in that fails with no focus change and no
 * announcement has told a screen-reader user nothing. An error interrupts
 * (`role="alert"`, assertive); a confirmation does not (`role="status"`,
 * polite). That is the whole reason `tone` is a parameter and not a
 * `className` the caller supplies — the semantics belong to the message's
 * kind, and the kind is what the caller knows.
 *
 * ## What this component deliberately does not do
 *
 * It renders nothing conditional. The caller decides WHEN there is a
 * message; this decides what a message LOOKS like. A slot that hid itself
 * when empty would put a display rule in a second place and re-open the
 * drift this component exists to close.
 *
 * `testId` is optional because the template's alert slot is an element the
 * screens keep in the DOM at all times — hidden while empty — and the hook
 * some of them expose belongs to that slot rather than to the message inside
 * it.
 */
export function AuthAlert({
  tone,
  children,
  testId,
  tabIndex,
  ref: forwardedRef,
}: {
  /** Which of the template's two alert states to render. */
  readonly tone: 'error' | 'ok';
  readonly children: ReactNode;
  /** A stable hook for the specs and for the screens' own assertions. */
  readonly testId?: string;
  /**
   * `-1` when the message is the only thing wrong, so the caller's
   * focus-after-refusal effect can move focus to it. Absent otherwise: a
   * message that can take focus while the user is still typing in a field is
   * a focus magnet.
   */
  readonly tabIndex?: -1;
  /** Forwarded for the same reason as `tabIndex` — see `sign-in-form.tsx`. */
  readonly ref?: Ref<HTMLParagraphElement>;
}) {
  const error = tone === 'error';

  return (
    <p
      ref={forwardedRef}
      role={error ? 'alert' : 'status'}
      aria-live={error ? 'assertive' : 'polite'}
      data-testid={testId}
      tabIndex={tabIndex}
      /*
       * The template's `.alert` rule, in order: radius, then the shared
       * padding and font size, then the tone's three colours.
       *
       * `border` is the template's `1px`; `border-danger/30` is its colour.
       * `text-[13px]` is an arbitrary value because the kit has no `text-13`
       * utility and 13px is the number the template specifies for this slot.
       *
       * No `font-weight`: the template's rule sets none, and a medium weight
       * is the kind of small improvement that makes the port stop matching
       * the baseline.
       */
      className={
        'rounded-control border px-3 py-2.5 text-[13px] ' +
        (error ? 'border-danger/30 bg-danger/12 text-danger' : 'border-ok/30 bg-ok/12 text-ok')
      }
    >
      {children}
    </p>
  );
}
