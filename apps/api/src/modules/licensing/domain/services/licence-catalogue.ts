/**
 * The keys a licence may name: modules and features (`PLT-301`, `ADR-023`).
 *
 * ## Why a catalogue instead of "accept any string"
 *
 * The alternative is not openness, it is silence. A certificate listing
 * `academiks` would verify perfectly, load perfectly, and deliver a school
 * with no academics module — and the only way anyone would find out is a
 * teacher noticing. `permission-catalogue.ts` takes the same posture for
 * permissions for the same reason, and so does `OwnershipPolicyRegistry` when
 * it throws on an entity with no policy: unknown is a DEFECT, and the cost of
 * naming things is one line per thing.
 *
 * ## The sources, so a future reader can check them
 *
 * - Modules: Master Plan §4.2's certificate example (eighteen keys) plus the
 *   six `ADR-023` named for §3's edition matrix (`facilities`,
 *   `alumni_network`, `student_leadership` as module keys; `hall_rental_pack`
 *   and `student_wallet` as feature keys; `substitution_auto_assignment` was
 *   already present).
 * - Features: Master Plan §4.2's `features` block (nine keys) plus the two
 *   `ADR-023` added.
 *
 * NOTEBOOK: `ai_timetable` appears in the module list AND
 * `ai_timetable_assistant` appears in features. Both are in the corpus; the
 * module gates the module registry row and the feature gates the capability
 * within it, which is the distinction `ADR-023` states.
 */

/** A module key: gates a row in `ModuleRegistry` (`PLT-602`). */
export type ModuleKey = string;

/** A feature key: gates a capability, within or above a module (`ADR-023`). */
export type FeatureKey = string;

/** The module keys a certificate may grant. */
export const MODULE_KEYS: ReadonlySet<string> = Object.freeze(
  new Set<string>([
    // Master Plan §4.2's certificate example.
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
    // ADR-023: the keys §3's matrix gates that §4.2's example predates.
    'facilities',
    'alumni_network',
    'student_leadership',
  ]),
);

/** The feature keys a certificate may grant. */
export const FEATURE_KEYS: ReadonlySet<string> = Object.freeze(
  new Set<string>([
    // Master Plan §4.2's `features` block.
    'ai_timetable_assistant',
    'ai_chatbot',
    'led_matrix_noticeboard',
    'custom_curriculum',
    'staff_leave_accrual_engine',
    'substitution_auto_assignment',
    'video_conferencing_provider',
    'hostel_module',
    'sso_integration',
    // ADR-023.
    'hall_rental_pack',
    'student_wallet',
  ]),
);

/**
 * The limit keys a certificate may carry.
 *
 * Enumerated from the corpus example's seven, and strict for the catalogue's
 * reason: an unknown limit key is a limit the system would silently not
 * enforce. A new module with a new limit adds its key here, which is a
 * reviewable change — the same posture as the permission catalogue.
 */
export const LIMIT_KEYS: ReadonlySet<string> = Object.freeze(
  new Set<string>([
    'maximum_students',
    'maximum_staff',
    'maximum_devices',
    'maximum_mobile_devices',
    'maximum_biometric_terminals',
    'maximum_video_class_concurrent_sessions',
    'maximum_id_cards_per_batch',
  ]),
);
