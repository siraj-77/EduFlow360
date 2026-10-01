/**
 * ARC-08 — the source of truth for the PROJECT-WIDE ERD and the REFERENCE
 * ARCHITECTURE. Both diagrams render from this file, and
 * `src/config/project-erd.spec.ts` gates the result.
 *
 * WHY A PROJECT ERD IS NOT JUST A BIGGER ARC-01 ERD
 * -------------------------------------------------
 * ARC-01 draws fourteen tables that exist and are generated into a Prisma
 * schema. A project-wide ERD has to cover thirty-plus modules, of which the
 * corpus names entities for some and only prose for others. The temptation is
 * to draw a plausible `Student`, `Vehicle` and `Wallet` to fill the page. That
 * is exactly what `docs/idea-bank/README.md` §6 rule 5 forbids — a fabricated
 * rule is worse than a missing one, because a missing one is visible — and it
 * is what `AGENTS.md` §6 means by withdrawing the "35 entities" figure rather
 * than replacing it with another invented number.
 *
 * So this file carries an evidence tier on every row, and the tier is the most
 * important column in it:
 *
 *   SPECIFIED — the corpus names the entity AND its fields. Drawable.
 *   NAMED     — the corpus names the entity or the record but not its fields.
 *              Drawable as a box; its fields are a GAP, not a guess.
 *   MODULE    — the module exists with a licence gate and named concepts, but
 *              no entity name. Drawn as a module, never as a table.
 *   GAP       — named as a `PC-xxx` requirement gap. Drawn AS A GAP, with the
 *              ticket, because the absence is the information.
 *
 * A row may only be drawn at the tier its evidence supports. `ERD_TIER_NOTES`
 * below states the rule each tier obeys, and the gate checks the counts.
 *
 * SOURCES, abbreviated exactly as the diagram labels them
 * ------------------------------------------------------
 *   SRS §6     — `EduFlow_SRS_TestPlan_MVP_Roadmap_v1.2.md` §6, the only place
 *                in the corpus that names entities as a list. 35 of them.
 *   MP §5      — `EduFlow_Project_Master_Plan_v5.2.md` §5, the module tree.
 *   MP §17.x   — the same document's retail/hall/wallet sections, newer than
 *                the idea-bank extraction and therefore not yet reflected in it.
 *   ARC-01     — the shipped Platform Core ERD and its generated schema.
 *   ADR-00n    — a decision record.
 *   AGENTS.md  — the governing contract.
 */

/* ------------------------------------------------------------------ *
 * 1. Platform Core — the only entities with a generated schema
 * ------------------------------------------------------------------ */

/**
 * The fourteen tables of `ARC-01`, verbatim. This list is not a summary of the
 * platform; it is the generated model list, and `prisma-schema.spec.ts` fails
 * the build if a fifteenth appears. Duplicating the names here rather than
 * importing them would let the two diagrams disagree, so the gate checks this
 * array against the schema source.
 */
export const PLATFORM_CORE_ENTITIES = [
  'User',
  'Role',
  'Permission',
  'RolePermission',
  /**
   * `D-4.1`: multi-role. Added 2026-09-30 as the fifteenth model, which makes
   * this the SECOND tripwire that has to move with it — `prisma-schema.spec.ts`
   * keeps its own `PLATFORM_CORE_MODELS` list, and `project-erd.spec.ts` fails
   * if this and the schema disagree. Both are satisfied here rather than one
   * being relaxed, because the tripwire exists to catch a second tenancy
   * concept, not to enforce a model count.
   */
  'UserRole',
  'Session',
  'RefreshToken',
  'AuditRecord',
  'ErrorLog',
  'SchoolSettings',
  'ModuleRegistry',
  'License',
  'NotificationPreference',
  'NotificationDelivery',
  'StoredFile',
];

/* ------------------------------------------------------------------ *
 * 2. The seven shared engines — AGENTS.md §2.9
 * ------------------------------------------------------------------ */

/**
 * One engine per concern. `covers` is what it absorbs; `forbids` is the second
 * engine this row exists to prevent. Both halves are on the diagram, because
 * a rule that only names the engine leaves the tempting alternative unnamed.
 */
