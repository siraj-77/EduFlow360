# EduFlow — School Management System (SMS) / School ERP
## Software Requirements Specification (SRS), Unit Testing Strategy, MVP Definition & Project Roadmap — v1.2

**Companion document to:** Project Master Plan v5.2
**Standard reference:** Structured per IEEE 830 / ISO/IEC/IEEE 29148 conventions, adapted for an Agile, phase-based delivery model
**Audience:** Engineering team, QA, Product Owner, School Stakeholders (Principal/Admin sign-off), Investors/Sponsors

---

## Table of Contents

**Part A — Software Requirements Specification (SRS)**
1. Introduction
2. Overall Description
3. System Features & Functional Requirements (by Module)
4. External Interface Requirements
5. Non-Functional Requirements
6. Data Requirements & Key Entities
7. Use Case Summary (Actor × Capability Matrix)
8. Constraints, Assumptions & Dependencies

**Part B — Unit Testing Strategy**
9. Testing Philosophy & Test Pyramid
10. Unit Testing Standards & Tooling
11. Module-by-Module Unit Test Plan
12. Coverage Targets & Definition of Done
13. Integration, E2E & Non-Functional Test Layers
14. CI/CD Test Gates

**Part C — Starting Point (Project Kickoff)**
15. Repository & Environment Setup
16. Day-1 to Week-1 Engineering Checklist
17. Baseline Architecture Scaffold

**Part D — MVP Definition**
18. MVP Philosophy & Selection Criteria
19. MVP Scope (In / Out)
20. MVP Acceptance Criteria

**Part E — Project Roadmap**
21. Roadmap Overview (Timeline View)
22. Phase-by-Phase Detail with Duration & Exit Criteria
23. Team Composition per Phase
24. Milestones & Sign-Off Gates

---
---

# PART A — SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

## 1. Introduction

### 1.1 Purpose
This SRS defines the functional and non-functional requirements for the School Management System (SMS) described in Master Plan v5.0. It is the contractual/engineering reference for what the system must do, independent of how the Master Plan's architecture chooses to implement it.

### 1.2 Scope
The SMS is a single-tenant, modular School ERP covering: Admin/RBAC, Academic Management (incl. Promotion), Unified Attendance (Student/Teacher/Staff), Workforce & Leave Management, Learning & Collaboration (Homework + Online Classrooms), Identity & Document Generation, Library, Transport, Hostel (optional), Sports/Events, Facilities & Grounds Hire, Alumni Network, Student Leadership, Finance, Communication, Asset/Inventory, AI Services, Helpdesk, Mobile Apps, and platform-level Licensing/Auditing/Security.

### 1.3 Definitions, Acronyms & Abbreviations
| Term | Meaning |
|---|---|
| SMS | School Management System |
| RBAC | Role-Based Access Control |
| SRS | Software Requirements Specification |
| MVP | Minimum Viable Product |
| FR / NFR | Functional Requirement / Non-Functional Requirement |
| SLA | Service Level Agreement |
| KG1–Grade 13 | Configurable education-stage range supported by the Academic Hierarchy |

### 1.4 References
- Project Master Plan v5.2 (all §-numbers cited below refer to that document unless noted).

### 1.5 Document Conventions
Each functional requirement is coded `FR-<MODULE>-<NUMBER>` and tagged with priority: **P0 (MVP-critical)**, **P1 (near-term)**, **P2 (later phase)**. Priority tagging is what feeds the MVP definition in Part D.

---

## 2. Overall Description

### 2.1 Product Perspective
Single-tenant deployment: one dedicated application + database instance per school. Web (Next.js/React), API (NestJS), Mobile (React Native/Expo). Feature access governed by signed license certificates (Basic/Standard/Deluxe/Enterprise).

### 2.2 User Classes & Characteristics
| Actor | Description | Primary Surfaces |
|---|---|---|
| Super Admin (in-school) | Highest-privilege role *within one school's deployment* (not cross-school); manages licence activation and module settings | Web |
| School Admin/Principal | Full school-level control, approvals, sign-offs | Web |
| Academic Coordinator/VP | Timetable, substitution, promotion review | Web |
| Teacher | Class delivery, attendance, homework, grading, leave requests | Web + Mobile (Teacher Companion) |
| Non-Teaching Staff | Shift attendance, leave, HR self-service | Mobile (Staff Self-Service) |
| Student | Academic consumption, homework submission, portal | Web + Mobile |
| Parent/Guardian | Monitoring, payments, communication | Mobile (Personal Portal) primarily |
| Librarian / Transport Admin / Hostel Warden / Facility Manager | Domain-specific operational staff | Web |
| Alumni | Post-graduation directory/events participant | Web/Mobile (Alumni Portal) |
| External Hirer | Non-affiliated party booking a facility or hall | Public booking portal (lightweight identity, no full account) |
| Outlet Operator (BookShop/Canteen) | School staff or third-party concessionaire running an outlet | Web / tablet POS (vendor role scoped to own outlet) |

### 2.3 Operating Environment
Cloud or on-premise Linux server; PostgreSQL 14+; Redis 6+; modern evergreen browsers (Chrome/Edge/Safari/Firefox last 2 versions); Android-first mobile (iOS parity targeted post-MVP).

