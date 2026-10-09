# EduFlow — School Setup Workflow Process Plan
## Setting up a school from the beginning: discovery → provisioning → configuration → data → UAT → go-live → first year-end

**Version:** 1.0 · **Date:** September 28, 2026
**Companion documents:** Master Plan v5.2 · SRS v1.2 · AGENTS.md · Platform Core Jira Plan
**Audience:** Implementation team, School Owner/Principal, School Admin, Finance Officer, IT contact, QA/Trainers
**Deployment model reminder:** EduFlow is **single-tenant** — every school gets its **own database and its own application deployment** (AGENTS.md §2.1). "Setting up a school" therefore means provisioning a fresh instance, activating its licence, and configuring it — not creating a row in a shared system.

> **Provisional areas.** Attendance, Leave/Workforce and Grading & Moderation are being designed fresh (tickets `PC-000`, `PC-001`, `PC-002`); Tax & currency (`PC-003`) and Admission (`PC-004`) have no design yet; BookShop/Canteen/Hall (`PC-005`) and Student Wallet (`PC-006`) are proposed. Steps touching these are marked **⚠ Provisional** and must be re-validated once the design lands. Mobile app setup is **milestone 2** and marked **📱 M2**.

---

## Table of Contents

0. How to read this plan
1. Roles and responsibilities
2. Setup overview and phase map
3. Phase 0 — Discovery and readiness
4. Phase 1 — Commercial and licence preparation
5. Phase 2 — Infrastructure provisioning (vendor side)
6. Phase 3 — First launch, licence activation, first administrator
7. Phase 4 — School profile and global settings
8. Phase 5 — Module enablement
9. Phase 6 — Roles, permissions and users
10. Phase 7 — Academic structure
11. Phase 8 — Staff and student onboarding
12. Phase 9 — Attendance and workforce configuration ⚠
13. Phase 10 — Finance and General Ledger setup ⚠
14. Phase 11 — Learning and communication
15. Phase 12 — Operations modules
16. Phase 13 — Documents and templates
17. Phase 14 — Integrations and hardware
18. Phase 15 — Data migration and import
19. Phase 16 — Security, audit and backup verification
20. Phase 17 — Testing and User Acceptance (UAT)
21. Phase 18 — Training
22. Phase 19 — Go-live cut-over
23. Phase 20 — Hypercare and first-term stabilisation
24. Phase 21 — Year-end rollover and continuous operation
25. Appendices (A–J)

---

## 0. How to read this plan

**Phase card format.** Every phase uses the same structure so it can be turned into tickets:

| Block | Meaning |
|---|---|
| **Objective** | Why the phase exists |
| **Owner / Support** | Who is accountable / who helps |
| **Inputs** | What must exist before starting |
| **Steps** | Numbered `P.S` actions (e.g. `7.4`) — each is a ticket candidate |
| **Outputs** | Tangible results |
| **Exit gate** | Pass/fail checks; do not start dependent phases until passed |
| **Pitfalls** | Known ways this goes wrong |
| **Effort** | Indicative duration (calendar) |

**Legend:** ✅ done-check · ⚠ Provisional design · 📱 M2 (mobile milestone 2) · 🔒 security-critical · 🧾 audited action · 🤖 human-approval-required (AI/automation output) · 🌐 needs internet/vendor.

**Ordering principle.** Configuration flows **top-down and dependency-first**:
Licence → Settings → Roles → Academic structure → People → Policies → Finance → Modules → Data → Test → Train → Go-live. Nothing that needs a parent record is set up before the parent exists (e.g. sections need grades, fee assignments need students and fee structures).

---

## 1. Roles and responsibilities

| Role | Side | Responsibility in setup |
|---|---|---|
| **Implementation Lead** | Vendor | Owns the plan, timeline, gates, risk log |
| **Solution Architect / DevOps** | Vendor | Provisioning, environments, secrets, backups, monitoring |
| **Support Engineer** | Vendor | Licence issuance/activation help, integrations, migration scripts |
| **Trainer / QA** | Vendor | Test scenarios, UAT facilitation, training |
| **School Owner / Principal** | School | Decisions, sign-offs, policy approval, final go-live approval |
| **School Administrator ("Super Admin (in-school)")** | School | Day-to-day configuration owner; first EduFlow user |
| **Academic Coordinator / VP** | School | Academic structure, timetable, curriculum, grading decisions |
| **Finance Officer / Accountant** | School | Chart of accounts, fees, tax, opening balances |
| **HR Officer** | School | Staff data, leave policy, contracts |
| **IT Contact** | School | Network, devices, email domain, hardware hookup |
| **Data Champion** | School | Cleans and signs off migrated data |
| **Vendor contacts (concessionaires, transport, etc.)** | Third party | Provide contract/compliance documents for outlets |

### 1.1 RACI (summary — full matrix in Appendix C)

| Activity | Impl. Lead | DevOps | Principal | School Admin | Finance | Academic Coord. | IT |
|---|---|---|---|---|---|---|---|
| Discovery questionnaire | A/R | – | C | R | C | R | C |
| Licence issuance | A/R | I | C | I | – | – | – |
| Provisioning | A | R | – | – | – | – | C |
| School settings | C | – | A | R | C | C | – |
| Roles & permissions | C | – | A | R | I | I | – |
| Academic structure | C | – | A | R | – | R | – |
| Fee & GL setup | C | – | A | C | R | – | – |
| Data migration | A | R | I | R | R | R | C |
| UAT sign-off | R | – | A | R | R | R | C |
| Go-live decision | R | R | A | R | R | R | C |

(A = accountable, R = responsible, C = consulted, I = informed.)

---

## 2. Setup overview and phase map

```
DISCOVERY        COMMERCIAL       PROVISIONING     ACTIVATION        CORE CONFIG
Phase 0  ──────► Phase 1  ──────► Phase 2  ──────► Phase 3  ──────► Phase 4-6
readiness        edition,         DB, app,         licence,          settings,
questionnaire    licence key      secrets,         first admin       modules,
                                  backups                            roles/users
                                                                        │
   ┌────────────────────────────────────────────────────────────────────┘
   ▼
ACADEMIC & PEOPLE                POLICIES & MONEY              MODULES & INTEGRATIONS
Phase 7 structure ─► Phase 8     Phase 9 attendance/leave ⚠    Phase 11 learning/comm
years, grades,       staff &     Phase 10 finance & GL ⚠       Phase 12 operations
sections, subjects   students                                  Phase 13 documents
                                                               Phase 14 integrations
   │
   ▼
DATA & QUALITY ──► TEST ──► TRAIN ──► GO-LIVE ──► HYPERCARE ──► YEAR-END
Phase 15-16        Phase 17  Phase 18  Phase 19     Phase 20      Phase 21
```

### 2.1 Gate summary

| Gate | After phase | Question it answers |
|---|---|---|
| **G0 Readiness** | 0 | Do we have what we need to start? |
| **G1 Licence ready** | 1 | Is the licence issued and correct? |
| **G2 Environment ready** | 2 | Is the instance healthy, secured and backed up? |
| **G3 Activated** | 3 | Is the licence active and is the first admin in? |
| **G4 Foundation configured** | 4–6 | Settings, modules, roles, users done? |
| **G5 Academic + people ready** | 7–8 | Can classes and people exist? |
| **G6 Operations ready** | 9–14 | Are policies, finance and modules configured? |
| **G7 Data verified** | 15–16 | Is migrated data correct and safe? |
| **G8 UAT signed off** | 17 | Does it work for real scenarios? |
| **G9 Go-live approved** | 18–19 | Are people trained and cut-over ready? |

### 2.2 In-app Setup Wizard (recommended product feature)

The SRS calls for an Admin Setup Wizard. Recommended design so this whole plan becomes self-service where possible:

- A persistent **Setup Progress** panel on the Admin dashboard with a readiness percentage and per-step status (Not started / In progress / Done / Blocked).
- Steps are **resumable and order-aware**: dependent steps stay locked until prerequisites are done.
- Every wizard step maps to a phase below (Appendix D).
- Completion of a step is **audited** 🧾; skipping requires a reason.
- A **Setup Health check** flags common gaps (e.g. "students exist but no fee structure assigned", "sections without a class teacher").

---

## 3. Phase 0 — Discovery and readiness

**Objective:** Learn the school well enough to size, price, configure and plan the setup; collect the raw data early because data collection is the usual critical-path delay.
**Owner:** Implementation Lead · **Support:** School Admin, Principal, Academic Coordinator, Finance, IT
**Inputs:** Signed engagement/intent; a named School Admin and Principal.
**Effort:** 1–2 weeks

### Steps

**3.1 Kick-off meeting**
1. Agree goals, scope (modules), target go-live date (align to a term/semester start, not mid-exam).
2. Confirm governance: who approves what; weekly checkpoint cadence.
3. Set communication channel and single point of contact per side.
4. Record decisions in the **Decision Log** (Appendix G).

**3.2 School profile questionnaire** (Appendix B has the full form)
1. Legal name, short name, registration/licence numbers, address(es), contacts, logo, seal, principal signature image.
2. Campus count (EduFlow deployment is one school; a multi-campus group needs a separate deployment per school or an agreed design — record it as a risk).
3. Student and staff headcount (drives **licence limits**: `maximum_students`, `maximum_staff`).
4. Operating days, school hours, break/assembly patterns, weekends (may differ by country, e.g. Fri–Sat).
5. Languages of instruction and communication → which of **English / Tamil / Sinhala / Arabic** to enable, and the **default language**.
6. Time zone, currency, tax status (VAT/GST applicability), fiscal year, **academic year** start/end.