export const SHARED_ENGINES = [
  {
    concern: 'Attendance',
    engine: 'AttendanceRecord',
    seam: 'IAttendanceCaptureAdapter',
    covers: 'student · teacher · staff; transport, hostel, club, video as contexts',
    forbids: 'a second attendance model',
  },
  {
    concern: 'Stock',
    engine: 'ledger-style StockMovement',
    seam: 'shared stock engine (§20)',
    covers: 'asset consumables · BookShop · Canteen',
    forbids: 'a bare on-hand field; per-outlet stock models',
  },
  {
    concern: 'Facility booking',
    engine: 'IFacilityBookingAdapter',
    seam: 'checkAvailability · approve · generateInvoice',
    covers: 'pool · courts · grounds · IT lab · School Hall',
    forbids: 'per-facility booking tables',
  },
  {
    concern: 'Approvals',
    engine: 'IApprovalWorkflow',
    seam: 'one chain engine',
    covers: 'leave · gate passes · hall hire · certificates · wallet refunds · tickets',
    forbids: 'per-module approval chains',
  },
  {
    concern: 'Documents',
    engine: 'Document/Print engine',
    seam: 'versioned templates',
    covers: 'ID cards · certificates · report cards · receipts · hire agreements',
    forbids: 'per-document PDF pipelines',
  },
  {
    concern: 'Notifications',
    engine: 'INotificationChannelAdapter router',
    seam: 'email (default) · SMS · WhatsApp · push',
    covers: 'every alert and message',
    forbids: 'one-off integrations inside a module',
  },
  {
    concern: 'Ledger',
    engine: 'ILedgerPostingRule',
    seam: 'one rule per transaction type',
    covers: 'fees · payroll · hall hire · fines · outlet settlement · wallet',
    forbids: 'a feature module writing journal_entries directly',
  },
];

/* ------------------------------------------------------------------ *
 * 3. Requirement gaps — AGENTS.md §6.1
 * ------------------------------------------------------------------ */

/**
 * Drawn as gaps, on purpose. Each is a place where the corpus has a capability
 * and no data model, so drawing a table there would convert a documented hole
 * into unearned certainty.
 */
export const GAPS = [
  {
    id: 'PC-000',
    title: 'Attendance',
    detail: 'no design at all — MP §8 defers to a v3.0 document not in this repository',
    blocks: 'Attendance module',
  },
  {
    id: 'PC-001',
    title: 'Leave / Workforce',
    detail: 'no design at all — accrual, approval chain and substitution undesigned',
    blocks: 'Workforce, leave accrual',
  },
  {
    id: 'PC-002',
    title: 'Grading & Moderation',
    detail: 'P0 with zero rules — no threshold, grade band or moderation workflow',
    blocks: 'Exams, report cards, promotion, analytics',
  },
  {
    id: 'PC-003',
    title: 'Tax & currency',
    detail: 'never mentioned despite invoicing; FX and tax rules undecided',
    blocks: 'Fees, payroll, procurement',
  },
  {
    id: 'PC-004',
    title: 'Admission',
    detail: 'in the MVP list with no FR behind it; MP §30 demands an entity set',
    blocks: 'MVP scope',
  },
  {
    id: 'PC-005',
    title: 'BookShop / Canteen / Hall',
    detail: 'specified in MP §17.6–17.9, newer than the extraction; no sale record',
    blocks: 'Retail outlets, hall rental',
  },
  {
    id: 'PC-006',
    title: 'Student Wallet',
    detail: 'four prose rules, no stored-value legal review, no GL design',
    blocks: 'Wallet',
  },
];

/* ------------------------------------------------------------------ *
 * 4. Modules — the project map
 * ------------------------------------------------------------------ */

/**
 * Every module the corpus scopes, with the licence gate it carries.
 *
 * `tier` is the evidence tier, and it decides how much the diagram may say:
 *   SPECIFIED — entities named with fields; the module box lists them.
 *   NAMED     — entities named, fields undesigned; listed, marked as gaps.
 *   MODULE    — capability only; the box names concepts and draws no table.
 *
 * `gate` is the corpus's own wording. Six §3 capabilities have NO key in the
 * signed certificate's `allowed_modules` or `features` (facilities hire, hall
 * rental, wallet, alumni, leadership, substitution) — flagged on the diagram
 * as GAP-GATE-1, because an entitlement guard cannot be written against a
 * capability the licence payload cannot name.
 */
