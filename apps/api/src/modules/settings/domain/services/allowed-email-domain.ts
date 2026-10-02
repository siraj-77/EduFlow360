/**
 * Which email domains may sign in to this school (`D49`).
 *
 * ## Why this is a pure function and not a branch in a use-case
 *
 * This is the rule that stands between an arbitrary internet address and a seat
 * in a school's staff room, so it lives where it cannot reach a database, a
 * network or a vendor SDK — the same place `setup-token.ts` keeps the other
 * unauthenticated decision, and for the same reason.
 *
 * ## The one bug this file exists to make impossible
 *
 * A suffix comparison is the obvious way to write this and it is a live
 * account-takeover path:
 *
 *     'evilmicrosoft.com'.endsWith('microsoft.com')   // true
 *
 * `'evilmicrosoft.com'` is registrable by anyone. So the match below is **exact
 * equality between two normalised strings**. There is no suffix comparison, no
 * substring test and no "equal or a subdomain of" in any EXPRESSION here: the
 * only `endsWith` written in this file is the one in this comment, and the two
 * live `startsWith`/`lastIndexOf` calls are on the single at sign during
 * normalisation, never on a domain — so grepping for a substring comparison
 * turns up prose rather than code.
 *
 * `allowed-email-domain.spec.ts` has a table of ten domains that a suffix rule
 * would admit and this one refuses.
 *
 * ## Subdomains are NOT inherited, and that is a decision
 *
 * A configured `school.lk` does not permit `staff.school.lk`. The
 * dot-prefixed suffix form is the tempting compromise: it is safe against
 * `evilmicrosoft.com`, and it is still wrong. An administrator cannot enumerate
 * their own subdomains, so honouring all of them grants access to hostnames
 * nobody in the school chose, and the subdomain a school hands to a third party
 * is precisely the one an attacker wants. A school that wants a subdomain lists
 * that subdomain.
 *
 * The inverse is refused too: configuring `staff.school.lk` does not permit
 * `school.lk`. Both directions are asserted in the spec, because a rule
 * narrowed to only one of them would pass the obvious test and still be wrong.
 *
 * ## Empty means locked, and it says so
 *
 * `D49` is fail-closed when the list is empty: there is deliberately no global
 * default domain, so a fresh school is locked out until an administrator
 * configures its own list. Null, `[]`, and a list whose every entry is unusable
 * all mean NOTHING is permitted, and all three report
 * `allowlist-not-configured` — a refusal of its own, distinct from
 * `domain-not-permitted`, because an operator who has never configured a list
 * must be told that, rather than being told they mistyped a domain and left to
 * guess.
 *
 * They are one reason rather than three on purpose. All three are fixed by the
 * same action — configure a domain — so splitting them would grow the state
 * space for no operational gain, and a state space with a near-duplicate pair
 * in it is a state space where one of the pair eventually gets written "allow
 * all".
 *
 * ## What is deliberately NOT here
 *
 * `email_verified === true` is a second condition on account creation and it
 * belongs to the caller that creates the account, not here: this rule answers
 * one question about a domain and mixing in the provider's assertion about an
 * address would produce two verdicts that have to be reconciled rather than one.
 *
 * Label and total length limits (63 / 253) and IDNA conversion are NOT enforced.
 * An internationalised domain must arrive as punycode, which is ASCII, and
 * inventing a transliteration rule here would be a second normalisation of one
 * name — the exact ambiguity the exact-equality match depends on not existing.
 * No corpus document specifies either limit, so neither is guessed at.
 */

/**
 * What a stored configuration entry is, and what is wrong with it.
 *
 * Typed rather than a boolean so a caller can tell a malformed entry from a
 * domain that is merely not permitted, and so a settings write path can show an
 * administrator which of the entries they typed is the bad one.
 */
export type DomainRejectionReason =
  /** Nothing was left after trimming and stripping. */
  | 'empty'
  /** The entry is an address. A domain is not an address. */
  | 'contains-at-sign'
  /** Something outside the ASCII host alphabet, including a raw non-ASCII label. */
  | 'invalid-character'
  /** Two dots with nothing between them: `school..lk`. */
  | 'empty-label'
  /** A label beginning or ending with a hyphen. */
  | 'invalid-label';

export type DomainNormalization =
  | { readonly ok: true; readonly domain: string }
  | { readonly ok: false; readonly reason: DomainRejectionReason };

/** ASCII host label: alphanumeric at the ends, hyphens allowed inside. */
const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/** Everything a host name may contain here. Checked before labels are split. */
const HOST_CHARS = /^[a-z0-9.-]+$/;

/**
 * Canonicalise a configured domain, or say precisely why it cannot be.
 *
 * The steps are ordered and the order is the rule:
 *
 *  1. trim, then lowercase — an operator types `School.Lk` and a provider sends
 *     `Teacher@School.LK`, and neither is a different domain;
 *  2. forgive ONE leading `@`, because pasting from an address bar is the common
 *     case and a leading at sign is unambiguous noise;
 *  3. refuse any OTHER `@`, which is what catches `teacher@school.lk` — the entry
 *     that is an address rather than a domain;
 *  4. strip leading and trailing dots, which covers the DNS root form
 *     `school.lk.` and a pasted leading separator;
 *  5. refuse what is left empty;
 *  6. refuse anything outside the host alphabet;
 *  7. refuse empty and hyphen-mangled labels.
 *
 * Steps 2 and 3 are separate on purpose. Folding them into one `replace('@','')`
 * would accept `@teacher@school.lk` by removing both, and a rule that strips
 * something it does not understand is a rule whose behaviour nobody can predict
 * from the specification.
 */