**3.3 Academic questionnaire**
1. Education stages and grade range (KG1–Grade 13 / Year 1–13); naming style ("Grade 5" vs "Year 5").
2. **Academic period model:** Annual, Semester, Trimester/Term, Quarter, or custom — and dates.
3. Curricula in use (National, Cambridge, IB, custom); which grades run which **tracks**; any grade with two concurrent tracks.
4. Sections per grade, group/stream splits (e.g. Science/Commerce), house system.
5. Grading schemes per curriculum (A*–F, 1–7, GPA, descriptive, pass/fail) ⚠ Provisional (`PC-002`).
6. Report-card format preferences (A4/A5, narrative vs grade table) per curriculum track.
7. Promotion rules (automatic, criteria-based, manual review) and minimum attendance for exam eligibility.
8. Timetable style: periods per day, period length, double periods, labs.

**3.4 Operations questionnaire**
1. Attendance approach: per period or daily; capture sources (manual, QR, biometric, RFID, mobile); who marks it ⚠ Provisional (`PC-000`).
2. Staff attendance: shifts, geo-fencing, biometric terminals; overtime rules ⚠.
3. Leave types, entitlements, approval chains, carry-forward rules; statutory leave by country ⚠ Provisional (`PC-001`).
4. Transport: buses, drivers, routes, GPS trackers, fee model.
5. Library: catalogue size, barcode/QR use, fine policy.
6. Hostel: yes/no (optional add-on).
7. Facilities: swimming pool, football ground, courts, IT lab, **School Hall** — which are bookable, which are hired to outsiders, rate cards, supervision needs.
8. **BookShop and Canteen:** does each exist; is it **school-run** or run by a **third party**; contract terms if third-party (rent/commission %, term, compliance documents). ⚠ Provisional (`PC-005`).
9. Wallet: does the school want a prepaid Student Wallet? (Requires legal review — `PC-006`.)
10. Clubs, prefect system, sports houses, alumni programme.
11. Helpdesk/complaints handling process.

**3.5 Finance questionnaire**
1. Fee structure: categories (tuition, transport, hostel, activity, exam, uniform, books), frequency (monthly/termly/annual), installments, sibling/staff-child discounts, scholarships, late fines.
2. Taxes on fees/sales; e-invoicing mandates in the country ⚠ Provisional (`PC-003`).
3. Payment methods: cash, bank transfer, cheque, card/online gateway (which provider), mobile wallets.
4. Existing chart of accounts / accounting system; who keeps the books; opening balances date.
5. Payroll: in scope or not; salary structure, allowances, deductions, pay cycle.
6. Receipt/invoice numbering conventions; currency display and rounding rules.

**3.6 Technology questionnaire**
1. Hosting choice: school-owned server / vendor cloud / school's cloud tenancy; connectivity quality; whether **offline activation** is required (air-gapped).
2. Email sender domain (SPF/DKIM control), SMS provider preference (undecided by default), WhatsApp provider (per platform decision).
3. SSO expectations (Google/Microsoft/Apple/Facebook social login; Enterprise SAML/OAuth2).
4. Hardware inventory: biometric terminals, RFID readers, bell controller, TVs/LED boards, kiosk tablets, ID-card printer.
5. Devices for staff/parents; mobile OS mix. 📱 M2
6. Existing systems to migrate from; export formats (Excel/CSV/DB dumps).
7. Network: bandwidth, Wi-Fi coverage, firewall rules, static IP/domain.

**3.7 Data collection kick-off** (start immediately)
1. Issue import templates (Appendix E) for: staff, students, guardians, subjects, classes, fee structures, opening balances, library books, assets.
2. Assign a **Data Champion** and deadline for first extract.
3. Agree the data-cleaning rule: **the school owns data accuracy; the vendor owns transformation and validation.**

**3.8 Compliance and privacy readiness**
1. Identify applicable data-protection/child-safety rules; consent forms for photos, biometrics, alumni.
2. Decide data-retention periods by module (audit ≥ 7 years for finance actions per SRS NFR-07).
3. Confirm who the school's **Data Protection contact** is.
4. Confirm biometric usage legality (biometrics stored as irreversible hashes, never logged).

**3.9 Readiness assessment**
1. Score each questionnaire area (Complete / Partial / Missing).
2. List blockers and owners (e.g. "tax rules unknown → Finance, due date").
3. Produce the **Implementation Plan** with dates per gate.

### Outputs
Completed questionnaires · sized licence requirements · module list · decision log · risk register · implementation plan · data collection schedule.

### Exit gate G0 ✅
- [ ] All questionnaires ≥ "Partial" with owners for gaps
- [ ] Edition and module list agreed
- [ ] Headcounts confirmed for licence limits
- [ ] Go-live target date approved by Principal
- [ ] Data Champion named; templates issued
- [ ] Provisional areas (⚠) acknowledged by the school

### Pitfalls
Starting configuration before the academic calendar is final · undefined ownership of data cleaning · unrealistic go-live in the middle of exams · unknown tax rules discovered late · hidden second campus.

---

## 4. Phase 1 — Commercial and licence preparation

**Objective:** Turn the agreed scope into a correct, signed licence entitlement.
**Owner:** Implementation Lead · **Support:** Support Engineer, Principal
**Inputs:** G0 outputs.
**Effort:** 2–5 days

### Steps

**4.1 Choose the edition** (Basic / Standard / Deluxe / Enterprise) using the entitlement matrix (Master Plan §3).
1. Map each requested capability to its minimum edition; flag gaps (e.g. AI Timetable = Deluxe+, SSO = Enterprise).
2. Decide on add-ons: Hostel, Student Wallet, Giving/Fundraising.

**4.2 Define licence limits**
1. `maximum_students`, `maximum_staff`, `maximum_devices`, `maximum_mobile_devices`, `maximum_biometric_terminals`, video-class concurrency, ID-cards-per-batch.
2. Add growth headroom (typical +10–15%) to avoid an immediate limit breach.
3. Record what happens at the limit: creation blocked with an actionable error (PLT-302).

**4.3 Define licence term**
1. Activation date, expiry date, renewal reminder schedule.
2. Grace period for renewal-server unreachability (default 14 days).

**4.4 Issue the serial key and school identity**
1. Generate the **school_id** (unique, stable, e.g. `sch_om_muscat_01`) — it is metadata used in the licence and audit, **not** a security boundary.
2. Generate the serial key; bind allowed modules and features into the licence record on the activation server.
3. Confirm activation mode: **online** or **offline** (`.lic` file exchange).

**4.5 Licence review**
1. Read the certificate payload back to the school (edition, modules, limits, expiry).
2. School Owner signs off the scope.

### Outputs
Serial key (delivered securely) · licence record · school_id · signed scope sheet.

### Exit gate G1 ✅
- [ ] Edition, modules, features and limits match the signed scope
- [ ] Expiry and grace settings recorded
- [ ] Activation mode decided (online/offline)
- [ ] Serial key delivered over a secure channel to the School Admin only

### Pitfalls
Under-sizing limits · forgetting an add-on module · sharing the serial key in group chats · expiry set before the academic year ends.

---

## 5. Phase 2 — Infrastructure provisioning (vendor side)

**Objective:** Stand up an isolated, secured, backed-up instance for exactly one school.
**Owner:** DevOps · **Support:** IT contact, Support Engineer
**Inputs:** G1, hosting decision, domain name.
**Effort:** 2–4 days

### Steps

**5.1 Environment plan**
1. Create environments: **staging/UAT** (mirror of production) and **production**. Never use production for training or testing.
2. Decide hosting: vendor cloud, school-owned cloud, or on-premise Linux server.
3. Size compute, storage, Redis, and object storage from headcount and module list.

**5.2 Per-school database (physical isolation)**
1. Create a **dedicated PostgreSQL database** for this school. No other school's data may exist in it.
2. Create the **application DB role** with least privilege; **revoke `UPDATE`/`DELETE` on the audit table** from this role (defence in depth) 🔒.
3. Apply all migrations to this database.
4. Seed platform data: system roles (immutable), permission catalogue, default settings, default **Chart of Accounts template**, i18n resource bundles (`en`, `ta`, `si`, `ar`).
5. Verify schema version and record it in the provisioning log.

**5.3 Application deployment**
1. Deploy the API service and web app for this school (separate services; no server actions).
2. Configure the domain, DNS and **TLS certificate**; force HTTPS; set secure cookies/CORS.
3. Configure Redis and BullMQ workers (jobs: notifications, report cards, attendance detection, licence re-validation).
4. Configure object storage with **private buckets** and signed URLs (`IStorageAdapter`); set per-scope size/type limits.

**5.4 Secrets and configuration** 🔒
1. Generate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (`openssl rand -base64 32`), DB and Redis credentials, storage keys.
2. Embed the **licence public key**; keep the private signing key **only** on the activation server.
3. Store secrets in a secrets manager or git-ignored env files — **never in tracked files**.
4. Configure provider credentials as available: email, SMS (adapter placeholder until chosen), WhatsApp, payment gateway, video conferencing, OAuth (Google/Microsoft/Apple/Facebook) with **per-environment redirect URIs**.
5. App start-up must **fail fast** naming any missing variable.

**5.5 Logging and monitoring**
1. Structured JSON logging with correlation IDs and redaction; rotation 25 MB × 3 historical files.
2. Verify `ERROR`/`CRITICAL` reach **both** the file log and the DB error log.
3. Configure `/health/liveness` and `/health/readiness`; uptime monitor and alert routes.
4. Metrics/alert stubs: latency (attendance capture < 500 ms target) and error rate.

**5.6 Backup and recovery** 🔒
1. Nightly automated **encrypted** database backups; retention policy.
2. Object-storage versioning or backup for documents.
3. **Restore test:** restore a backup into staging and verify. A backup that has not been restored is not a backup.
4. Document RPO/RTO expectations agreed with the school.