### 2.4 Design & Implementation Constraints
Clean Architecture layering (§2.2 Master Plan) must be respected; all hardware/vendor integrations go through adapter interfaces (no direct vendor SDK calls in domain/use-case code); every sensitive action must produce an audit record (§6 Master Plan).

### 2.5 User Documentation
In-app contextual help, an Admin Setup Wizard for first-time school onboarding, and role-specific quick-start guides (Teacher, Parent, Admin).

---

## 3. System Features & Functional Requirements (by Module)

> Requirements are grouped by Master Plan module/section. Priority (P0/P1/P2) determines MVP inclusion — see Part D.

### 3.1 Platform Core & RBAC (Master Plan §5 Platform)
| ID | Requirement | Priority |
|---|---|---|
| FR-PLT-01 | System shall support JWT-based authentication with configurable session expiry and refresh-token rotation. | P0 |
| FR-PLT-02 | System shall support OTP-based login/verification for parent/student self-service flows. | P1 |
| FR-PLT-03 | System shall enforce module-, page-, action-, and API-level RBAC, with immutable system roles and configurable custom roles. | P0 |
| FR-PLT-04 | System shall enforce ownership policies (e.g., a teacher may only edit grades for classes they are assigned to). | P0 |
| FR-PLT-05 | System shall validate a signed license certificate at startup and enforce feature-entitlement gating on both UI and API layers. | P0 |
| FR-PLT-06 | System shall degrade to a locked maintenance mode if the license signature fails validation, and shall support a configurable grace period on renewal-server unavailability. | P1 |
| FR-PLT-07 | System shall write an immutable, append-only audit record for every sensitive action (finance, grades, permissions, attendance overrides, leave approvals, document issuance). | P0 |
| FR-PLT-08 | System shall provide a structured JSON error/diagnostic log with rotation (25MB cap, 3 historical files retained). | P1 |
| FR-PLT-09 | System shall support runtime language switching across English (default), Tamil, Sinhala, and Arabic, with the selected language persisted on the user profile. | P1 |
| FR-PLT-10 | System shall render the UI in right-to-left (RTL) layout when Arabic is selected, without breaking any component's usability. | P1 |

### 3.2 Academic Management (§7, §11)
| ID | Requirement | Priority |
|---|---|---|
| FR-ACA-01 | System shall support a configurable Education Stage → Grade/Year → Section → Subject → Curriculum hierarchy with no hard-coded grade levels. | P0 |
| FR-ACA-02 | System shall support configurable academic periods (Annual/Semester/Trimester/Quarter/Custom). | P0 |
| FR-ACA-03 | System shall support multiple curriculum frameworks (National/Cambridge/IB/Custom) running concurrently within a school. | P1 |
| FR-ACA-04 | System shall support Timetable creation with conflict detection (teacher, room, subject double-booking). | P0 |
| FR-ACA-05 | System shall support an AI-assisted Timetable draft that requires explicit human approval before publication. | P2 |
| FR-ACA-06 | System shall support Exam creation, mark entry, grade calculation per configurable grading scheme, and rank/position calculation where enabled. | P0 |
| FR-ACA-07 | System shall run a Promotion Rule Engine (Automatic / Criteria-Based / Manual-Review) at year-end, classifying each student as Promote / Retain / Review Required, with human override and audit trail. | P1 |
| FR-ACA-08 | System shall preserve full student academic history across promotions/transfers (no overwrite of prior-year records). | P0 |

### 3.3 Unified Attendance Engine (§8)
| ID | Requirement | Priority |
|---|---|---|
| FR-ATT-01 | System shall record attendance for Student, Teacher, and Staff actor types under one shared data model. | P0 |
| FR-ATT-02 | System shall support pluggable capture sources: Manual, QR self-check-in, Biometric, RFID, Geo-fenced mobile. | P0 (Manual/QR) / P1 (Biometric/RFID) |
| FR-ATT-03 | System shall support period-wise and/or daily student attendance per school configuration. | P0 |
| FR-ATT-04 | System shall trigger automatic parent notification on unexplained student absence, with configurable delay. | P0 |
| FR-ATT-05 | System shall support an audited attendance regularization workflow (retroactive correction with mandatory reason). | P1 |
| FR-ATT-06 | System shall detect discrepancies between teacher check-in and scheduled period coverage, routing them to a coordinator review queue. | P1 |
| FR-ATT-07 | System shall support shift-based staff attendance with overtime capture. | P1 |
| FR-ATT-08 | System shall provide attendance analytics (trend, chronic-absenteeism flags) by student/class/section/school. | P1 |

### 3.4 Workforce Management — Leave (§9)
| ID | Requirement | Priority |
|---|---|---|
| FR-WFM-01 | System shall support a configurable leave-type catalog with eligibility rules by role/contract/tenure. | P1 |
| FR-WFM-02 | System shall calculate leave accrual/balance in real time and expose it via API to Web and Mobile. | P1 |
| FR-WFM-03 | System shall support multi-level, configurable-chain leave approval workflows with SLA-based auto-escalation. | P1 |
| FR-WFM-04 | System shall auto-propose substitute teachers on approved leave, using timetable/qualification/workload constraints, requiring human sign-off before assignment. | P2 |
| FR-WFM-05 | System shall reconcile Leave records against Attendance records nightly to prevent double-counting. | P1 |