export function normalizeDomain(raw: string): DomainNormalization {
  let value = raw.trim().toLowerCase();

  if (value.startsWith('@')) value = value.slice(1);

  if (value.includes('@')) return { ok: false, reason: 'contains-at-sign' };

  value = value.replace(/^\.+/, '').replace(/\.+$/, '');

  if (value.length === 0) return { ok: false, reason: 'empty' };
  if (!HOST_CHARS.test(value)) return { ok: false, reason: 'invalid-character' };

  for (const label of value.split('.')) {
    if (label.length === 0) return { ok: false, reason: 'empty-label' };
    if (!LABEL.test(label)) return { ok: false, reason: 'invalid-label' };
  }

  return { ok: true, domain: value };
}

/** Why a presented address was refused. */
export type EmailDomainRejectionReason =
  /**
   * The stored value is not a list at all — an object, a number, a string.
   *
   * Separate from `allowlist-not-configured` because the remedy differs: a
   * school with a good list that reads as empty cannot fix a data fault it
   * cannot see, and this is the reason that sends someone to look at the row.
   */
  | 'allowlist-malformed'
  /**
   * Nothing is permitted, because nothing usable is configured. Null, `[]` and
   * a list of unusable entries all land here — see the header.
   */
  | 'allowlist-not-configured'
  /** The presented value is not an address this school could recognise. */
  | 'address-malformed'
  /** A real address, in a domain this school does not permit. */
  | 'domain-not-permitted';

export type EmailDomainDecision =
  | { readonly allowed: true; readonly domain: string }
  | { readonly allowed: false; readonly reason: EmailDomainRejectionReason };

export interface EmailDomainRequest {
  /**
   * EXACTLY what the settings column holds, untyped on purpose.
   *
   * The column is `Json`, so the value can be anything JSON can hold, and the
   * narrowing has to happen somewhere. Typing this parameter `string[] | null`
   * would put that somewhere the compiler cannot check — the actual value comes
   * back from a database column through Prisma, and a lie in the signature is
   * how `null` reaches a `.map()` at three in the morning.
   */
  readonly allowlist: unknown;
  readonly email: string;
}

/**
 * The configured domains that are usable, or `null` if the stored value is not
 * a list at all.
 *
 * Entries that cannot be normalised are DROPPED rather than treated as fatal. A
 * typo in one entry must not lock a school out of the domains it has correctly
 * configured, and the safe direction is identical either way: a dropped entry
 * permits nothing, which is what a fail-closed rule does.
 *
 * The cost is recorded rather than hidden: a list that is entirely wrong reports
 * as `allowlist-not-configured` rather than as a data error. That is safe
 * because the remedy — configure a working domain — is the same one, and it is
 * the only remedy available.
 */
function usableDomains(allowlist: unknown): readonly string[] | null {
  if (allowlist === null || allowlist === undefined) return [];
  if (!Array.isArray(allowlist)) return null;

  const domains = new Set<string>();
  for (const entry of allowlist) {
    if (typeof entry !== 'string') continue;
    const normalized = normalizeDomain(entry);
    if (normalized.ok) domains.add(normalized.domain);
  }

  return [...domains];
}

/** The normalised domain of an address, or `null` if it is not one we can use. */
function domainOfAddress(email: string): string | null {
  // An address has exactly ONE at sign and something in front of it. Taking the
  // part after the LAST at sign instead would quietly accept 'a@b@c' as
  // living in the domain 'c' — a nonsense address reported as a real one in a
  // real domain, which is the kind of answer that makes a later bug
  // unrecognisable. Two at signs is a malformed address, full stop.
  const at = email.indexOf('@');
  if (at < 0 || at !== email.lastIndexOf('@') || at === 0) return null;

  const normalized = normalizeDomain(email.slice(at + 1));
  return normalized.ok ? normalized.domain : null;
}

/**
 * Decide whether `email` may sign in to the school that configured `allowlist`.
 *
 * Order matters, and it is the security content of this function:
 *
 *  1. **The allowlist is settled first.** With nothing permitted there is no
 *     decision left about the address, so an address that is not an address must
 *     not produce a DIFFERENT refusal — the difference would be an oracle telling
 *     a caller which addresses this school recognises.
 *  2. **Only then is the address read**, and its domain normalised through the
 *     same function as a configured entry, because the two arrive in different
 *     spellings from different systems.
 *  3. **Then exact equality.** Nothing about this is a suffix relationship; see
 *     the header for why.
 */
export function decideEmailDomain(request: EmailDomainRequest): EmailDomainDecision {
  const domains = usableDomains(request.allowlist);

  if (domains === null) return { allowed: false, reason: 'allowlist-malformed' };
  if (domains.length === 0) return { allowed: false, reason: 'allowlist-not-configured' };

  const candidate = domainOfAddress(request.email);
  if (candidate === null) return { allowed: false, reason: 'address-malformed' };

  return domains.includes(candidate)
    ? { allowed: true, domain: candidate }
    : { allowed: false, reason: 'domain-not-permitted' };
}