**5.7 Security hardening**
1. Firewall/security-group rules; only required ports; admin access via VPN/allow-list.
2. Rate limiting; brute-force protection at the edge.
3. Dependency and container scan; baseline vulnerability scan on the deployment.
4. Time sync (NTP) — licence expiry and audit timestamps depend on it.

**5.8 Smoke test the empty instance**
1. Health checks green; migrations current; workers running.
2. Send a test email through the configured channel.
3. Upload and retrieve a test file through the storage adapter.

### Outputs
Running staging + production instances · provisioning log · secrets stored securely · backup + restore evidence · monitoring in place.

### Exit gate G2 ✅
- [ ] Dedicated DB with least-privilege role; audit table update/delete revoked
- [ ] HTTPS, private storage, secrets outside git
- [ ] Health, logging (file + DB), alerts working
- [ ] Backup taken **and restored** successfully
- [ ] Empty-instance smoke test passed

### Pitfalls
Sharing a database "temporarily" · secrets pasted in chat · no restore test · wrong server clock · e-mail domain not authenticated (SPF/DKIM) so invitations land in spam.

---

## 6. Phase 3 — First launch, licence activation, first administrator

**Objective:** Activate the licence and create the first School Administrator securely, with no default credentials.
**Owner:** Support Engineer · **Support:** School Admin, IT contact
**Inputs:** G2, serial key.
**Effort:** 0.5–1 day (offline: 1–3 days)

### Steps

**6.1 First-launch state**
1. A fresh instance boots into **locked "unlicensed" maintenance mode**: only the activation screen and health endpoints are reachable.
2. No default username/password exists. 🔒

**6.2 Licence activation — online 🌐**
1. School Admin opens the activation screen and enters the serial key.
2. The instance sends the serial key and hardware footprint (`school_id`, server fingerprint) to the activation server.
3. The server returns a **digitally signed certificate**; the instance verifies the signature against the embedded public key and stores it encrypted.
4. Entitlements are cached; modules and limits take effect (restart only if communicated).

**6.3 Licence activation — offline**
1. Admin generates a **system request token** locally.
2. Token is uploaded from an internet-connected device to the activation portal; the `.lic` file is downloaded.
3. Admin imports the `.lic` file; the same signature validation runs.
4. Store the `.lic` file and request token in the handover pack.

**6.4 Validate the certificate**
1. Confirm edition, allowed modules, limits, features, activation and expiry dates against the signed scope (G1).
2. Confirm tamper detection: a modified certificate is rejected and the app returns to locked mode (test in staging only).
3. Confirm grace-period behaviour is configured (default 14 days) and the admin banner appears when the server is unreachable.

**6.5 Create the first School Administrator** 🔒 🧾
1. Use a **one-time bootstrap setup token/link** generated at provisioning (expires, single-use).
2. The person sets a strong password (policy from Phase 4 defaults), verifies email, and optionally enables MFA.
3. The account is assigned the immutable highest in-school role ("Super Admin (in-school)").
4. The creation is written to the audit log.
5. Immediately revoke the bootstrap token; record who received it.

**6.6 Security defaults confirmed at first login**
1. Login lockout after **5 failed attempts** (temporary lock, configurable cooldown) with a generic error that never reveals which field was wrong.
2. Access tokens short-lived; refresh tokens rotate on use; reuse triggers token-family revocation.
3. Password reset links are single-use and time-limited; a successful reset invalidates all sessions.
4. Admin can view and revoke sessions.

**6.7 Create a second administrator (break-glass)**
1. Create a second admin account (Principal or IT) so the school is not dependent on one person.
2. Store break-glass procedure in the handover pack.

### Outputs
Active licence · first and second administrators · audit record of bootstrap · handover note.

### Exit gate G3 ✅
- [ ] Licence valid; modules/limits match scope
- [ ] Tamper test passed (staging)
- [ ] First admin created via one-time token; token revoked
- [ ] Two administrators exist
- [ ] Lockout, session and reset flows verified

### Pitfalls
Leaving a default password · admin using a shared mailbox · forgetting the second admin · offline `.lic` lost with no copy.

---

## 7. Phase 4 — School profile and global settings

**Objective:** Establish the school's identity and the platform-wide rules that every module reads from **Settings** (no module hard-codes a school value).
**Owner:** School Admin · **Support:** Principal, Implementation Lead
**Inputs:** G3, questionnaires.
**Effort:** 1–2 days

### Steps

**7.1 School profile**
1. Legal and display name, address, phone, email, website, registration numbers.
2. Upload logo and school seal; upload **principal signature image** (used on certificates/report cards).
3. Set default header/footer text for documents.

**7.2 Locale and language**
1. Set the **default language** (English by default) and enable Tamil / Sinhala / Arabic as required.
2. Set date, time and number formats; first day of week; weekend days.
3. Confirm RTL rendering for Arabic on a sample screen.
4. Confirm generated-document fonts cover all enabled scripts (Tamil, Sinhala, Arabic).
5. Per-user language preference is stored on the user profile; new users inherit the school default.

**7.3 Time, currency and rounding**
1. Time zone (data stored UTC; displayed in school time zone).
2. **Currency** and minor-unit scale; **rounding mode** — money is stored as integer minor units, never float.
3. Tax display settings ⚠ Provisional (`PC-003`): tax on/off, tax name, inclusive/exclusive, registration number.

**7.4 Security policy settings** 🔒 🧾
1. Password policy (length, complexity, history, expiry if any).
2. Lockout threshold (default 5) and cooldown; OTP expiry (default 5 min); reset-link expiry (default 1 h).
3. Session duration and idle timeout; concurrent-session policy.
4. MFA policy (optional/required by role).
5. Social login providers to allow (Google, Microsoft, Apple, Facebook) — only after OAuth credentials exist for this environment. SSO/SAML is Enterprise.

**7.5 Notification settings**
1. Default channel per event type (email default; SMS/WhatsApp opt-in because they are billed per message).
2. Per-recipient rate limits and **digesting** rules for non-urgent notices; emergency alerts always bypass digesting.
3. Quiet hours; sender names; reply-to addresses.
4. Message templates by language (pre-approved WhatsApp templates where required).

**7.6 Retention and privacy settings**
1. Retention periods per module; audit retention (≥ 7 years for finance actions).
2. Consent capture options (photos, biometrics, alumni directory).
3. Data-export/erasure request procedure and owner.

**7.7 Storage settings**
1. Allowed file types and max sizes per scope (student documents, homework, ID photos, receipts).
2. Optional malware scan on user uploads.

**7.8 Branding and theme**
1. Confirm light/dark themes render correctly with the school logo.
2. Set accent/brand colour within allowed tokens.

### Outputs
Populated Settings · configured security policy · templates · branding.

### Exit gate (part of G4) ✅
- [ ] Locale, currency, timezone, rounding set
- [ ] Security policy documented and applied
- [ ] Notification defaults and rate limits set
- [ ] Sample screens verified in all enabled languages and both themes

### Pitfalls
Changing currency/rounding after transactions exist · enabling SMS/WhatsApp defaults for everything (cost blow-out) · no Tamil/Sinhala/Arabic font in PDFs.

---

## 8. Phase 5 — Module enablement

**Objective:** Turn on exactly the licensed modules the school will use; keep the interface simple.
**Owner:** School Admin · **Support:** Implementation Lead
**Effort:** 0.5 day

### Steps
1. Open the **Module Registry**; it shows the resolved list = licence entitlement ∩ admin toggle.
2. Enable core modules: Users & RBAC, Academic, Student/Parent/Staff management, Attendance, Timetable, Exams, Fees & GL.
3. Enable licensed optional modules only when the school is ready to configure them: Workforce/Leave, Learning (Homework, Online Classes), Documents (ID cards, certificates), Library, Transport, Hostel, Facilities & Hall, BookShop & Canteen, Sports & Events, Clubs/Prefects, Alumni, Helpdesk, AI services, Analytics.
4. Disabled modules disappear from navigation **and** are blocked at API level (entitlement + toggle).
5. Confirm the "simplest view" principle: unused menus and fields stay hidden; advanced options are not deleted.
6. Record the enabled-module list in the handover pack.

### Exit
Module list matches scope; navigation shows only enabled modules.

### Pitfalls
Enabling everything "just in case" · disabling a module that other modules depend on (e.g. Finance for Transport fees).

---

## 9. Phase 6 — Roles, permissions and users

**Objective:** Establish who can do what, then create users safely.
**Owner:** School Admin · **Support:** Principal, HR Officer
**Inputs:** Staff list, organisation chart.
**Effort:** 2–3 days

### Steps

**9.1 Review system roles**
1. Inspect immutable system roles (in-school Super Admin, School Admin). They cannot be deleted or stripped of core permissions (enforced server-side).
2. Default operational roles: Teacher, Student, Parent/Guardian, Staff. Optional: Librarian, Transport Admin, Hostel Warden, Facility Manager, Finance Officer, HR Officer, Outlet Operator/Vendor, Alumni.

**9.2 Design custom roles** (edition-dependent)
1. List job functions and the actions each needs (e.g. Finance Officer: invoice, receipt, reverse with reason; Registrar: admissions, certificates).
2. Create roles from the permission catalogue via the checkbox matrix.
3. Apply **least privilege**; sensitive permissions (fee reversal, grade change, attendance override, journal entry, certificate issuance) go only to named roles and always require a **reason** 🧾.

**9.3 Define ownership policies**
1. Teacher → only assigned classes/sections.
2. Homeroom teacher → homeroom students.
3. Parent → only linked children.
4. Student → own records.
5. Vendor/Outlet operator → own outlet only, minimum student data (token + allergy flag).
6. Department head → own department's leave approvals.

**9.4 Review the permission matrix**
1. Walk through Role × Module × Action with the Principal.
2. Run the negative tests: call restricted actions directly (API) with an under-privileged account — expect 403 with distinguishable role/ownership denial in logs.
3. Record the approved matrix as the baseline for future changes (living document).