export const MODULES = [
  {
    name: 'Platform Core',
    tier: 'SPECIFIED',
    gate: 'all editions',
    source: 'ARC-01 · generated schema',
    entities: PLATFORM_CORE_ENTITIES,
    note: 'fourteen tables, generated from one source; no Student/Class/Teacher',
  },
  {
    name: 'Academic',
    tier: 'SPECIFIED',
    gate: 'all editions',
    source: 'SRS §6 · MP §5',
    entities: [
      'AcademicYear',
      'EducationStage',
      'Grade',
      'Section',
      'Subject',
      'Curriculum',
      'Student',
      'Guardian',
      'Staff',
      'Enrollment',
      'Exam',
      'MarkEntry',
      'ReportCard',
      'PromotionDecision',
    ],
    note: 'hierarchy named; timetable entry, academic period and promotion rule are MODULE tier',
  },
  {
    name: 'Attendance',
    tier: 'NAMED',
    gate: 'all editions',
    source: 'SRS §6 · PC-000',
    entities: ['AttendanceRecord'],
    note: 'one actor-agnostic record; policy, session, regularization and review queue are PC-000 gaps',
  },
  {
    name: 'Workforce',
    tier: 'NAMED',
    gate: 'Basic: basic · Standard+',
    source: 'SRS §6 · PC-001',
    entities: ['LeaveRequest', 'LeaveBalance'],
    note: 'leave type, approval chain, substitution and rosters undesigned (PC-001)',
  },
  {
    name: 'Finance',
    tier: 'SPECIFIED',
    gate: 'Basic: basic fees · Standard+',
    source: 'MP §5.2 · ADR-002',
    entities: ['Invoice', 'Payment', 'Chart of Accounts', 'Journal Entry', 'Journal Line'],
    note: '§5.2 is the only concrete financial model in the corpus; entry+line forced by the balance invariant',
  },
  {
    name: 'Learning & Collaboration',
    tier: 'NAMED',
    gate: 'Basic: homework · Standard+',
    source: 'SRS §6 · MP §10',
    entities: ['Assignment', 'Submission', 'VideoSession'],
    note: 'rubric, lesson plan and participant records undesigned',
  },
  {
    name: 'Identity & Documents',
    tier: 'NAMED',
    gate: 'Basic: ID template · Standard+',
    source: 'SRS §6 · MP §12',
    entities: ['IdCard', 'Certificate', 'Document Template', 'Template Version'],
    note: 'the ID-card QR is the shared credential for attendance, library and asset custody',
  },
  {
    name: 'Library',
    tier: 'MODULE',
    gate: 'Standard+',
    source: 'MP §13',
    entities: [],
    note: 'zero entity names in the corpus — circulation, fines and catalog are capability words only',
  },
  {
    name: 'Transport',
    tier: 'MODULE',
    gate: 'Standard: basic · Deluxe+: live',
    source: 'MP §14',
    entities: [],
    note: 'vehicle, driver, route and stop undesigned, yet Helpdesk deep-links a trip log',
  },
  {
    name: 'Hostel',
    tier: 'MODULE',
    gate: 'Deluxe/Enterprise add-on',
    source: 'MP §15',
    entities: [],
    note: 'building, room, bed, gate pass and visitor undesigned; gate has no certificate key',
  },
  {
    name: 'Assets',
    tier: 'NAMED',
    gate: 'Standard: basic · Deluxe+',
    source: 'SRS §6 · MP §20',
    entities: ['Asset', 'Supplier', 'Purchase Order', 'Goods Receipt', 'Stock Item'],
    note: 'allocation, custody transfer and maintenance undesigned; auto-POs stay drafts',
  },
  {
    name: 'Facilities & Hall',
    tier: 'NAMED',
    gate: 'Standard: internal · Deluxe+: external hire',
    source: 'SRS §6 · MP §17.6',
    entities: ['Facility', 'FacilityBooking', 'Rate Card', 'External Hirer'],
    note: '9-stage hall lifecycle named, no entity per stage; tentative hold is the one auto-expiring state',
  },
  {
    name: 'Retail & Concessions',
    tier: 'NAMED',
    gate: 'Standard: school-run · Deluxe+: third-party',
    source: 'MP §17.7–17.9 · PC-005',
    entities: ['Outlet', 'Catalog Item', 'Concession Contract', 'Compliance Document'],
    note: 'operator_model is the corpus’s only effective-dated field; the sale record is a GAP',
  },
  {
    name: 'Student Wallet',
    tier: 'MODULE',
    gate: 'Enterprise add-on',
    source: 'MP §17.10 · PC-006',
    entities: [],
    note: 'a GL liability; no cash-out; refunds on exit via approval. Optional pending legal review',
  },
  {
    name: 'Events & Sports',
    tier: 'MODULE',
    gate: 'Standard: basic · Deluxe+',
    source: 'MP §16',
    entities: [],
    note: 'shared event calendar; houses, clubs and the achievement ledger are concept-only',
  },
  {
    name: 'Alumni',
    tier: 'NAMED',
    gate: 'Deluxe: directory · Enterprise: giving',
    source: 'SRS §6 · MP §18',
    entities: ['AlumniProfile'],
    note: 'consent-gated 1:1 from Student; adults get a different privacy model',
  },
  {
    name: 'Leadership & Prefects',
    tier: 'NAMED',
    gate: 'Standard: basic · Deluxe+',
    source: 'SRS §6 · MP §19',
    entities: ['LeadershipRole'],
    note: 'term of office auto-expires at year-end, reusing the promotion cycle',
  },
  {
    name: 'Communication',
    tier: 'NAMED',
    gate: 'Standard+',
    source: 'SRS §6 · MP §23',
    entities: ['Notification'],
    note: 'router falls back to email; SMS and WhatsApp are per-message billed so they digest',
  },
  {
    name: 'Helpdesk',
    tier: 'NAMED',
    gate: 'Standard: basic · Deluxe+: SLA',
    source: 'SRS §6 · MP §22',
    entities: ['Ticket'],
    note: 'the one polymorphic deep-link in the corpus; concession disputes carry the sales log as evidence',
  },
  {
    name: 'AI Services',
    tier: 'MODULE',
    gate: 'Deluxe+ · Insights: Enterprise',
    source: 'MP §21',
    entities: [],
    note: 'no entity named anywhere; a write always needs human confirmation',
  },
  {
    name: 'Mobile',
    tier: 'NAMED',
    gate: 'Standard+',
    source: 'SRS §6 · MP §24 · ADR-005',
    entities: ['Device'],
    note: 'milestone 2; the 72-hour offline queue has no entity in any document',
  },
  {
    name: 'Integrations',
    tier: 'MODULE',
    gate: 'Deluxe+ · APIs: Enterprise',
    source: 'AGENTS.md §2.2 · MP §23',
    entities: [],
    note: 'adapters only, and correctly so — no entity is the right answer here',
  },
];

