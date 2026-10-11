import { describe, expect, it } from 'vitest';
import { parseLicencePayload } from './licence-payload.js';

/**
 * The certificate payload schema (`PLT-301` T2; Master Plan §4.2; `ADR-009`'s
 * "validate the payload BEFORE the signature" ordering).
 *
 * ## The ordering rule this schema exists to enforce
 *
 * `ADR-009`: the payload shape is validated with a schema *before* the
 * signature is checked, so a malformed certificate fails with a SCHEMA error
 * rather than a signature error. Two reasons, and the second is the one that
 * matters operationally: a signature failure on a tampered certificate and a
 * signature failure on a certificate a clerk mistyped are different events,
 * and only the schema step can tell them apart.
 *
 * ## Strictness, stated where it can be argued with
 *
 * Unknown module keys, unknown feature keys and unknown limit keys are
 * REFUSED — the posture `permission-catalogue.ts` already takes for
 * permissions. The alternative (accepting anything) makes a typo'd key a
 * silently-absent feature: a certificate listing `academiks` would verify
 * perfectly and deliver a school with no academics. The cost is stated in the
 * header of each catalogue: a new key is a one-line catalogue addition, which
 * is the same cost as a permission.
 *
 * ## What the schema does NOT decide
 *
 * Whether an EDITION is allowed to hold a key — that is the matrix in Master
 * Plan §3, and it is the issuer's constraint, not the verifier's. The verifier
 * refuses what it cannot name and accepts what it can; it does not second-
 * guess what the signer was entitled to sign. `ADR-009`: "no edition name is
 * hard-coded in a guard", and the same rule is why `edition` here is a
 * validated LABEL and not an enumeration.
 */

/**
 * A complete, valid payload IN THE WIRE FORM — the shape the certificate
 * carries and the parser accepts, snake_case per Master Plan §4.2.
 */
const payload = (): Record<string, unknown> => ({
  product: 'EduFlow360',
  edition: 'Deluxe',
  school_id: 'sch_om_muscat_01',
  school_name: 'Muscat International Academy',
  activation_date: '2026-09-01T00:00:00Z',
  expiry_date: '2027-08-31T23:59:59Z',
  allowed_modules: ['academics', 'finance'],
  limits: { maximum_students: 1500, maximum_staff: 150 },
  features: { ai_chatbot: true, video_conferencing_provider: 'zoom', hostel_module: false },
});

describe('parseLicencePayload — a certificate the signer could have issued', () => {
  it('accepts the corpus example, field names and all', () => {
    // The exact shape from Master Plan §4.2's worked example, because a schema
    // that cannot read the corpus's own certificate is a schema nobody asked for.
    const result = parseLicencePayload({
      product: 'EduFlow360',
      edition: 'Deluxe',
      school_id: 'sch_om_muscat_01',
      school_name: 'Muscat International Academy',
      activation_date: '2026-09-01T00:00:00Z',
      expiry_date: '2027-08-31T23:59:59Z',
      allowed_modules: [
        'academics',
        'finance',
        'attendance',
        'workforce_leave',
        'learning_collaboration',
        'identity_documents',
        'library',
        'transport',
        'sports_events',
        'assets',
        'bookshop',
        'canteen',
        'ai_chatbot',
        'helpdesk',
        'whatsapp',
        'bell_management',
        'digital_noticeboard',
        'ai_timetable',
      ],
      limits: {
        maximum_students: 1500,
        maximum_staff: 150,
        maximum_devices: 10,
        maximum_mobile_devices: 500,
        maximum_biometric_terminals: 6,
        maximum_video_class_concurrent_sessions: 20,
        maximum_id_cards_per_batch: 2000,
      },
      features: {
        ai_timetable_assistant: true,
        ai_chatbot: true,
        led_matrix_noticeboard: true,
        custom_curriculum: true,
        staff_leave_accrual_engine: true,
        substitution_auto_assignment: true,
        video_conferencing_provider: 'zoom',
        hostel_module: false,
        sso_integration: false,
      },
    });

    expect(result.ok).toBe(true);
  });

  it('accepts the six keys ADR-023 added, alongside the original eighteen', () => {
    const result = parseLicencePayload({
      ...payload(),
      allowed_modules: ['academics', 'facilities', 'alumni_network', 'student_leadership'],
      features: {
        hall_rental_pack: true,
        student_wallet: false,
        substitution_auto_assignment: true,
      },
    });

    expect(result.ok).toBe(true);
  });

  it('parses ISO dates into Date objects, because the expiry check needs one', () => {
    const result = parseLicencePayload(payload());

    expect(result.ok && result.payload.expiryDate).toBeInstanceOf(Date);
  });
});