**9.5 Create staff users**
1. Import or create staff; assign role(s); require **email verification** and forced first-login password set.
2. Never share accounts. One person = one account.
3. Invite in batches; track acceptance.

**9.6 Parent, student and other accounts** (timing note)
1. Create student and guardian accounts **after** Phase 8 data is loaded and verified.
2. Guardians link to children; multi-child households supported; OTP-based login for parents/students is available 📱 M2.
3. Decide account policy for very young students (parent-managed vs own login).

**9.7 Set approval chains** (used by leave, hire, certificates, gate passes, wallet refunds, ticket escalation)
1. Define chains: e.g. Department Head → Vice Principal → HR.
2. Set SLA timers and auto-escalation; define delegate approvers (with cycle prevention).
3. All approvals write audit records.

### Outputs
Approved role/permission matrix · staff accounts · approval chains.

### Exit gate (part of G4) ✅
- [ ] Permission matrix approved and negative-tested
- [ ] All staff have exactly one account with the right role
- [ ] Approval chains defined
- [ ] No shared/generic accounts

### Pitfalls
Over-broad "Admin" for convenience · forgetting ownership policies · creating parent accounts before students are verified.

---

## 10. Phase 7 — Academic structure

**Objective:** Model the school's academic world **through configuration only** (no hard-coded grades or terms).
**Owner:** Academic Coordinator · **Support:** School Admin
**Inputs:** Academic questionnaire.
**Effort:** 3–5 days

### Steps

**10.1 Academic year**
1. Create the academic year (name, start, end) and mark it **active**.
2. Note: year boundaries also anchor leave-year cycles and attendance windows (shared period engine).

**10.2 Academic period model**
1. Choose **Annual / Semester / Trimester / Quarter / Custom**.
2. Create periods with exact start/end dates; set which period is current.
3. Configure exam windows and report-card dates per period.

**10.3 Education stages and grades**
1. Create stages (e.g. Early Childhood, Primary, Lower Secondary, Upper Secondary).
2. Create grades/years (KG1 … Grade 13 / Year 1 … Year 13) and attach to stages; set order (drives promotion sequence).
3. Set the terminal grade (graduation → alumni conversion later).

**10.4 Sections, groups and houses**
1. Create sections per grade (A, B, C, …), with capacity.
2. Create groups/streams where needed (Science, Commerce).
3. Create sports **houses** (e.g. Red, Blue, Green) if used.

**10.5 Subjects**
1. Create the subject catalogue (name, code, type: core/elective, language).
2. Assign subjects to grades and sections; mark electives and elective groups.
3. Set periods per week per subject (feeds timetable).

**10.6 Curricula and tracks**
1. Create curricula (National, Cambridge, IGCSE, IB, custom): authority, versions.
2. Attach each subject to a curriculum track; define **assessment rules** (continuous assessment % / exam %).
3. Handle **dual tracks** in one grade (e.g. Grade 10 National vs Cambridge) as separate tracks with their own syllabus and grading.

**10.7 Grading schemes** ⚠ Provisional (`PC-002`)
1. Define grade scales per curriculum (A*–F, 1–7, percentage bands, descriptive, pass/fail).
2. Define pass marks, GPA weighting, rounding and moderation rules.
3. **Do not finalise** until the Grading & Moderation design (`PC-002`) is approved; configure a provisional scheme for UAT only.

**10.8 Rooms, labs and facilities registry**
1. Create rooms (classrooms, labs, library, hall) with capacity and type.
2. Register bookable facilities: IT lab, swimming pool, football ground, courts, **School Hall** (used by Timetable and Facility Booking).

**10.9 Period structure and bell schedule**
1. Define the daily period structure (start/end times, breaks, assembly, lunch).
2. Set variations by weekday, term, holiday; special-day routines.
3. If a bell controller is used, plan the adapter hook-up (Phase 14).

**10.10 Holiday and working-day calendar**
1. Load public holidays and school closures; per-department overrides.
2. This single calendar feeds Attendance, Leave, Timetable and Bell.

**10.11 Timetable**
1. Assign teachers to subject/section (needs staff from Phase 8 — so do the structural setup now, and finalise the timetable after staff onboarding).
2. Set constraints: teacher availability, double periods, room/lab needs, workload balance.
3. Build the timetable (manual, or 🤖 AI-assisted draft) and run **conflict detection** (teacher, room, section).
4. 🤖 **AI drafts require human review and approval before publishing.**
5. Publish; timetable becomes visible to teachers, students and parents.

**10.12 Promotion rules**
1. Choose rule type per grade: Automatic / Criteria-based / Manual review.
2. Set criteria: minimum grade, minimum attendance %, disciplinary/fee holds (whether fee dues block promotion).
3. Define the review committee and override permission (reason mandatory, audited).

### Outputs
Configured academic year, periods, stages, grades, sections, subjects, curricula, rooms, bell schedule, calendar, draft timetable.

### Exit gate G5 (part 1) ✅
- [ ] Every grade has sections; every section has subjects
- [ ] Every subject mapped to a curriculum track
- [ ] Calendar and periods validated against the school's official calendar
- [ ] Timetable free of conflicts (after staff assignment)
- [ ] Grading scheme flagged provisional if `PC-002` open

### Pitfalls
Wrong period model chosen (hard to change later) · missing elective groups · timetable built before staff data · promotion order not matching grade order.

---

## 11. Phase 8 — Staff and student onboarding

**Objective:** Bring people into the system accurately and completely.
**Owner:** School Admin · **Support:** HR Officer, Data Champion, Registrar
**Effort:** 1–3 weeks (data-quality driven)

### Steps

**11.1 Departments and designations**
1. Create departments (Mathematics, Science, Admin, Transport, Facilities, …) and designations.
2. Assign heads of department (they become approvers).

**11.2 Staff profiles** (teachers and non-teaching)
1. Import via template (Appendix E): personal details, employee number, joining date, contract type, department, designation, qualifications, contact.
2. Record emergency contacts; upload documents (contracts, IDs, certificates) into the HR document vault; set **expiry reminders** (work permits, licences).
3. Assign employee IDs and attendance identifiers (QR/biometric enrolment later).
4. Teacher-subject-class assignments (feeds timetable and ownership policies).
5. Class teacher / homeroom assignments.
6. Verify counts against `maximum_staff`.

**11.3 Admission configuration** ⚠ Provisional (`PC-004`)
1. Define admission workflow: online application → review → entrance/placement → approval → enrolment.
2. Set required documents, fees, seat limits per grade, waiting-list rules.
3. Until `PC-004` is designed, load existing students via import and use a minimal manual registration path.

**11.4 Student records**
1. Import via template: legal name, DOB, gender, admission number, admission date, previous school, grade, section, curriculum track, nationality, medical/allergy flags, transport/hostel needs.
2. **Allergy and dietary flags** captured with parent confirmation (used by Canteen at POS later).
3. Validate uniqueness (admission number) **within the school database**.
4. Verify counts against `maximum_students`.
5. Upload student documents (birth certificate, ID, transfer certificate, immunisation) — access follows RBAC and ownership.

**11.5 Guardians and family links**
1. Import guardians; link to students; mark primary contact, financial responsible person, pickup authorisation.
2. Sibling links (for discounts, multi-child views).
3. Verify at least one reachable contact per student (email/phone) — required for absence alerts.
4. Record notification preferences and consent.

**11.6 Class allocation**
1. Allocate students to grade/section/track for the active year.
2. Balance section sizes; handle elective choices.
3. Generate class lists for verification by class teachers.

**11.7 Student ID and staff ID cards** (Phase 13 templates first)
1. Assign QR/barcode/RFID identifier per person — the same credential later serves Attendance, Library, Canteen/BookShop POS and Asset custody.
2. Batch-generate and print; log issuance 🧾.
3. Deactivation on exit revokes the credential across all modules at once.

**11.8 Account creation for students/guardians**
1. Create accounts in batches; send invitations; monitor acceptance.
2. Provide a **support path** for locked-out or non-digital families.

**11.9 Verification**
1. Data Champion verifies random samples plus 100% of critical fields (name, DOB, grade, guardian contact).
2. Class teachers verify class lists.
3. Fix and re-import; keep an issues log.

### Outputs
Verified staff, student, guardian data; class allocations; ID credentials.

### Exit gate G5 (part 2) ✅
- [ ] Counts reconcile with school records and licence limits
- [ ] 100% of students have grade/section and a reachable guardian
- [ ] Teacher assignments complete
- [ ] Sample verification signed by Data Champion

### Pitfalls
Duplicate students · guardian phone numbers missing · allergy data not captured · assigning accounts before verification.

---

## 12. Phase 9 — Attendance and workforce configuration ⚠

> ⚠ **Provisional** — attendance, leave and workforce are being designed fresh (`PC-000`, `PC-001`). Configure to the current plan for UAT; finalise after design approval.

**Owner:** School Admin + HR Officer · **Support:** Academic Coordinator, IT
**Effort:** 2–4 days

### Steps

**12.1 Student attendance policy**
1. Mode: per period, daily, or both; who marks; cut-off times.
2. States: Present, Absent, Late, Excused, Half-day, On-leave.
3. Absentee rule: notify guardian if not present by a configured time (e.g. 09:15), with delay/digest settings.
4. **Regularisation workflow:** retroactive corrections require a reason and are audited 🧾.
5. Minimum attendance % for exam eligibility per curriculum.

**12.2 Capture sources**
1. Enable Manual and QR first; add Biometric/RFID after hardware verification (Phase 14).
2. Video-session presence (online classes) is a capture source that the teacher confirms before finalisation.
3. Transport boarding and hostel check-ins are additional *contexts* of the same attendance engine.