/* ------------------------------------------------------------------ *
 * 5. Rules the diagram must carry, and the tiers they come from
 * ------------------------------------------------------------------ */

export const ERD_TIER_NOTES = [
  'SPECIFIED — corpus names the entity and its fields',
  'NAMED — corpus names the entity, not the fields; fields are a GAP',
  'MODULE — capability exists, no entity name; drawn as a module, never a table',
  'GAP — a documented PC-xxx hole, drawn as a hole so it stays visible',
];

/** The four load-bearing structural statements the ERD asserts in prose. */
export const ERD_STRUCTURE_RULES = [
  {
    heading: 'One database per school',
    body: 'one PostgreSQL database and one deployment per school (ADR-003). Isolation is physical, so school_id is metadata — there is no `School` table, no tenant scoping and no cross-tenant role. Uniqueness is scoped inside the one database, never global.',
  },
  {
    heading: 'Money is integer minor units',
    body: 'every amount carries an explicit currency code and integer minor units (ADR-002). Scale and rounding mode are per-school settings, never constants. Nothing in this system uses a real-number money type.',
  },
  {
    heading: 'Seven engines, one each',
    body: 'attendance, stock, booking, approvals, documents, notifications and ledger are each built once and extended by implementing an interface (AGENTS.md §2.9).',
  },
  {
    heading: 'The ledger has one door',
    body: 'no feature module writes journal_entries directly. Every financial transaction posts through ILedgerPostingRule, and an entry whose debits and credits differ is rejected in the domain before it reaches the database.',
  },
];

/**
 * The prohibitions, drawn as statements rather than by omission. `SRS` §6 names
 * a `School` table and `SUPER_ADMIN`-style roles exist in the legacy app, so a
 * reviewer needs to see that the discrepancy was decided rather than missed.
 */
export const ERD_PROHIBITIONS = [
  'no `School` table — one database per school makes it a second tenancy concept (ADR-003)',
  'no cross-tenant aggregate query and no cross-tenant role; SUPER_ADMIN does not exist here',
  'audit_records is append-only, with no foreign key to users — the actor is recorded by value',
  'no money column on notification_deliveries — a per-message bill posts through ILedgerPostingRule',
  'no second attendance model, no second stock engine, no second ledger, no per-module approvals',
];