describe('parseLicencePayload — what is refused, and why each refusal is the right one', () => {
  it('refuses a missing edition, which would make every gate key-less', () => {
    // Destructured out with a used binding: an unused `edition` would itself
    // fail the unused-variable lint, and deleting the key is the assertion.
    const { edition: _edition, ...withoutEdition } = payload();

    expect(parseLicencePayload(withoutEdition).ok).toBe(false);
  });

  it('refuses an empty edition label, and does NOT enumerate the editions', () => {
    // `ADR-009`: gating is by feature key, so a fifth edition needs no code
    // change. An enum here would make the schema the thing that must change.
    const result = parseLicencePayload({ ...payload(), edition: '' });

    expect(result.ok).toBe(false);

    // A name nobody has heard of is still a name: the corpus's four are
    // examples, not a closed set.
    expect(parseLicencePayload({ ...payload(), edition: 'Enterprise Plus' }).ok).toBe(true);
  });

  it('refuses a certificate for another product', () => {
    // A certificate issued for some other EduFlow product is not this
    // product's licence, and accepting it would be a bypass.
    expect(parseLicencePayload({ ...payload(), product: 'SomethingElse' }).ok).toBe(false);
  });

  it('refuses an unknown module key rather than storing a feature nobody has', () => {
    // The typo case: `academiks` verifies perfectly and delivers a school
    // with no academics. A schema error is visible; a silent absence is not.
    const result = parseLicencePayload({ ...payload(), allowed_modules: ['academiks'] });

    expect(result.ok).toBe(false);
  });

  it('refuses an unknown feature key, for the same reason', () => {
    const result = parseLicencePayload({ ...payload(), features: { ai_chatboot: true } });

    expect(result.ok).toBe(false);
  });

  it('refuses an unknown limit key, for the same reason', () => {
    const result = parseLicencePayload({ ...payload(), limits: { maximum_magical_stones: 5 } });

    expect(result.ok).toBe(false);
  });

  it('refuses a negative limit, which is a limit nobody can honour', () => {
    const result = parseLicencePayload({ ...payload(), limits: { maximum_students: -1 } });

    expect(result.ok).toBe(false);
  });

  it('refuses a fractional limit, because a limit of 150.5 students is not a limit', () => {
    const result = parseLicencePayload({ ...payload(), limits: { maximum_students: 150.5 } });

    expect(result.ok).toBe(false);
  });

  it('refuses a non-boolean, non-string feature value', () => {
    // `video_conferencing_provider: "zoom"` is a legitimate STRING value (the
    // chosen provider). A number or an object is not — a flag that is not a
    // flag is a flag nobody can read.
    const result = parseLicencePayload({ ...payload(), features: { ai_chatbot: 7 } });

    expect(result.ok).toBe(false);
    expect(
      parseLicencePayload({ ...payload(), features: { video_conferencing_provider: 'zoom' } }).ok,
    ).toBe(true);
  });

  it('refuses a malformed expiry date, which would make the expiry check unanswerable', () => {
    for (const bad of ['2027-08-31', '31/08/2027', 'tomorrow', 12345]) {
      expect(parseLicencePayload({ ...payload(), expiry_date: bad }).ok).toBe(false);
    }
  });

  it('refuses an expiry before the activation, which is a certificate that cannot be true', () => {
    // The issuer's mistake, caught here rather than at the first request —
    // "expired" and "not yet valid" are both answers nobody wants to
    // discover from a school.
    const result = parseLicencePayload({
      ...payload(),
      activation_date: '2027-01-01T00:00:00Z',
      expiry_date: '2026-01-01T00:00:00Z',
    });

    expect(result.ok).toBe(false);
  });

  it('refuses a wholly non-object payload', () => {
    for (const bad of ['a string', 42, null, [1, 2]]) {
      expect(parseLicencePayload(bad).ok).toBe(false);
    }
  });
});