**12.3 Teacher and staff attendance**
1. Check-in/out method: biometric, RFID, QR, geo-fenced mobile 📱 M2.
2. Late/early thresholds; shifts (morning/evening/split); overtime rules.
3. Discrepancy detection: teacher checked in but absent from a scheduled period → coordinator review queue.

**12.4 Leave management**
1. Leave types (annual/casual, sick, maternity/paternity, unpaid, emergency, professional development, comp-off) with eligibility by role/contract/tenure and country labour law template.
2. Accrual rules (fixed grant, monthly pro-rata, tenure tiers), carry-forward, expiry, encashment.
3. Document requirements (e.g. medical certificate above N days).
4. Approval chains and SLA escalation (from Phase 6).
5. **Substitution**: qualifications, workload balance rules; 🤖 proposals require Coordinator approval.
6. Load opening leave balances (migration input).
7. Nightly reconciliation between leave and attendance to prevent double-counting.

**12.5 Shift and duty rosters** (non-teaching staff)
1. Create shift templates and rotations; check conflicts with approved leave and holidays.

**12.6 Verify**
1. Mark a test day for two classes; confirm absence alert reaches a test guardian.
2. Submit a test leave request through the full approval chain.

### Exit
Policies configured and tested end-to-end (or flagged provisional).

### Pitfalls
Too-short absence alert delay causing false alarms · leave balances not loaded · weekends/holidays not aligned with the calendar.

---

## 13. Phase 10 — Finance and General Ledger setup ⚠

> ⚠ **Provisional** for tax and currency handling (`PC-003`). Money is integer minor units; every posting goes through `ILedgerPostingRule` and must balance.

**Owner:** Finance Officer · **Support:** Principal, Implementation Lead
**Effort:** 4–7 days

### Steps

**13.1 Chart of Accounts (CoA)**
1. Start from the default school CoA template (Assets, Liabilities, Equity, Income, Expense).
2. Adapt account codes/names to the school's accounting conventions; keep system-mapped accounts (e.g. Tuition Fee Income, Bank, Cash, Deposits Held, Facility Hire Income, Concession Income, Wallet Liability, Salaries).
3. Lock the account structure before posting begins.

**13.2 Posting rules**
1. Map each transaction type to debit/credit accounts: fee invoice, fee payment, scholarship/discount, fine, refund, expense, payroll, facility/hall hire income and deposits, outlet settlements (school-run: gross sales + COGS; third-party: rent/commission only), wallet top-up/spend, subsidies.
2. Confirm every rule produces a **balanced** entry (unit-tested invariant).
3. New income streams later = new posting rule, not code changes to the core engine.

**13.3 Tax and currency** ⚠
1. Configure tax names, rates, applicability per fee/sales category; inclusive vs exclusive.
2. E-invoicing mandates: confirm whether required; do not assume.
3. Multi-currency: only if required; define the base currency and rounding.

**13.4 Payment methods**
1. Cash, bank transfer, cheque, card/online.
2. Configure the **payment gateway adapter** (provider chosen by the school; credentials in secrets manager); test in sandbox.
3. Receipt numbering formats and reset rules.

**13.5 Fee categories and structures**
1. Categories: tuition, admission, registration, exam, transport, hostel, activity, uniform/books (if not via BookShop), library fines, etc.
2. Structures per grade/track/programme with amounts, frequency (monthly/term/annual) and due dates.
3. Installment plans; grace periods; **late-fee rules**.
4. Discounts and scholarships: sibling, staff-child, merit, need-based; stacking rules and caps.
5. Fine and waiver rules with approval (audited).

**13.6 Fee assignment**
1. Assign structures to students (by grade/track, plus individual exceptions).
2. Link transport and hostel fees to route/room allocation (Phase 12).
3. Preview a sample of invoices for accuracy before bulk generation.

**13.7 Opening balances**
1. Decide the **cut-over date** for finance.
2. Load opening balances: bank/cash, receivables per student (outstanding fees), payables, fixed assets, equity.
3. Post as a **single audited opening journal** that balances; reconcile to the school's trial balance.

**13.8 Period settings**
1. Financial year and periods; **soft close** (warn on backdated postings).
2. Define who may post manual journals (reason mandatory, audited).

**13.9 Payroll (if licensed)**
1. Salary structures, allowances, deductions, pay cycle.
2. Link attendance/leave deductions and overtime ⚠ (depends on Phase 9 design).
3. Payslip templates; publishing rules.

**13.10 Reports baseline**
1. Trial Balance, General Ledger by account, Income & Expenditure, basic Balance Sheet.
2. Run and check against the opening figures.

**13.11 Finance dry run**
1. Create an invoice → record payment → issue receipt → check GL entry and trial balance.
2. Reverse a payment with reason → confirm audit record and ledger effects.

### Exit gate (part of G6) ✅
- [ ] CoA approved and locked
- [ ] Posting rules produce balanced entries for all transaction types
- [ ] Sample invoices/receipts verified by Finance
- [ ] Opening balances reconcile
- [ ] Payment gateway sandbox test passed

### Pitfalls
Changing rounding/currency later · unapproved discount stacking · opening balances not reconciled · gateway credentials mixed between environments.

---

## 14. Phase 11 — Learning and communication

**Owner:** Academic Coordinator + School Admin · **Support:** IT
**Effort:** 2–3 days

### Steps

**14.1 Homework and assignments**
1. Defaults: submission types (text/file/photo), due-time rules, late-submission grace and penalty curve, resubmission policy.
2. Reminder timings (e.g. 24 h and 2 h before deadline).
3. File limits (size/type) and storage scope.
4. Rubric templates; link to continuous assessment if used.

**14.2 Online classroom**
1. Choose provider via the video adapter: **Zoom, Google Meet, or self-hosted Jitsi** (can mix).
2. Configure credentials/instance URL; verify concurrency limits against licence.
3. Virtual periods appear in the normal timetable.
4. Set recording policy, retention (e.g. delete after N days) and access (teacher + enrolled students/parents only).
5. Decide attendance bridging: join/leave events feed attendance **after teacher confirmation**.
6. Low-bandwidth fallback: recordings + slides + homework links.

**14.3 Lesson plans and content library**
1. Templates and sharing rules within departments.
2. 🤖 AI lesson-plan/quiz drafts (Deluxe+) require teacher edit/approval before use.

**14.4 Communication**
1. Announcement categories and audiences (staff, students, parents, public, alumni).
2. Templates in each enabled language; emergency broadcast template and test procedure.
3. Channel setup: email sender (SPF/DKIM verified), SMS adapter (vendor when chosen), WhatsApp adapter (approved templates), push 📱 M2.
4. Opt-in/opt-out preferences; failed-message retry rules.
5. Parent–teacher communication rules (working hours, response expectations).

**14.5 Digital noticeboard** (Standard+)
1. Register display devices (TVs, LED matrix, kiosks); audience targeting; scheduling and expiry.

**14.6 AI chatbot** (Deluxe+)
1. Upload approved policy/FAQ documents to the knowledge base (fee rules, uniform, calendar).
2. Confirm scoping: it answers only within the asking user's permissions and **never writes without explicit confirmation**.
3. Set the fallback: unanswered questions create a Helpdesk ticket.

### Exit
Test homework, test online class, test emergency broadcast, test chatbot scoping all pass.

### Pitfalls
Unverified email domain · WhatsApp templates not pre-approved · recordings stored forever.

---

## 15. Phase 12 — Operations modules

**Owner:** School Admin + module owners · **Effort:** 1–2 weeks (parallel tracks)

### 15.1 Library
1. Catalogue import (ISBN/classification), copies, barcode labels.
2. Membership rules and borrowing limits by role/grade.
3. Fines and lost/damaged charge workflow (posts via Finance).
4. Use the student/staff ID credential as the library card.

### 15.2 Transport
1. Vehicles (capacity, insurance/fitness expiry), drivers (licence/document expiry via HR vault).
2. Routes and stops; student allocation with capacity checks.
3. Transport fee plans (prorated for mid-term changes) linked to Finance.
4. GPS trackers and map provider (Deluxe+); geofenced alerts; boarding/alighting taps feed attendance.
5. Driver SOS procedure and emergency contact chain. 📱 M2 for driver/parent apps.
6. 🤖 Route optimisation (optional) is a proposal only; human approves.

### 15.3 Hostel (optional add-on)
1. Buildings → rooms → beds; allocation and room-change approval.
2. Evening roll-call/curfew attendance; warden alerts.
3. Hostel fees and gate-pass/visitor workflow.

### 15.4 Asset and inventory
1. Asset register (tag ID, purchase date, value, warranty), tagging (QR/barcode/RFID).
2. Custody allocation and transfer workflow; maintenance schedule; depreciation method.
3. Consumables with reorder levels; suppliers; purchase orders — **auto-generated POs are drafts** requiring human approval 🤖.
4. Uses the **shared stock engine** — the same engine as BookShop and Canteen.

### 15.5 Facilities and School Hall
1. Facility registry: capacity/layouts, hours, maintenance closures, required supervision (lifeguard, lab technician), equipment lists.
2. **Internal booking** rules; conflict detection against timetable and maintenance.
3. **External hire:** enable per facility; rate cards (peak/off-peak), add-ons, buffers, overtime.
4. **School Hall rental pack:** enquiry → tentative hold (auto-expiry) → quote → deposit → confirmation → pre/post-event inspection → settlement.
5. Priority rules: internal events may pre-empt only *tentative* holds; confirmed bookings need audited Admin override with reason.
6. Hire agreement, waiver and insurance-certificate templates (with expiry).
7. GL: hire income and *Deposits Held* liability posting rules confirmed (Phase 10).
8. Public enquiry form (external hirers are lightweight contacts, not user accounts).

