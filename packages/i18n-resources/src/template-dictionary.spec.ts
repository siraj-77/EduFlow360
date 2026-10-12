import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import en from './locales/en.json' with { type: 'json' };

/**
 * The template's auth copy against the shipped dictionary (`PLT-1003` T3 / AC-2).
 *
 * ## What this proves
 *
 * The approved templates are the visual source the product is ported
 * from, and AC-2 of `PLT-1003` requires the packages to equal them
 * exactly. The token half of that equality lives in
 * `packages/ui-kit/src/index.spec.ts` (values, not just names); this
 * is the dictionary half: the words on the sign-in, forgot-password and
 * reset screens.
 *
 * ## Why a divergence table rather than a strict equality assertion
 *
 * The ported screens are NOT the template's copy verbatim, and they are
 * not supposed to be. `PasswordSignInBody` is `.strict()` and accepts
 * `identifier` OR `username`, so "Email address or username" is a
 * truer label than the template's "Email"; the screens' headings were
 * rewritten for the same reason. `AGENTS.md` 2.8 itself forbids taking
 * the marketing copy verbatim. So strict equality would fail on
 * deliberate decisions and would have to be "fixed" by un-making them.
 *
 * What must NOT happen is a SILENT new divergence: a copy edit that
 * drifts from the approved design without a decision behind it. So the
 * oracle has two halves, and the second is the one with teeth —
 *
 *   1. **Verbatim rows** — the strings the port does reproduce are
 *      asserted character-for-character, trailing punctuation included.
 *   2. **Divergence rows** — the strings the port rewrote are pinned
 *      against the template too, so a FUTURE edit to either side fails
 *      here until a row is added. A port that invents fresh copy
 *      without a row fails as an unrecorded divergence.
 *
 * The reasons are not decoration: each one is the decision, written
 * where the next person will look.
 */

const TEMPLATE = readFileSync(
  new URL('../../../docs/template/EduFlow360_Template_Landing_Auth.html', import.meta.url),
  'utf8',
);

/** The copy of the three auth screens, as the template writes it. */
const TEMPLATE_COPY = {
  loginHeading: 'Welcome back',
  loginSubtitle: 'Log in to your school workspace',
  identifierLabel: 'Email',
  passwordLabel: 'Password',
  rememberMe: 'Remember me',
  forgotLink: 'Forgot password?',
  submitButton: 'Log In',
  socialDivider: 'or continue with',
  contactPrompt: 'No account? Contact your school admin',
} as const;

/**
 * The template's VISIBLE TEXT, with its tags removed.
 *
 * Needed because the template splits copy across markup:
 * "No account? <a …>Contact your school admin</a>" is one sentence on
 * screen and two fragments in the source, so a substring check against
 * the raw HTML would report a copy string the template plainly carries.
 * Whitespace is collapsed for the same reason — the source formats it
 * across lines. Every comparison below is against what a visitor READS,
 * which is what "equal to the template's exactly" has to mean.
 */
const TEMPLATE_TEXT = TEMPLATE.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/** Does the template carry this copy, as a visitor would read it? */
const templateCarries = (copy: string): boolean => TEMPLATE_TEXT.includes(copy);

/**
 * Copy the port reproduces CHARACTER-FOR-CHARACTER from the template.
 *
 * The keys are dictionary paths (`auth.*`, `signIn.*`), so a value that
 * stops matching is a dictionary edit, and a template edit is caught by
 * the `templateCarries` check on the template side of each row.
 *
 * Two rows, and that is the honest count: most of the auth screens'
 * copy was rewritten when it was ported (see `DIVERGED`), and a table
 * that claimed more verbatim rows than exist would be the same lie in
 * the other direction. `auth.rememberMe` is the interesting one — it
 * matches the template exactly AND is deliberately not rendered, which
 * the sign-in form's own header records; the string is kept in the
 * dictionary so the omission stays visible rather than looking like an
 * untranslated gap.
 */
const VERBATIM: Record<string, { readonly template: string; readonly key: string }> = {
  'auth.rememberMe': { template: TEMPLATE_COPY.rememberMe, key: 'auth.rememberMe' },
  'auth.socialDivider': { template: TEMPLATE_COPY.socialDivider, key: 'auth.socialDivider' },
};