### 3.5 Learning & Collaboration (§10)
| ID | Requirement | Priority |
|---|---|---|
| FR-LRN-01 | System shall allow teachers to create assignments scoped to class/section/subject with resources and a due date. | P1 |
| FR-LRN-02 | System shall allow students to submit assignments as text, file, or photo capture, with resubmission until deadline. | P1 |
| FR-LRN-03 | System shall support rubric-based or free-form evaluation with score + feedback, and configurable late-submission penalty rules. | P1 |
| FR-LRN-04 | System shall support scheduling and joining Online Classrooms via a vendor-agnostic adapter (Zoom, Google Meet, or self-hosted Jitsi). | P2 |
| FR-LRN-05 | System shall ingest video-session join/leave events into the Attendance Engine, subject to teacher confirmation. | P2 |
| FR-LRN-06 | System shall maintain a reusable Digital Lesson Plan library, taggable by subject/grade/curriculum. | P2 |

### 3.6 Identity & Document Generator (§12)
| ID | Requirement | Priority |
|---|---|---|
| FR-DOC-01 | System shall generate Student and Staff ID cards from a configurable template (photo, QR/barcode, validity), single and batch. | P1 |
| FR-DOC-02 | System shall generate certificates (Transfer, Bonafide, Character, Custom) via merge-field templating with an approval workflow before issuance. | P1 |
| FR-DOC-03 | System shall render Report Cards in configurable paper sizes (A4, A5, custom) and layout variants bound per curriculum track. | P0 |
| FR-DOC-04 | System shall version document templates such that already-issued documents remain reproducible from the template version used at issuance. | P2 |
| FR-DOC-05 | System shall support the ID card's QR/barcode as a reusable identifier across Attendance, Library, and Asset custody modules. | P2 |

### 3.7 Finance (§5 Finance)
| ID | Requirement | Priority |
|---|---|---|
| FR-FIN-01 | System shall support configurable fee structures, student fee assignment, and installment plans. | P0 |
| FR-FIN-02 | System shall generate invoices/receipts and record payments via pluggable payment gateway adapters. | P0 |
| FR-FIN-03 | System shall maintain a double-entry Chart of Accounts and General Ledger. | P1 |
| FR-FIN-04 | System shall support scholarships/discount rules and fine/fee reversal-adjustment workflows with audit trail. | P1 |
| FR-FIN-05 | System shall calculate payroll with attendance/leave-linked deductions where enabled. | P2 |
| FR-FIN-06 | System shall auto-post a balanced double-entry journal entry to the General Ledger for every financial transaction (fee payment, invoice, expense, refund), via a configurable posting-rule engine. | P1 |
| FR-FIN-07 | System shall provide a school-configurable Chart of Accounts, pre-seeded with a sensible default on school setup. | P1 |
| FR-FIN-08 | System shall generate a Trial Balance, General Ledger view (by account/date range), and a basic Income & Expenditure Statement. | P1 |
| FR-FIN-09 | System shall support manual journal entries for adjustments, subject to mandatory reason capture and audit logging. | P1 |

### 3.8 Communication (§5 Communication)
| ID | Requirement | Priority |
|---|---|---|
| FR-COM-01 | System shall route notifications through Email, SMS, WhatsApp, and Push channels based on event type and user channel preference. | P0 (Email/Push) / P1 (SMS/WhatsApp) |
| FR-COM-02 | System shall support a Digital Noticeboard publishing to Web, Mobile, and connected physical displays. | P2 |
| FR-COM-03 | System shall support Emergency Alert broadcast bypassing normal digest/batching rules. | P1 |

### 3.9 Library, Transport, Hostel (§13, §14, §15)
| ID | Requirement | Priority |
|---|---|---|
| FR-LIB-01 | System shall support catalog, circulation (issue/return/renew/reserve), and overdue-fine calculation. | P2 |
| FR-TRP-01 | System shall support vehicle/driver/route/stop registry and student-to-route allocation with transport fee linkage. | P2 |
| FR-TRP-02 | System shall support live GPS tracking and boarding/alighting attendance capture where licensed. | P2 |
| FR-HST-01 | System shall support hostel room/bed allocation, hostel attendance, and gate-pass approval workflow (optional module). | P2 |