### 15.6 BookShop and Canteen ⚠ Provisional (`PC-005`)
For **each outlet**:
1. Register the outlet; choose **operator model: SCHOOL_RUN or THIRD_PARTY** (effective-dated; can change later with a closing settlement).
2. **If THIRD_PARTY:** record the concession contract (term, rent/commission %, minimum guarantee, deposit, price-cap/menu-approval rules); upload compliance documents (business registration, food-hygiene licence, staff health certificates, insurance) with expiry alerts; create the restricted **Vendor** role scoped to this outlet; configure settlement cycle and statement format.
3. **If SCHOOL_RUN:** stock items, suppliers, purchase approval, costing, wastage logging; gross-sales + COGS posting.
4. Outlet POS: devices, receipt template, offline-tolerance test, ID-card QR scan.
5. **Canteen:** categories, menu items, prices, availability by meal period, **allergen/dietary tags**, daily menu publishing, pre-order and pickup slots, meal plans, staff pricing, subsidised meals (posts as school expense), hygiene/temperature checklists (audited).
6. **BookShop:** catalogue (textbooks, stationery, exam materials, uniforms), ISBN/SKU, **grade-wise and curriculum-track book sets**, pre-order for next year (after promotion), pay-now or charge-to-fee-account, returns/exchange, reorder alerts.
7. Vendor data minimisation verified: vendors see only a student token and required flags.
8. Dry run: sale → settlement statement → GL entries for both models.

### 15.7 Student Wallet (optional add-on) ⚠ (`PC-006`)
1. Obtain legal confirmation for the jurisdiction **before** enabling.
2. Configure top-up via payment adapter, parental daily limits, blocked categories/items, low-balance alerts.
3. Wallet balances are a GL liability; refunds on exit require approval and are audited.

### 15.8 Sports, events, clubs, prefects, alumni
1. Event calendar categories; sports meet templates (events, heats, houses, scoring).
2. Clubs registry, capacity, supervising teachers, session attendance.
3. **Prefect system:** role catalogue (Head Boy/Girl, prefects, house captains, council), nomination/approval workflow, term of office, duty rosters; merit/conduct points **off by default**.
4. **Alumni:** consent-based conversion at graduation; directory privacy settings; mentorship is **school-mediated only**; giving/fundraising is Enterprise.

### 15.9 Helpdesk
1. Categories and routing table (Academic, Finance, IT, Transport, Facilities, Disciplinary).
2. SLA and escalation rules; internal vs public replies; satisfaction rating.

### Exit gate G6 (part) ✅
Each enabled operational module passes a scripted dry run (see Appendix F).

### Pitfalls
Building separate stock or booking logic per module (must reuse the shared engines) · vendor given too much data · hall bookings not tied to the timetable.

---

## 16. Phase 13 — Documents and templates

**Owner:** School Admin + Academic Coordinator · **Support:** Implementation Lead
**Effort:** 2–4 days

### Steps
1. **Font check first:** confirm Tamil, Sinhala and Arabic render correctly in generated PDFs.
2. **ID cards (students and staff):** design template (photo, name, ID, class/department, QR/barcode, validity, emergency strip, optional prefect insignia); CR80 size; batch print layout; validity and revalidation rules.
3. **Certificates:** Transfer Certificate, Bonafide, Character, Completion, custom; merge fields; jurisdiction wording; **approval workflow** (TC requires clearance: fees, library, assets).
4. **Report cards:** paper size **A4 or A5**, layout variant per curriculum track (grade table, narrative, rubric, hybrid); include attendance %, co-curricular, remarks (🤖 AI comment drafts require teacher approval), promotion status.
5. **Receipts, invoices, hire agreements, settlement statements** templates.
6. Templates are **versioned**; issued documents keep their template version (reprints stay identical).
7. Print a physical proof of every template on real printers/card printers.
8. Approval of templates by Principal.

### Exit
Proof prints approved in all enabled languages.

### Pitfalls
Missing script fonts · A5 layout overflow with long subject lists · signatures/seals in low resolution.

---

## 17. Phase 14 — Integrations and hardware

**Owner:** IT contact + Support Engineer · **Effort:** 2–5 days (site visit)

### Steps
1. **Site survey:** network, power, mounting positions, Wi-Fi coverage.
2. **Biometric/RFID terminals:** install, register in the device registry, verify against `maximum_biometric_terminals`; configure the `IAttendanceCaptureAdapter`; enrol staff/students (consent captured; templates stored as irreversible hashes, never logged); test enrolment, duplicate/conflict handling and offline queue.
3. **Attendance kiosk tablets:** lock to kiosk mode, MDM/remote-wipe, offline queue test (target ≥ 72 h disconnected) 📱 M2.
4. **School bell:** connect controller via `IBellHardwareAdapter`; sync schedule; test manual trigger, emergency override, and status heartbeat.
5. **Displays/LED boards:** register devices, test content, schedule and remote monitoring.
6. **ID-card printer:** test batch printing and card-alignment.
7. **Payment gateway:** sandbox → production switch checklist.
8. **WhatsApp/SMS/email:** production sender verification; send test messages to a small group; confirm rate limits and digesting.
9. **OAuth social login** (Google, Microsoft, Apple, Facebook): create client credentials per environment; register redirect URIs; test each provider in staging.
10. **SSO/SAML** (Enterprise): configure IdP, attribute mapping to roles, test with a pilot group.
11. **GPS trackers** (Deluxe+): register devices, test live location, geofences.
12. Record every device (serial, location, owner, firmware) in the **device registry**.

### Exit
Every integration has a passing test record; failures have owners and dates.

### Pitfalls
Firewall blocking device traffic · unsynced clocks on terminals · using production credentials in staging.

---

## 18. Phase 15 — Data migration and import

**Objective:** Move legacy data in **safely, repeatably, and verifiably**.
**Owner:** Support Engineer · **Support:** Data Champion, Finance Officer
**Effort:** 1–2 weeks (overlaps Phases 8, 10, 12)

### Steps

**18.1 Migration plan**
1. Inventory sources (Excel/CSV/old DB), owners and freshness dates.
2. Define scope: what is migrated (current students, staff, open balances, current-year data) vs archived (history beyond the retention window).
3. Choose **cut-over date** and freeze rules for the old system.

**18.2 Field mapping and transformation**
1. Map every source column to an EduFlow field; define transformations (name splitting, date formats, currency to minor units, code lookups).
2. Define validation rules (required fields, uniqueness within the school, allowed values, money precision, date logic).
3. Decide duplicate policy (merge, skip, flag for review).

**18.3 Dry runs (repeat until clean)**
1. Import into **staging** with a validation report (rows accepted, rejected, warnings with reasons).
2. Data Champion fixes source data; re-run.
3. Reconciliation: counts (students by grade, staff by department), sums (opening balances, outstanding fees), sample record checks.
4. Confirm no orphan records (students without sections, fee assignments without structures).

**18.4 Load order (dependency-first)**
1. Settings → roles → academic structure → staff → students → guardians → class allocation → fee structures → fee assignments → opening balances → library/assets/inventory → transport/hostel allocations → leave balances.

**18.5 Production load**
1. Take a **backup before** the load.
2. Run the import with the same scripts validated in staging; log everything (idempotent scripts).
3. Post-load reconciliation report signed by Data Champion and Finance Officer.
4. Rollback plan: restore the pre-load backup if reconciliation fails.

**18.6 Historical data**
1. Decide what history matters: previous-year grades, attendance summaries, fee ledgers. Load as **read-only history**, preserving the rule that student history is never overwritten.
2. Attendance, leave and grading history are **not ported from the legacy app** (designed fresh) — import as data only if the new design provides fields for it ⚠.

### Exit gate G7 (part) ✅
- [ ] Reconciliation signed (counts and sums)
- [ ] No rejected critical rows outstanding
- [ ] Pre-load backup exists; rollback tested in staging

### Pitfalls
Loading out of order · fixing data directly in the database instead of source · no backup before load · treating rejected rows as "later".

---

## 19. Phase 16 — Security, audit and backup verification

**Owner:** DevOps + Implementation Lead · **Support:** School Admin
**Effort:** 2–3 days

### Steps
1. **Authorization test suite:** run the permission-matrix tests (role × module × action); include direct API calls without UI.
2. **Ownership tests:** a parent cannot see another family's child; a teacher cannot edit another class's grades; a vendor cannot see beyond its outlet; the chatbot respects the same limits.
3. **Entitlement tests:** a disabled/unlicensed feature is blocked at the API even with a valid role.
4. **Audit tests:** perform sample sensitive actions (grade change, fee reversal, attendance regularisation, leave approval, certificate issuance, hall override, manual journal) and confirm complete records (actor, role, IP/device, before/after, reason). Confirm the audit table rejects UPDATE/DELETE at DB level.
5. **Logging tests:** trigger an error; confirm it appears in the rotating file **and** DB error log with correlation ID and no sensitive data.
6. **Authentication tests:** lockout after 5 failures, generic error message, session revocation, token rotation and reuse detection, password reset invalidating sessions.
7. **Security scan:** dependency/container scan; OWASP baseline scan; fix criticals before go-live.
8. **Backup drill:** restore production-like backup into staging; verify data integrity; document time taken (RTO).
9. **Licence drill:** simulate expiry approach and grace period behaviour (staging).
10. **Privacy review:** consent records, biometric handling, alumni data plan, vendor data minimisation.

### Exit gate (part of G7) ✅
No open critical/high findings; drills documented.

---

## 20. Phase 17 — Testing and User Acceptance (UAT)

**Objective:** Prove the system works for the school's real scenarios before people depend on it.
**Owner:** Implementation Lead · **Support:** Trainer/QA, all school role owners
**Effort:** 1–2 weeks