/* ------------------------------------------------------------------ *
 * 6. Reference architecture
 * ------------------------------------------------------------------ */

/**
 * The layer stack, with the import rule that defines each boundary. `may` and
 * `mayNot` are on the diagram because a boundary nobody can see is a boundary
 * nobody enforces.
 */
export const ARCH_LAYERS = [
  {
    name: 'Presentation',
    detail: 'controllers · pages · Zod DTOs',
    may: 'use-cases, DTOs, guards',
    mayNot: 'Prisma, domain rule logic',
  },
  {
    name: 'Application',
    detail: 'use-cases — orchestration only',
    may: 'domain, ports',
    mayNot: 'adapter implementations, Prisma, NestJS decorators',
  },
  {
    name: 'Domain',
    detail: 'entities · rule engines · repository interfaces · adapter ports',
    may: 'other domain files, shared-types, IClock',
    mayNot: '@nestjs/*, Prisma, BullMQ, any UI library, any vendor SDK',
  },
  {
    name: 'Infrastructure',
    detail: 'Prisma repositories · vendor adapters · queue and cache clients',
    may: 'vendor SDKs, ports',
    mayNot: 'domain rules',
  },
];

/** `AGENTS.md` §2.3 — fail-closed, all three compose, none optional. */
export const ARCH_GUARDS = [
  {
    decorator: '@RequirePermission',
    enforces: "the user's role grants this action",
    note: 'a route with neither this nor @Public is a defect; CI fails on it',
  },
  {
    decorator: '@RequireEntitlement',
    enforces: "the school's licence includes this feature",
    note: 'stops a Basic school reaching Deluxe by calling the API directly',
  },
  {
    decorator: '@Audited',
    enforces: 'the action is recorded append-only',
    note: 'required on finance, grades, permissions, overrides and postings',
  },
  {
    decorator: '@Public',
    enforces: 'the only exemption from @RequirePermission',
    note: 'the reason is mandatory and every use is in a checked-in allowlist',
  },
];

/**
 * `AGENTS.md` §2.2 — the seams. Listed with their vendors so the diagram shows
 * that the choice lives in infrastructure, not in a use-case.
 */
export const ARCH_ADAPTERS = [
  { port: 'IWhatsAppAdapter', vendors: 'Vvaslution API', state: 'named' },
  { port: 'ISmsAdapter', vendors: 'provider deliberately undecided', state: 'undecided' },
  { port: 'IBellHardwareAdapter', vendors: 'IP relay controller', state: 'named' },
  { port: 'IVideoConferenceAdapter', vendors: 'Zoom · Meet · Jitsi', state: 'named' },
  {
    port: 'IAttendanceCaptureAdapter',
    vendors: 'manual · QR · biometric · RFID · geo-fence',
    state: 'named',
  },
  { port: 'IStorageAdapter', vendors: 'S3-compatible · MinIO in dev', state: 'named' },
  { port: 'INotificationChannelAdapter', vendors: 'email · SMS · WhatsApp · push', state: 'named' },
  { port: 'IPaymentGatewayAdapter', vendors: 'per-school configured gateway', state: 'undecided' },
  {
    port: 'IFacilityBookingAdapter',
    vendors: 'one engine for every bookable resource',
    state: 'named',
  },
];

export const ARCH_DEPLOYMENT = {
  title: 'One school, one deployment, one database',
  body: 'Physical isolation. A missing WHERE clause cannot leak across schools because no other school’s rows exist in this database — one database per school, one deployment per school. school_id is carried for auditability and licence portability — it is metadata, not a security control.',
  stores: [
    {
      name: 'PostgreSQL',
      role: 'the only database · one per school · migrations applied per school',
    },
    { name: 'Redis + BullMQ', role: 'cache and queue · not a store of record' },
    { name: 'S3-compatible', role: 'object bytes · behind IStorageAdapter, private buckets only' },
  ],
  note: 'audit_records immutability is a database privilege and a trigger, not a convention (ADR-013, hardening SQL).',
};

export const ARCH_CLOSING = [
  'Time is injected — IClock, never the ambient clock (ADR-004).',
  'Money is never a float, and rounding is a per-school setting (ADR-002).',
  'Automation and AI output are drafts until a person approves (AGENTS.md §2.11).',
  'Offline-first surfaces queue locally and resolve conflicts through an admin-review queue (AGENTS.md §2.12).',
  'Single-tenant isolation is physical, so tenancy-scoping machinery is never built (AGENTS.md §2.1).',
];