### 3.10 Sports/Events, Facilities Hire, Alumni, Student Leadership (§16–§19)
| ID | Requirement | Priority |
|---|---|---|
| FR-EVT-01 | System shall support a shared School Event Calendar across Sports, Alumni, and general announcements. | P2 |
| FR-EVT-02 | System shall support sports-meet event/heat setup, house/team scoring, and leaderboard generation. | P2 |
| FR-FAC-01 | System shall support facility booking (internal) with conflict checking against Timetable and maintenance windows. | P2 |
| FR-FAC-02 | System shall support external facility hire requests with approval workflow, rate-card invoicing, and supervision sign-off. | P2 |
| FR-FAC-03 | System shall support School Hall rental lifecycle: enquiry, tentative hold with expiry, quote, deposit, confirmation, pre/post-event inspection, and settlement. | P2 |
| FR-FAC-04 | System shall prevent displacement of confirmed bookings except by audited Admin override; internal events may pre-empt only tentative holds. | P2 |
| FR-RET-01 | System shall manage retail outlets (BookShop, Canteen) with an effective-dated operator model of SCHOOL_RUN or THIRD_PARTY. | P2 |
| FR-RET-02 | System shall record outlet sales through the shared stock engine and post to the GL: gross sales + COGS for SCHOOL_RUN; rent/commission only for THIRD_PARTY. | P2 |
| FR-RET-03 | System shall store concession contracts and auto-generate periodic settlement statements (rent, commission, minimum guarantee). | P2 |
| FR-RET-04 | System shall track vendor compliance documents with expiry alerts and restrict vendor users to their own outlet. | P2 |
| FR-CAN-01 | System shall manage canteen menus with allergen/dietary tags, availability schedules, and publication to app and noticeboard. | P2 |
| FR-CAN-02 | System shall surface student allergy/dietary flags at point of sale and log any staff override. | P2 |
| FR-CAN-03 | System shall support canteen pre-orders with pickup slots and meal plans. | P2 |
| FR-CAN-04 | System shall support subsidised/free meals linked to concession rules, posting the subsidy to the GL. | P2 |
| FR-BKS-01 | System shall manage grade-wise and curriculum-track book sets/bundles. | P2 |
| FR-BKS-02 | System shall allow purchase by pay-now or charge-to-student-fee-account. | P2 |
| FR-BKS-03 | System shall publish next-year book lists and accept pre-orders after promotion decisions are finalised. | P2 |
| FR-WAL-01 | System shall provide an optional prepaid Student Wallet with parental spend limits, recorded as a GL liability. | P2 |
| FR-ALM-01 | System shall convert a graduating student into an Alumni profile upon explicit consent, preserving read-only academic history. | P2 |
| FR-LDR-01 | System shall support leadership role appointment workflow and duty roster management. | P2 |

### 3.11 Asset & Inventory (§20)
| ID | Requirement | Priority |
|---|---|---|
| FR-AST-01 | System shall maintain an asset registry with custody allocation and transfer workflow. | P2 |
| FR-AST-02 | System shall track consumable stock with reorder-level alerts. | P2 |

### 3.12 AI Services (§21)
| ID | Requirement | Priority |
|---|---|---|
| FR-AI-01 | System shall provide an AI Chatbot scoped to the asking user's RBAC permissions, answering data questions (attendance/fees/homework) via internal API calls, never performing writes without explicit user confirmation. | P2 |
| FR-AI-02 | System shall ground policy/FAQ chatbot answers in a retrieval layer over school-provided documents, falling back to a Helpdesk ticket when confidence is low. | P2 |
| FR-AI-03 | System shall provide AI-drafted report-card comments and lesson plans, always requiring teacher review/approval before publishing. | P2 |

### 3.13 Helpdesk (§22)
| ID | Requirement | Priority |
|---|---|---|
| FR-HLP-01 | System shall support ticket creation, category-based routing, SLA tracking, and escalation. | P2 |

### 3.14 Mobile Ecosystem (§24)
| ID | Requirement | Priority |
|---|---|---|
| FR-MOB-01 | Mobile app shall support a first-launch Capability Setup Wizard configuring Personal Portal / Bus Tracker / Attendance Kiosk / Teacher Companion / Staff Self-Service modes. | P0 (Personal Portal) / P1 (others) |
| FR-MOB-02 | Attendance Kiosk mode shall operate offline-first, queuing capture events and syncing on reconnect. | P1 |
| FR-MOB-03 | Mobile app shall support push notifications routed through the platform's Notification Router. | P0 |

---

## 4. External Interface Requirements

| Interface | Requirement |
|---|---|
| Payment Gateways | Pluggable adapter interface; MVP ships with one gateway (configurable per region), architecture supports adding more without core changes. |
| Biometric/RFID Hardware | `IAttendanceCaptureAdapter` — vendor implementations (ZKTeco/Hikvision) added post-MVP. |
| WhatsApp/SMS/Email | Provider adapter pattern (Meta/Twilio/Wati for WhatsApp); MVP ships with Email + Push; SMS/WhatsApp adapters added P1. |
| Video Conferencing | `IVideoConferenceAdapter` — Zoom/Google Meet/Jitsi, added P2. |
| Maps/GPS | OSM-tile-based abstraction for Transport tracking, added P2. |

---

## 5. Non-Functional Requirements

*(Full detail in Master Plan §27; summarized here as testable NFRs.)*