### 20.1 Test layers
| Layer | Who | What |
|---|---|---|
| Vendor regression | QA | Automated unit/integration/E2E suites green on the deployed build |
| Configuration verification | Impl. team | Every setting from Phases 4–14 matches the approved sheet |
| UAT | School users | Scripted real-world scenarios on staging with migrated data |
| Non-functional | DevOps/QA | Performance (attendance capture < 500 ms), offline queue, RTL, dark/light, mobile responsive |

### 20.2 Core UAT scenarios (adapt in Appendix F)
1. **Admission → enrolment:** register student, allocate class, create guardian account, issue ID card.
2. **Daily attendance:** teacher marks a class; absence alert reaches guardian; regularise a correction with reason.
3. **Staff day:** staff check-in/out, late flag, leave request → multi-level approval → balance update → substitute proposal approved.
4. **Timetable change:** move a period; conflict detection blocks a clash.
5. **Homework:** teacher creates, student submits, teacher grades, parent sees result.
6. **Online class:** schedule, join, attendance confirmation, recording access rules.
7. **Exams and report card:** create exam, enter marks, compute grades ⚠, generate A4/A5 report cards in each language.
8. **Fee cycle:** invoice → partial payment → receipt → late fee → discount → reversal with reason; check GL and trial balance.
9. **Transport:** allocate student to route; boarding tap; guardian notification; fee posting.
10. **Library:** issue, renew, overdue fine → invoice.
11. **Hall rental:** external enquiry → hold → quote → deposit → confirmation → inspection → settlement (deposit refund/damage deduction) → GL.
12. **Canteen and BookShop:** sale with allergy flag and logged override; pre-order and pickup; settlement statement (school-run vs third-party); book set purchase charged to fee account.
13. **Certificates:** Bonafide request → approval → issue; TC blocked while dues outstanding.
14. **Helpdesk:** raise ticket → routing → SLA escalation → resolution.
15. **Security:** account lockout after 5 attempts; role-restricted access; vendor scoping.
16. **Language/RTL:** run key flows in Arabic (RTL), Tamil and Sinhala.
17. **Year-end rehearsal:** run promotion on a copy (Phase 21 preview).

### 20.3 Defect handling
1. Severity: Critical (blocks go-live) / Major / Minor / Cosmetic.
2. Triage daily; owners and fix dates; retest evidence.
3. **Go-live criteria:** zero Critical, zero Major without an approved workaround, agreed list of Minor items for hypercare.

### 20.4 Sign-off
Each role owner signs their scenarios; Principal signs overall.

### Exit gate G8 ✅
- [ ] All scenarios passed or waived with approval
- [ ] Defect criteria met
- [ ] Sign-off record stored

### Pitfalls
UAT with fake data only · users testing without time allocated · unresolved "small" defects in fee/GL flows.

---

## 21. Phase 18 — Training

**Owner:** Trainer · **Support:** School Admin
**Effort:** 1–2 weeks (before go-live)

### Steps
1. **Training needs analysis** by role.
2. **Curriculum by role:**
   - School Admin: setup, roles, settings, audit log, backups, licence, troubleshooting.
   - Principal/Management: dashboards, approvals, analytics.
   - Academic Coordinator: timetable, exams, promotions, substitutions.
   - Teachers: attendance, homework, grades, leave requests, lesson plans, mobile companion 📱 M2.
   - Finance: fees, receipts, reversals, GL, reports, reconciliation.
   - HR: staff, leave, rosters, documents.
   - Registrar: admissions, certificates, ID cards.
   - Librarian, Transport, Warden, Facility Manager, Outlet operators, Helpdesk agents.
   - Parents/Students: portal/app orientation, how to pay, how to raise a ticket.
3. **Materials:** quick-start cards per role in enabled languages; short videos; FAQ.
4. **Hands-on sessions** on staging with realistic data; practical exercises, not slide decks.
5. **Train-the-trainer:** identify **super-users** (one per department) for peer support.
6. **Parent/student communication plan:** announcement, how-to guide, support channel, open-house/help desk day.
7. **Competency check:** short practical test for critical roles (Finance, Admin, Registrar).
8. **Support model:** who to call, hours, ticket process, escalation path.

### Exit gate G9 (part) ✅
- [ ] Attendance sheets for all sessions
- [ ] Critical roles passed competency check
- [ ] Super-users named; support model published

---

## 22. Phase 19 — Go-live cut-over

**Owner:** Implementation Lead + Principal · **Effort:** 3–5 days around the date

### 22.1 Go-live readiness review (T-7 days)
Checklist:
- [ ] G0–G9 passed and documented
- [ ] Licence active, expiry and grace confirmed
- [ ] Production monitoring, alerts and backups verified
- [ ] Pre-cut-over backup taken and restore proven
- [ ] Rollback criteria and owner agreed
- [ ] Communication to staff, parents, students, vendors sent
- [ ] Support rota confirmed for the first two weeks
- [ ] Old-system freeze date agreed

### 22.2 Cut-over plan (T-3 to T0)
1. **Freeze** changes in the legacy system at the agreed time.
2. Final incremental data extract (new admissions, payments, leave since last load); run validated scripts; reconcile.
3. Take a full backup; record versions.
4. Switch domain/links to production; disable/redirect old portals.
5. Enable production integrations (payment gateway live mode, production email/SMS/WhatsApp senders, OAuth production redirect URIs).
6. Send invitations/credentials to remaining users; open parent/student access on a scheduled time.
7. Smoke test on production with a scripted checklist (login, attendance, invoice/receipt, notification, report print).
8. Announce go-live.

### 22.3 Day-1 operations
1. War-room (physical or chat) staffed by vendor + school super-users.
2. Track issues in one queue with severity and owner; publish a mid-day and end-of-day status.
3. Monitor performance, error logs and notification delivery; watch billed-channel volume (SMS/WhatsApp).

### 22.4 Rollback decision
1. Rollback only for defined critical failures (data corruption, unrecoverable outage, security breach).
2. Rollback steps: stop writes, restore the pre-cut-over backup, re-open legacy, communicate, root-cause, reschedule.

### Exit
Go-live approval signed; Day-1 report issued.

### Pitfalls
Going live during exams or fee-due week · no freeze on the legacy system · parents not told how to get support · production email in spam.

---

## 23. Phase 20 — Hypercare and first-term stabilisation

**Owner:** Support Engineer · **Duration:** 2–4 weeks hypercare, then a full first term of monitoring

### Steps
1. **Daily stand-up** during hypercare: open issues, usage anomalies.
2. **Adoption metrics:** login rates by role, attendance completion rate by teacher, homework usage, fee collection via system, helpdesk volume.
3. **Data quality checks:** duplicate students, attendance gaps, unlinked guardians, unposted transactions, audit anomalies.
4. **Finance reconciliation:** weekly during first month; month-end close rehearsal (soft close).
5. **Performance and error review:** latency, failed jobs, delivery failures, cost of billed channels.
6. **Feedback loop:** structured feedback from super-users; prioritise fixes; publish release notes.
7. **Settings tuning:** notification thresholds, digest rules, absence-alert timing, leave rules, fee reminders.
8. **First-term review:** 30/60/90-day review with the Principal against the success criteria (Appendix H).
9. **Handover to steady-state support:** SLA, contact routes, change-request process, training refreshers.
10. **Close-out report:** what was configured, what is provisional, open items, lessons learned.

### Exit
Hypercare closed with sign-off; provisional (⚠) items have a scheduled resolution plan.

---

## 24. Phase 21 — Year-end rollover and continuous operation

**Objective:** Repeat safely each year without re-doing setup.