/**
 * Copy the port deliberately rewrote, pinned against BOTH sides.
 *
 * `value` is the shipped dictionary value and `reason` is the decision.
 * A row whose template string disappears from the template is a template
 * edit; a row whose dictionary value moves is a copy edit — both fail.
 */
const DIVERGED: Record<
  string,
  {
    readonly template: string;
    readonly key: string;
    readonly value: string;
    readonly reason: string;
  }
> = {
  'signIn.title': {
    template: TEMPLATE_COPY.loginHeading,
    key: 'signIn.title',
    value: 'Sign in',
    reason:
      'The shipped heading names the action rather than greeting. A returning user knows ' +
      'they are signed out; "Welcome back" reads oddly on the screen that proves they are not.',
  },
  'signIn.subtitle': {
    template: TEMPLATE_COPY.loginSubtitle,
    key: 'signIn.subtitle',
    value: "Access your school's dashboard.",
    reason:
      'The template says "school workspace"; the API serves one school per deployment ' +
      '(ADR-003), so "workspace" would imply a tenancy this product does not have.',
  },
  'signIn.identifierLabel': {
    template: TEMPLATE_COPY.identifierLabel,
    key: 'signIn.identifierLabel',
    value: 'Email address or username',
    reason:
      'POST /auth/login accepts EITHER identifier (its .strict() body is `identifier` and ' +
      '`password`), so a label that says "Email" sends the wrong half of the school to a ' +
      'refusal. The hint key below says the same thing in a sentence.',
  },
  'auth.forgotPassword': {
    template: TEMPLATE_COPY.forgotLink,
    key: 'auth.forgotPassword',
    value: 'Forgot your password?',
    reason: "Wording only: the ported copy keeps the template's phrase and its question mark.",
  },
  'signIn.submit': {
    template: TEMPLATE_COPY.submitButton,
    key: 'signIn.submit',
    value: 'Sign in',
    reason:
      'The template\'s "Log In" names the verb; the shipped button matches the screen title ' +
      'and the API route it posts to (POST /auth/login).',
  },
  'auth.contactAdmin': {
    template: TEMPLATE_COPY.contactPrompt,
    key: 'auth.contactAdmin',
    value: 'No account? Contact your school admin.',
    reason: 'The port terminates the sentence with a period; the template does not.',
  },
};

/** Walk `a.b.c` into the dictionary. */
function valueAt(path: string): string {
  const parts = path.split('.');
  let current: unknown = en;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return '<<missing>>';
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : '<<not a string>>';
}

describe("the approved template's auth copy (PLT-1003 T3 / AC-2)", () => {
  it('reads the template it is comparing against', () => {
    // Not a tautology: a renamed or restructured template would make
    // every row below silently compare against nothing, which is the
    // "a check that matches nothing" failure this repository keeps
    // finding. Anchor the extraction to a string only this template has.
    expect(TEMPLATE).toContain('view-login');
    expect(TEMPLATE).toContain('view-forgot');
    for (const copy of Object.values(TEMPLATE_COPY)) {
      expect(templateCarries(copy), `the template no longer carries "${copy}"`).toBe(true);
    }
  });

  it.each(Object.entries(VERBATIM))(
    'reproduces %s character-for-character',
    (_path, { template, key }) => {
      expect(valueAt(key), `${key} must equal the template's "${template}"`).toBe(template);
    },
  );

  it.each(Object.entries(DIVERGED))(
    'keeps %s at its documented divergence, not a new one',
    (_path, { template, key, value, reason }) => {
      // The reason is read, so a row cannot exist without one — an
      // undocumented divergence is the thing this table exists to prevent.
      expect(reason.length, `${pathFor(key)} has no recorded reason`).toBeGreaterThan(20);
      expect(
        valueAt(key),
        `${key} diverged from the template again, beyond the recorded decision. ` +
          "Update this row (and its reason) deliberately, or restore the template's wording.",
      ).toBe(value);
      // And the template still says what the row claims it says, so the
      // comparison is against the approved design and not against a memory.
      expect(templateCarries(template), `the template no longer carries "${template}"`).toBe(true);
    },
  );
});

/** `auth.forgotPassword` from an already-dotted path, for a message. */
function pathFor(path: string): string {
  return path;
}