| ID | Requirement | Target |
|---|---|---|
| NFR-01 | Availability | 99.5% (Standard), 99.9% (Enterprise, HA) |
| NFR-02 | Attendance capture round-trip latency (LAN device) | < 500ms |
| NFR-03 | Kiosk offline operation window | ≥ 72 hours |
| NFR-04 | Backup | Nightly encrypted, point-in-time recovery (Enterprise) |
| NFR-05 | Accessibility | WCAG 2.1 AA for admin/teacher web screens |
| NFR-06 | Localization | Multi-language UI: English (default), Tamil, Sinhala, Arabic — with RTL layout support for Arabic |
| NFR-07 | Data Retention | Configurable per module; audit logs ≥ 7 years for finance actions |
| NFR-08 | Biometric data storage | Irreversible hash only, never raw images, where hardware permits |
| NFR-09 | Security | OWASP Top-10 mitigations verified pre-release; role-scoped API authorization on every endpoint |

---

## 6. Data Requirements & Key Entities (Core Domain Model Summary)

`School`, `AcademicYear`, `EducationStage`, `Grade`, `Section`, `Subject`, `Curriculum`, `Student`, `Guardian`, `Staff` (Teacher/Non-Teaching), `Enrollment`, `AttendanceRecord` (actor-agnostic: STUDENT/TEACHER/STAFF), `LeaveRequest`, `LeaveBalance`, `Assignment`, `Submission`, `VideoSession`, `Exam`, `MarkEntry`, `ReportCard`, `PromotionDecision`, `Invoice`, `Payment`, `LedgerEntry`, `Notification`, `AuditRecord`, `License`, `Device`, `IdCard`, `Certificate`, `FacilityBooking`, `AlumniProfile`, `LeadershipRole`, `Ticket`, `Asset`. Full ERD to be finalized in Phase 0 (§27 Master Plan Risk #1: Admission pipeline needs its own explicit entity set).

---

## 7. Use Case Summary (Actor × Capability Matrix — abridged)

| Capability | Admin | Teacher | Student | Parent | Staff | Alumni |
|---|---|---|---|---|---|---|
| Mark/View Attendance | View all | Mark own class | View own | View child | Mark own check-in | — |
| Submit/Approve Leave | Approve | Submit/Approve (if HOD) | — | — | Submit | — |
| Create/Submit Homework | View | Create/Grade | Submit | View | — | — |
| View/Pay Fees | Manage | — | View own | View/Pay | — | — |
| Generate ID/Certificate | Issue | — | Request | Request | Request | — |
| Book Facility | Approve | Request | — | External request path | Request | — |
| View Report Card | View all | Enter grades | View own | View child | — | — |

---

## 8. Constraints, Assumptions & Dependencies

- Single-tenant per school — no cross-school reporting in MVP (Master Plan §27 assumption).
- Hardware (biometric terminals, kiosks) is school-procured; platform ships adapters, not devices.
- Initial rollout targets Android-first mobile; iOS parity is a P1/P2 follow-on.
- Labor-law leave templates vary by country; MVP ships with one configurable template set, expanded per customer.

---
---

# PART B — UNIT TESTING STRATEGY

## 9. Testing Philosophy & Test Pyramid

```
                /\
               /  \      E2E (Playwright/Detox) — critical user journeys only
              /----\
             / Integ \   Integration (Supertest against NestJS modules + test DB)
            /--------\
           /   Unit    \ Unit (Jest) — majority of test volume, fast, isolated
          /--------------\
```

- **Guiding principle:** domain logic (use-cases, entities, rule engines — Promotion, Leave Accrual, Attendance Discrepancy Detection, Licensing Validator) must be unit-testable **without** a database or network call, per the Clean Architecture boundary in Master Plan §2.2 — this is what makes the unit-test layer fast and reliable.
- Every `IXxxAdapter` interface (Bell, Biometric, WhatsApp, Video Conference, Facility Booking, Payment) gets a **fake/mock implementation** used across unit tests, and a **contract test** run against the real adapter in integration/staging.

## 10. Unit Testing Standards & Tooling

| Layer | Tooling |
|---|---|
| Backend (NestJS) | Jest + `@nestjs/testing` TestingModule; `ts-mockito` or manual mocks for repository interfaces |
| Frontend (React/Next.js) | Jest + React Testing Library; MSW (Mock Service Worker) for API mocking |
| Mobile (React Native/Expo) | Jest + React Native Testing Library; Detox for E2E |
| Contract/Adapter Tests | Jest with adapter-specific fixture recordings (VCR-style HTTP cassette for third-party APIs) |
| Coverage Reporting | Istanbul/`nyc` via Jest `--coverage`, enforced in CI |

**Standards:**
- One test file per source file (`X.service.ts` → `X.service.spec.ts`), colocated.
- Arrange-Act-Assert structure; no shared mutable test state between cases.
- Domain rule engines (Promotion, Leave Accrual, Discrepancy Detection, License Validator, Facility Conflict Checker) require **table-driven tests** covering edge cases (boundary attendance %, leap-year accrual, overlapping bookings, expired license grace period).
- No test may depend on real time (`Date.now()`); inject a clock abstraction (`IClock`) everywhere date logic matters (accrual, license expiry, deadline checks).

## 11. Module-by-Module Unit Test Plan

| Module | Key Unit Test Targets |
|---|---|
| RBAC/Auth | Permission resolution for role+ownership combinations; token rotation edge cases; OTP expiry |
| Licensing | Signature verification (valid/tampered/expired); grace-period countdown logic; feature-flag resolution from payload |
| Academic Hierarchy | Curriculum-track isolation (Track A changes don't leak into Track B); period-progression math (weighted GPA across Term/Semester/Quarter models) |
| Promotion Engine | Rule classification (Promote/Retain/Review) across boundary attendance %/grade thresholds; audit-trail creation on override |
| Attendance Engine | Actor-agnostic record creation for all 3 actor types; capture-source conflict resolution; absentee-detector cron logic (mocked clock); regularization audit trail |
| Leave/Workforce | Accrual calculation (monthly pro-rata, tenure tiers, carry-forward cap); approval-chain routing incl. delegate-approver cycle prevention; SLA escalation timing |
| Learning/Homework | Late-submission penalty curve; resubmission-until-deadline boundary; rubric score aggregation |
| Online Classroom | `IVideoConferenceAdapter` fake — session create/join/end lifecycle; attendance-bridge confirmation logic |
| Document Engine | Template merge-field substitution correctness; paper-size layout selection by curriculum track; template-version snapshot integrity on reissue |
| Finance | Invoice calculation incl. discounts/fines; double-entry ledger balance invariants (debits==credits after every transaction); payment-gateway adapter fake |
| Facility Booking | Conflict detection (overlap, maintenance window); rate-card calculation (peak/off-peak); supervision-availability cross-check |
| Alumni | Consent-gated profile conversion; directory visibility per privacy setting |
| Asset/Inventory | Custody transfer state machine; reorder-alert threshold triggers |
| AI Gateway | Provider-abstraction fallback (provider A fails → provider B); RBAC scoping enforcement on chatbot data queries (critical security test — must prove a parent's session cannot query another child's data) |
| Notification Router | Channel-preference resolution; digest batching vs. emergency-bypass logic |

## 12. Coverage Targets & Definition of Done

| Layer | Minimum Coverage |
|---|---|
| Domain entities & use-cases (core business rules) | 90% line / 85% branch |
| Controllers/DTOs (thin layer) | 70% line |
| Adapters (thin wrappers over 3rd-party SDKs) | Contract-tested, not coverage-gated |
| Frontend components (logic-bearing hooks/utils) | 80% line |
| Frontend presentational components | Smoke-tested (renders without error), not coverage-gated |

**Definition of Done for any FR:** unit tests written and passing, integration test covering the happy path + at least one failure path, audit-log assertion where the FR touches a sensitive action, and a manual QA pass against the acceptance criteria before merge to `main`.

## 13. Integration, E2E & Non-Functional Test Layers

- **Integration:** NestJS module-level tests against a real (containerized, ephemeral) PostgreSQL + Redis, run in CI per PR.
- **E2E:** Playwright (web) / Detox (mobile) covering critical journeys: student admission → attendance marking → parent notification; leave request → approval → substitution assignment; fee invoice → payment → receipt; ID card batch generation; facility hire request → approval → invoice.
- **Load/Performance:** k6 or Artillery scripts targeting NFR-02 (attendance round-trip) and peak-login scenarios (start of school day).
- **Security:** OWASP ZAP baseline scan in CI; dependency vulnerability scanning (npm audit / Snyk) gating merges.

## 14. CI/CD Test Gates

```
PR opened → Lint + Typecheck → Unit Tests (must pass, coverage gate enforced)
          → Integration Tests (containerized DB)
          → Build (web/api/mobile)
          → [main branch only] E2E smoke suite → Security scan → Deploy to Staging
```

No merge to `main` without green unit + integration suites; no production deploy without a green staging E2E smoke run.

---
---

# PART C — STARTING POINT (PROJECT KICKOFF)

## 15. Repository & Environment Setup

```
sms-platform/
├── apps/
│   ├── web/              # Next.js admin/teacher/parent/student web app
│   ├── api/               # NestJS backend
│   └── mobile/            # React Native (Expo) app
├── packages/
│   ├── shared-types/      # Cross-app TypeScript DTOs/interfaces
│   ├── ui-kit/             # Shared shadcn/ui component wrappers
│   └── config/             # Shared ESLint/TSConfig/Prettier config
├── infra/
│   ├── docker/              # Local dev docker-compose (Postgres, Redis)
│   ├── ci/                   # CI pipeline definitions
│   └── terraform/ (optional) # IaC for staging/production
├── docs/
│   ├── SRS.md, MasterPlan.md, ERD.md
└── turbo.json / nx.json     # Monorepo task orchestration
```

- Monorepo (Turborepo or Nx) to share types/DTOs between `api`, `web`, and `mobile` — critical given how many modules (Attendance, Leave, Documents) cross all three surfaces.
- `docker-compose up` brings up local PostgreSQL + Redis for Day-1 development.

## 16. Day-1 to Week-1 Engineering Checklist

1. Repo scaffolded (monorepo structure above), CI pipeline skeleton green on an empty commit.
2. PostgreSQL schema migration tool selected (Prisma or TypeORM/MikroORM) and configured.
3. Auth module (JWT + RBAC skeleton) implemented and unit-tested — this is the dependency root for every other module.
4. Licensing Validator implemented and unit-tested (§10 Master Plan) — required before any feature-gated module can be built, since every subsequent module checks entitlements.
5. Audit Logging middleware wired at the NestJS interceptor level — implemented once, reused everywhere, so it must exist before other modules start writing sensitive-action code.
6. `IClock` abstraction and base testing utilities (fixtures, factory functions for `Student`, `Staff`, etc.) established for the whole team to reuse.
7. Design tokens / Tailwind theme finalized for the Web app (frontend-design baseline).
8. ERD workshop completed and signed off (Master Plan §27 flags Admission Management as needing explicit modeling — resolve in this workshop).

## 17. Baseline Architecture Scaffold

- Empty NestJS modules created for every top-level domain in the Master Plan §5 module tree (even if unimplemented), each with `controllers/`, `use-cases/`, `domain/`, `infrastructure/`, `dto/` folders — establishes the Clean Architecture boundary from day one so no module accidentally starts as a "god service."
- Empty `features/` directories mirrored in `apps/web/src/features/` per the same module list, following the feature-level composition pattern (Master Plan §25).

---
---

# PART D — MVP DEFINITION

## 18. MVP Philosophy & Selection Criteria

The MVP is defined as: **the smallest coherent slice that lets one real school run its core daily operations (admissions through report cards) end-to-end**, proving the architecture (RBAC, Licensing, Audit, Attendance, Finance) under real usage before layering on the richer modules (AI, Facilities Hire, Alumni, Hostel, Online Classrooms) that depend on it being solid.

Selection rule applied: an FR is **MVP (P0)** if the school cannot open and run a term without it; **P1** if it's expected within the first 1–2 terms of live usage; **P2** if it materially improves the product but the school can operate without it initially.

## 19. MVP Scope (In / Out)

### ✅ In MVP (P0 — from Part A's FR tables)
- Platform Core: Auth, RBAC, Licensing Validator, Audit Log (FR-PLT-01, 03, 04, 05, 07)
- Academic: Hierarchy, Periods, Timetable (conflict-checked), Exam/Marks/Grading (FR-ACA-01, 02, 04, 06, 08)
- Attendance: Student attendance (Manual + QR), parent absence alert (FR-ATT-01–04)
- Finance: Fee structure, invoicing, one payment gateway (FR-FIN-01, 02)
- Communication: Email + Push notifications (FR-COM-01 partial)
- Documents: Report Card generation, A4/A5 (FR-DOC-03)
- Mobile: Personal Portal mode (Parent/Student), push notifications (FR-MOB-01 partial, FR-MOB-03)
- Admin & User Management, Student Management, basic Admission workflow (registration → enrollment; full online-application pipeline is P1)

### 🟡 Fast-Follow (P1 — targeted immediately post-MVP, within 1–2 terms)
- Teacher/Staff Attendance, Leave Management (request/approve, no auto-substitution yet)
- Homework & Assignments (async, no Online Classroom yet)
- ID Card generation (single + batch)
- WhatsApp/SMS notification channels
- Teacher Companion & Staff Self-Service mobile modes
- Library Management
- Attendance analytics, regularization workflow

### ⏳ Later Phases (P2 — depends on P0/P1 foundations being stable)
- Online Classrooms (Zoom/Meet/Jitsi), AI Chatbot, AI Timetable Assistant, Substitution auto-assignment
- Facilities & Grounds Hire, School Hall rental pack, BookShop & Canteen (school-run/third-party), Student Wallet, Sports/Events, Alumni Network, Student Leadership/Prefect System
- Transport GPS tracking, Hostel module, Asset/Inventory, Helpdesk/Ticketing
- Payroll with attendance-linked deductions, double-entry Ledger reporting depth
- SSO/SAML, High Availability, Custom Enterprise APIs

### ❌ Explicitly Out of Scope for now
- Multi-school/group console (cross-tenant reporting) — confirmed out-of-scope per Master Plan §27 assumption unless separately requested.
- iOS-first mobile parity (Android-first per stack decision; iOS follows).

## 20. MVP Acceptance Criteria

The MVP is considered accepted when, for one pilot school:
1. An Admin can configure the school's academic hierarchy, periods, and one curriculum track without engineering intervention.
2. A Teacher can mark daily/period student attendance and a parent receives an absence alert within the configured delay window.
3. A Teacher can enter exam marks and generate a class set of Report Cards in the school's chosen paper size (A4 or A5) with correct grade calculation.
4. Finance can create a fee structure, issue an invoice, and record a payment that reconciles correctly.
5. A Parent can log into the mobile Personal Portal and see their child's attendance, exam results, and fee status.
6. Every action in items 2–5 produces a correct, queryable audit record.
7. The license-entitlement enforcer correctly blocks a Basic-edition school from accessing a Standard+-only feature in the UI and API alike.
8. All P0 unit/integration tests pass in CI; the E2E smoke suite covering items 2–5 passes in staging.

---
---

# PART E — PROJECT ROADMAP

## 21. Roadmap Overview (Timeline View)

```
Month:        1    2    3    4    5    6    7    8    9   10   11   12   13   14   15
Phase 0  [Arch/ERD/SRS]
Phase 1       [Foundation: Auth/RBAC/Licensing/Audit]
Phase 2            [Academic Core + Promotion]
Phase 3                 [Attendance Engine]
Phase 4                      [Workforce/Leave]
Phase 5                           [Identity/Documents]
Phase 6                                [Finance]
Phase 7                                     [Learning & Collaboration]
Phase 8                                          [Library/Transport/Assets]
Phase 9                                               [Bell/Notice/WhatsApp+Sports+Hostel]
Phase 10                                                   [Facilities Hire + Leadership]
Phase 11                                                        [AI Suite]
Phase 12                                                             [Helpdesk + Reports]
Phase 13                                                                  [Alumni]
Phase 14                                                                       [Mobile full]
Phase 15                                                                            [Hardening/Rollout]
                                                                                          ▲
                                                                              MVP Go-Live ~ End of Phase 6/7
```

*(Illustrative — actual month count depends on team size; §23 gives team-composition assumptions this timeline is based on.)*

## 22. Phase-by-Phase Detail with Duration & Exit Criteria

| Phase | Scope | Est. Duration | Exit Criteria |
|---|---|---|---|
| 0 | Architecture, ERD, SRS sign-off (this document) | 2–3 weeks | Stakeholder sign-off on SRS + ERD; MVP scope locked |
| 1 | Auth, RBAC, Licensing, Audit, Error Logs | 3–4 weeks | FR-PLT-01–08 pass unit+integration tests |
| 2 | Academic Core, Timetable, Promotion | 4–5 weeks | FR-ACA-01–08 pass; pilot school's structure configurable end-to-end |
| 3 | Unified Attendance Engine | 3–4 weeks | FR-ATT-01–04 pass; absence-alert E2E green |
| 4 | Workforce/Leave | 3 weeks | FR-WFM-01–03 pass |
| 5 | Identity & Document Generator | 2–3 weeks | Report Card A4/A5 generation E2E green — **MVP-critical path** |
| 6 | Finance | 3–4 weeks | FR-FIN-01–02 pass; invoice→payment→receipt E2E green — **MVP acceptance criteria 4 met** |
| **— MVP Go-Live Candidate —** | | | **All Part D §20 acceptance criteria met** |
| 7 | Learning & Collaboration | 3–4 weeks | Homework FR-LRN-01–03 pass (async only) |
| 8 | Library, Transport, Assets | 4 weeks | FR-LIB-01, FR-TRP-01 pass |
| 9 | Bell/Noticeboard/WhatsApp + Sports/Events + Hostel | 4–5 weeks | Hardware adapters contract-tested; Sports FR-EVT-01–02 pass |
| 10 | Facilities Hire + School Hall Rental + Retail Concessions (Canteen, BookShop, Settlement) + Student Leadership | 5 weeks | FR-FAC-01–04, FR-RET-01–04, FR-CAN-01–04, FR-BKS-01–03, FR-LDR-01 pass |
| 11 | AI Suite (Timetable, Chatbot, Insights) | 4–5 weeks | FR-AI-01–03 pass, RBAC-scoping security test green |
| 12 | Helpdesk + Reports/Analytics | 3 weeks | FR-HLP-01 pass; cross-domain analytics dashboard live |
| 13 | Alumni Network | 2–3 weeks | FR-ALM-01 pass, consent flow audited |
| 14 | Mobile Ecosystem completion (all modes) | 4–5 weeks | FR-MOB-01–03 fully pass across all 5 modes |
| 15 | Security Hardening, Load Testing, Production Rollout | 3–4 weeks | OWASP scan clean, load test meets NFR-02, production sign-off |

## 23. Team Composition per Phase (indicative)

| Phase Range | Suggested Team |
|---|---|
| Phase 0–1 | 1 Architect/Tech Lead, 2 Backend Engineers, 1 QA/Test Engineer, 1 Product Owner |
| Phase 2–6 (MVP push) | + 2 Frontend Engineers, + 1 Mobile Engineer, + 1 DevOps (part-time) |
| Phase 7–15 | Steady-state team of ~8–10 (Backend x3, Frontend x2, Mobile x1–2, QA x1–2, DevOps x1, Product/PM x1) |

## 24. Milestones & Sign-Off Gates

1. **M1 — SRS & ERD Sign-Off** (end of Phase 0)
2. **M2 — Foundation Complete** (end of Phase 1): license enforcement demonstrably working
3. **M3 — MVP Go-Live** (end of Phase 6): pilot school running attendance → grading → fees → parent portal live
4. **M4 — Fast-Follow Complete** (end of Phase 9): Leave, Homework, ID Cards, Library, WhatsApp live
5. **M5 — Full v5.0 Feature-Complete** (end of Phase 14): every module in Master Plan v5.0 implemented
6. **M6 — Production Hardened Release** (end of Phase 15): security/load sign-off, general availability

---

*End of SRS, Unit Testing Strategy, MVP Definition & Project Roadmap — v1.2*
