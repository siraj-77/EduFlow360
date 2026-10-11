import { z } from 'zod';
import {
  FEATURE_KEYS,
  LIMIT_KEYS,
  MODULE_KEYS,
  type FeatureKey,
  type ModuleKey,
} from './licence-catalogue.js';

/**
 * The certificate payload, as the application layer sees it (`PLT-301` T2).
 *
 * snake_case on the wire, camelCase in the domain — the same boundary rule as
 * the `AuditRecord` entity (`domain` names no ORM), applied here to the
 * corpus's own field names so the schema below is a transcription of Master
 * Plan §4.2 rather than an invention.
 */
export interface LicencePayload {
  readonly product: string;
  /** A LABEL, not an enum. `ADR-009`: no edition name is hard-coded. */
  readonly edition: string;
  readonly schoolId: string;
  readonly schoolName: string;
  readonly activationDate: Date;
  readonly expiryDate: Date;
  readonly allowedModules: readonly ModuleKey[];
  readonly limits: Readonly<Partial<Record<string, number>>>;
  /**
   * Feature flags. Booleans for the on/off features and a string where the
   * corpus specifies a provider — `video_conferencing_provider: "zoom"` is
   * the worked example, and it is why this is not `Record<string, boolean>`.
   */
  readonly features: Readonly<Partial<Record<FeatureKey, boolean | string>>>;
}

/**
 * The schema over the wire form, refusing anything it cannot name.
 *
 * The catalogues are read into `z.enum` equivalents through `refine`, because
 * a set's membership has to stay the catalogue's — duplicating the keys into a
 * literal array (Zod's `z.enum` shape) would be the drift this whole file
 * exists to prevent.
 */
const moduleKey = z.string().refine((key): key is ModuleKey => MODULE_KEYS.has(key), {
  message: `a module key this build does not know. Known module keys: ${[...MODULE_KEYS].sort().join(', ')}`,
});

const featureKey = z.string().refine((key): key is FeatureKey => FEATURE_KEYS.has(key), {
  message: `a feature key this build does not know. Known feature keys: ${[...FEATURE_KEYS].sort().join(', ')}`,
});

const limitKey = z.string().refine((key) => LIMIT_KEYS.has(key), {
  message: `a limit key this build does not know. Known limit keys: ${[...LIMIT_KEYS].sort().join(', ')}`,
});

const limitValue = z
  .number()
  .int('a limit must be a whole number')
  .nonnegative('a limit may not be negative');

const LicencePayloadWire = z
  .object({
    product: z.literal('EduFlow360'),
    edition: z.string().min(1),
    school_id: z.string().min(1),
    school_name: z.string().min(1),
    activation_date: z.string().datetime(),
    expiry_date: z.string().datetime(),
    allowed_modules: z.array(moduleKey),
    limits: z.record(limitKey, limitValue),
    features: z.record(featureKey, z.union([z.boolean(), z.string().min(1).max(64)])),
  })
  .refine(
    // `Date.parse`, not `new Date(...)`: the domain layer's ban on `new Date()`
    // is about DECIDING the time, and this is parsing a timestamp the
    // certificate carries. `z.string().datetime()` has already fixed the
    // format, so the two parses are well-defined and the comparison is a
    // number one.
    (payload) => Date.parse(payload.expiry_date) > Date.parse(payload.activation_date),
    {
      message: 'expiry_date must be after activation_date — a certificate that cannot be true',
      path: ['expiry_date'],
    },
  );

export type LicenceParseResult =
  | { readonly ok: true; readonly payload: LicencePayload }
  | { readonly ok: false; readonly reason: string };

/**
 * Parse the wire form into the domain form, or say exactly why it cannot be.
 *
 * The reason is a string because `PLT-305`'s degradation UI has to show it to
 * an administrator, and because a discriminated union of schema-failure codes
 * would have to anticipate every way Zod can refuse a payload.
 */
export function parseLicencePayload(input: unknown): LicenceParseResult {
  const parsed = LicencePayloadWire.safeParse(input);
  if (!parsed.success) {
    // The issues joined into one reason — the FIRST is usually the actionable
    // one, and the rest are its consequences.
    return { ok: false, reason: parsed.error.issues.map((issue) => issue.message).join('; ') };
  }

  const data = parsed.data;
  return {
    ok: true,
    payload: {
      product: data.product,
      edition: data.edition,
      schoolId: data.school_id,
      schoolName: data.school_name,
      // Two scoped disables, and the reasoning for both: the domain ban on
      // `new Date()` exists to stop a use-case DECIDING the time
      // (`AGENTS.md` §2.4 — inject `IClock`, so tests are deterministic).
      // These two parse timestamps the CERTIFICATE carries — the signer
      // decided them, not this system — and `z.string().datetime()` has
      // already fixed their format. The alternative (passing ISO strings up
      // and comparing them) would put string-order comparison in the expiry
      // check, which is a bug waiting for a certificate with an offset.
      // eslint-disable-next-line no-restricted-syntax
      activationDate: new Date(data.activation_date),
      // eslint-disable-next-line no-restricted-syntax
      expiryDate: new Date(data.expiry_date),
      allowedModules: [...data.allowed_modules],
      limits: { ...data.limits },
      features: { ...data.features },
    },
  };
}