### 24.1 Year-end checklist
1. Complete final exams, moderation and report cards ⚠ (grading design).
2. Reconcile fees; decide treatment of outstanding balances; close the financial period (soft close) and export statements.
3. Run the **Promotion Engine** on a rehearsal copy first: rules classify students as **Promote / Retain / Review Required**; committee reviews; overrides need reasons (audited).
4. Approve and commit promotions; new-year enrolment records are created; **prior-year records remain intact**.
5. Rebalance sections; update class teachers; rebuild the timetable (🤖 AI draft needs approval).
6. Graduating students → **alumni conversion** (consent-based).
7. Generate promotion letters, updated ID cards, next-year **book lists** for BookShop pre-orders.
8. Create the **new academic year**, periods and holiday calendar; carry over fee structures with revisions; reset leave-year balances per accrual/carry-forward rules.
9. Archive per retention policy; verify backups; renew the **licence** (check expiry and limits against next year's headcount).
10. Review outlet and facility contracts (concession terms, hall rate cards, vendor document expiries).
11. Post-year review: adoption, incidents, feature requests, training refresh.

### 24.2 Continuous operation cadence
| Cadence | Activity |
|---|---|
| Daily | Attendance, notifications, cash/receipts, helpdesk |
| Weekly | Finance reconciliation, absentee follow-up, backup verification |
| Monthly | Leave/attendance reconciliation, concession settlements, trial balance review, licence-limit check |
| Termly | Reports, promotions review (mid-year), permission-matrix review, audit-log review |
| Annually | Rollover, licence renewal, DR drill, security scan, policy review |

---

# Appendices

## Appendix A — Master setup checklist (condensed)

**Foundation**
- [ ] Discovery complete, decisions logged (G0)
- [ ] Edition, limits, serial key, school_id ready (G1)
- [ ] Dedicated DB, app, HTTPS, secrets, backups (restore tested), monitoring (G2)
- [ ] Licence activated; first + second admin; lockout verified (G3)

**Configuration**
- [ ] Profile, locale, time zone, currency, rounding, security policy, notifications
- [ ] Modules enabled per licence
- [ ] Roles, permission matrix approved; staff users created; approval chains

**Academic & people**
- [ ] Year, periods, stages, grades, sections, subjects, curricula, rooms, bell schedule, calendar
- [ ] Timetable conflict-free; promotion rules
- [ ] Staff, students, guardians, class allocation verified; IDs issued

**Policies & money**
- [ ] Attendance and leave policies ⚠
- [ ] CoA, posting rules, tax ⚠, payment gateway, fee structures/assignments, opening balances
- [ ] Payroll (if licensed)

**Modules**
- [ ] Learning/online classes, communication, noticeboard, chatbot
- [ ] Library, transport, hostel, assets, facilities/hall, BookShop/Canteen ⚠, wallet ⚠, events/clubs/prefects/alumni, helpdesk
- [ ] Document templates proofed in all languages

**Integrations & quality**
- [ ] Hardware, bell, displays, printers, gateways, OAuth/SSO
- [ ] Data migrated and reconciled (G7)
- [ ] Security/audit/backup verification complete
- [ ] UAT signed (G8)
- [ ] Training complete (G9)

**Launch**
- [ ] Readiness review, cut-over, Day-1 report, hypercare, first-term review

## Appendix B — School profile questionnaire (template)

| # | Question | Answer | Owner |
|---|---|---|---|
| 1 | Legal name / short name | | Admin |
| 2 | Registration & tax numbers | | Finance |
| 3 | Address, phones, email, website | | Admin |
| 4 | Number of students / staff (current and projected) | | Principal |
| 5 | Academic year dates | | Coordinator |
| 6 | Period model (annual/semester/trimester/quarter/custom) | | Coordinator |
| 7 | Grade range and naming | | Coordinator |
| 8 | Curricula and tracks per grade | | Coordinator |
| 9 | Working days / weekend / school hours | | Admin |
| 10 | Languages to enable; default language | | Principal |
| 11 | Currency, tax, rounding | | Finance |
| 12 | Facilities to manage; hall rental yes/no | | Admin |
| 13 | BookShop/Canteen: operator model and contracts | | Admin |
| 14 | Hostel, transport, library in scope? | | Admin |
| 15 | Hardware inventory | | IT |
| 16 | Email domain and providers | | IT |
| 17 | Existing systems and export formats | | Data Champion |
| 18 | Target go-live date | | Principal |

## Appendix C — Full RACI (setup activities)

| Activity | Impl. Lead | DevOps | Support Eng. | Trainer/QA | Principal | School Admin | Finance | HR | Academic Coord. | IT |
|---|---|---|---|---|---|---|---|---|---|---|
| Discovery | A/R | – | C | – | C | R | C | C | R | C |
| Edition & licence | A/R | I | R | – | C | I | I | – | – | – |
| Provisioning | A | R | C | – | – | I | – | – | – | C |
| Activation | C | C | A/R | – | I | R | – | – | – | C |
| Settings | C | – | C | – | A | R | C | C | C | C |
| Roles & users | C | – | C | – | A | R | I | R | I | – |
| Academic structure | C | – | C | – | A | R | – | – | R | – |
| Staff/student data | C | – | R | – | I | A/R | C | R | R | – |
| Finance & GL | C | – | C | – | A | C | R | – | – | – |
| Modules & operations | C | – | C | – | A | R | C | C | C | C |
| Templates | C | – | C | – | A | R | C | – | R | – |
| Integrations | C | R | A/R | – | I | I | C | – | – | R |
| Migration | A | R | R | C | I | R | R | R | R | C |
| Security verification | A | R | C | R | I | I | – | – | – | C |
| UAT | A | – | C | R | A | R | R | R | R | C |
| Training | C | – | C | A/R | I | R | R | R | R | – |
| Go-live | A/R | R | R | R | A | R | R | R | R | C |
| Hypercare | A | R | R | R | I | R | R | R | R | C |

## Appendix D — In-app Setup Wizard map

| Wizard step | Screen | Phase | Depends on |
|---|---|---|---|
| W1 | Activate licence | 3 | — |
| W2 | Create administrators | 3 | W1 |
| W3 | School profile & branding | 4 | W2 |
| W4 | Language, time, currency | 4 | W3 |
| W5 | Security & notification policy | 4 | W4 |
| W6 | Enable modules | 5 | W1 |
| W7 | Roles & permissions | 6 | W6 |
| W8 | Users & approval chains | 6 | W7 |
| W9 | Academic year & periods | 7 | W4 |
| W10 | Stages, grades, sections | 7 | W9 |
| W11 | Subjects & curricula | 7 | W10 |
| W12 | Rooms, bell schedule, calendar | 7 | W9 |
| W13 | Staff & departments | 8 | W8, W11 |
| W14 | Students & guardians | 8 | W10 |
| W15 | Class allocation | 8 | W13, W14 |
| W16 | Timetable | 7/8 | W12, W13, W15 |
| W17 | Attendance & leave policy ⚠ | 9 | W15 |
| W18 | Finance: CoA, tax ⚠, payments | 10 | W4 |
| W19 | Fee structures & assignment | 10 | W15, W18 |
| W20 | Opening balances | 10 | W18, W19 |
| W21 | Learning & communication | 11 | W15 |
| W22 | Operations modules | 12 | W6, W18 |
| W23 | Document templates | 13 | W3 |
| W24 | Integrations & devices | 14 | W6 |
| W25 | Readiness check → go-live | 19 | all |

## Appendix E — Import templates (minimum fields)

| Dataset | Required fields | Validations |
|---|---|---|
| Staff | employee no., name, DOB, gender, role, department, designation, join date, contract type, email/phone | unique employee no. and email within the school; valid dates |
| Students | admission no., name, DOB, gender, grade, section, track, admission date | unique admission no.; grade/section exist; DOB plausible for grade |
| Guardians | name, relation, phone/email, student link(s), financial-responsible flag | ≥ 1 reachable contact per student |
| Subjects | code, name, type, grade(s), curriculum, periods/week | code unique |
| Fee structures | category, grade/track, amount (minor units), frequency, due dates | amounts ≥ 0; currency matches settings |
| Opening balances | account, debit/credit, per-student receivables | debits = credits |
| Library | ISBN/title, copies, barcode, classification | barcode unique |
| Assets | tag, category, purchase date, value, location/custodian | tag unique |
| Leave balances ⚠ | staff, leave type, balance, as-of date | non-negative; leave type exists |

## Appendix F — Module dry-run script format

For each module record: **Preconditions → Steps → Expected result → Evidence (screenshot/log) → Pass/Fail → Tester → Date.** Include at least one **negative test** (denied action, invalid input, limit exceeded) per module and one **audit check** for every sensitive action.

## Appendix G — Decision log template

| ID | Date | Decision | Options considered | Decided by | Impact / linked ticket |
|---|---|---|---|---|---|
| D-001 | | Academic period model | Trimester vs Semester | Principal | Phase 7 |
| D-002 | | Bookshop operator | School-run vs third-party | Principal | Phase 12 |
| D-003 | | Hall external hire allowed | Yes/No + rates | Principal | Phase 12 |
| D-004 | | Wallet enabled | Yes/No + legal review | Principal | `PC-006` |

## Appendix H — Success criteria (30/60/90 days)

| Metric | Target |
|---|---|
| Daily attendance completed by teachers | ≥ 95% of scheduled sessions |
| Guardian absence alerts delivered | ≥ 98% within the configured window |
| Fee receipts issued via system | 100% |
| Trial balance balances every month | Yes (debits = credits) |
| Staff leave processed in-system | ≥ 95% |
| Critical incidents | 0 unresolved beyond SLA |
| Users active weekly (staff) | ≥ 90% |
| Helpdesk first response within SLA | ≥ 90% |
| Support tickets trending down after week 4 | Yes |

## Appendix I — Timeline templates (indicative, calendar weeks)

| Edition / scope | Discovery | Provision + Activate | Config + Academic | People + Data | Finance + Modules | UAT + Train | Go-live + Hypercare | **Total** |
|---|---|---|---|---|---|---|---|---|
| Basic (core only) | 1 | 0.5 | 1 | 1–2 | 1 | 1 | 2 | **~7–9** |
| Standard | 1–2 | 1 | 1–2 | 2 | 2 | 2 | 3 | **~11–13** |
| Deluxe | 2 | 1 | 2 | 2–3 | 3 | 2 | 3–4 | **~14–17** |
| Enterprise (+SSO, HA, custom) | 2–3 | 1–2 | 2 | 3 | 3–4 | 2–3 | 4 | **~17–21** |

Phases overlap; the critical path is **data collection and cleaning**. Start it in week 1.

## Appendix J — Risk register (setup-specific)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Data late/dirty | High | High | Templates day 1, named Data Champion, dry-run imports |
| Provisional design (⚠) unresolved at UAT | Medium | High | Track `PC-000…PC-006`; mark provisional; schedule post-go-live tuning |
| Wrong academic period model | Low | High | Confirm with official calendar; document in decision log |
| Users untrained at go-live | Medium | High | Competency checks; super-users; support rota |
| Go-live during exams/fee peak | Medium | High | Fix date in Phase 0; block bad windows |
| Email/WhatsApp deliverability | Medium | Medium | Verify domain/templates early; small test groups |
| Billed-channel cost blow-out | Medium | Medium | Default to email; rate limits and digesting |
| Hardware/network issues | Medium | Medium | Site survey; offline queues; spare devices |
| Vendor (concessionaire) compliance gaps | Medium | Medium | Document expiry alerts; contract checklist before enabling outlet |
| Stored-value (wallet) regulation | Low–Med | High | Legal review before enabling; keep optional |
| Single admin dependency | Medium | Medium | Second admin + break-glass procedure |
| Licence expiry mid-year | Low | High | Renewal reminders, grace period, calendar alerts |
| Rollback needed at go-live | Low | High | Backup + tested restore + defined rollback triggers |

---

*End of EduFlow — School Setup Workflow Process Plan v1.0*
