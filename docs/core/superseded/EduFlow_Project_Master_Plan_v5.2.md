# EduFlow — School Management System (SMS) / School ERP
## Project Master Plan v5.2 — Full Architecture, Academic Engine, Attendance & Workforce, Learning & Collaboration, Identity/Documents, Facilities Hire, Alumni, Student Leadership, Events, AI, Hardware, UI & Delivery Roadmap

**Document status:** Master Planning v5.2 (Full Consolidated Edition — merges v2.0 baseline + v3.0 Attendance/Workforce/Mobile + v4.0 Learning/Identity/Events/AI/Support + v5.0 Facilities & Sports-Ground Hire, Alumni Network, Student Leadership/Prefect System)
**Architecture style:** Modular Monolith + Clean Architecture + SOLID + OOP + Adapter/Strategy/Extension model
**Deployment model:** Single-tenant, dedicated application/database per school
**Web Stack:** Next.js + React / TypeScript + Tailwind CSS + shadcn/ui (Feature-Level Composition)
**Backend Stack:** NestJS + TypeScript + PostgreSQL + Redis
**Mobile Stack:** React Native + Expo (Android-First, Single Binary, Capability Wizard)
**Licensing & Entitlements:** Serial-Key Activation + Digitally Signed License Certificates + Local Verification Engine
**Primary Objective:** A secure, scalable, configurable school ERP where core domain workflows stay rock-solid, while school-specific behaviors, feature access, hardware connections, attendance/workforce rules, learning delivery, identity/document generation, and events/support workflows are managed via configuration, licensing, and clean interfaces.

> **What's new in v4.0** (on top of v3.0's Attendance Engine, Workforce/Leave, and expanded Mobile): a new **LEARNING & COLLABORATION** domain (Homework/Assignments + Online Classrooms/LMS-lite with Zoom/Google Meet/Jitsi adapters), **Student Promotion & Grade Progression**, an **Identity & Document Generator** (Student/Staff ID cards, Transfer/Bonafide/Character certificates, A4/A5 print templates), **Sports, Events & Extracurricular Activities**, an expanded **Asset & Inventory Management** module, an **AI Chatbot & Virtual Assistant**, a **Helpdesk/Complaints & Ticketing** module, an optional **Hostel/Accommodation** module, and a dedicated **Reports Engine & Student Analytics** layer (by student/class/section/grade/term). All new items are marked `[NEW v4]`; items carried from v3.0 are marked `[v3]` where relevant for traceability.

> **What's new in v5.2:** (1) **School Hall Rental** is now specified in full (§17.6) — enquiry → tentative hold → quote → deposit → confirmation → inspection → settlement, for internal events and for hire to other schools/outside events. (2) New **Retail Concessions** framework (§17.7) covering the **BookShop** (§17.9) and **Canteen** (§17.8): each outlet is either **school-run** or **third-party operated** (concession with rent/commission settlement) — same code, different settlement strategy and permissions. (3) Optional **Student Wallet** (§17.10). (4) Module tree, edition matrix, roadmap, checklist cross-check, and risks updated. Marked `[NEW v5.2]`.

> **What's new in v5.1 (EduFlow rebrand + Basic GL + Multi-language):** a **Facilities & Sports-Ground Booking/Hire module `[NEW v5]`** — managing the Swimming Pool, Football Ground, Basketball & other Courts, the IT Lab, and the School Hall as bookable, schedulable, sometimes externally-hireable resources (with rental invoicing linked to Finance); a **Student Alumni Network `[NEW v5]`** (directory, events, mentorship, giving/fundraising); and a **Student Leadership & Prefect System `[NEW v5]`** (prefect appointment, roles/duties, duty rosters, merit/demerit tracking) that formalizes what was previously only implied inside the general Clubs registry. New items are marked `[NEW v5]`.

---

## Table of Contents

1. Executive Summary & Core Platform Vision
2. Technology Stack & Architectural Principles
3. Product Editions & Feature Entitlement Matrix
4. Serial-Key Licensing & Activation Architecture
5. Core Platform Architecture & System Infrastructure (Full Module Tree)
6. Audit Logging & System Diagnostics Architecture
7. Dynamic Academic Architecture & Multi-Syllabus Engine
8. Unified Attendance Engine `[v3]`
9. Workforce Management: Teacher & Staff Attendance and Leave `[v3]`
10. **Learning & Collaboration: Homework, Assignments & Online Classrooms** `[NEW v4]`
11. **Student Promotion & Grade Progression Engine** `[NEW v4]`
12. **Identity & Document Generator: ID Cards, Certificates, Report Cards (A4/A5)** `[NEW v4]`
13. **Library Management** *(formalized)*
14. **Transport & School Bus Tracking** *(formalized/expanded)*
15. **Hostel / Accommodation Management** `[NEW v4 — optional module]`
16. **Sports, Events & Extracurricular Activities** `[NEW v4]`
17. **Facilities, School Hall Rental & Retail Concessions (BookShop, Canteen)** `[NEW v5 / v5.2]`
18. **Student Alumni Network** `[NEW v5]`
19. **Student Leadership & Prefect System** `[NEW v5]`
20. **Asset & Inventory Management** *(expanded)*
21. **AI Services: Chatbot, Timetable, Insights** *(expanded)*
22. **Helpdesk, Complaints & Support Ticketing** `[NEW v4]`
23. Dynamic Hardware & External Integration Adapters
24. Mobile Ecosystem — Deep Architecture `[v3]`
25. Unified Frontend Architecture & Modular Backend Design
26. **Reports Engine & Student Analytics** `[NEW v4 — expanded]`
27. Non-Functional Requirements & Security
28. Phase-by-Phase Delivery Roadmap `[REVISED v5]`
29. Module Coverage Cross-Check (vs. Standard SMS Feature Checklist) `[REVISED v5]`
30. Open Risks, Assumptions & Recommendations

---

## 1. Executive Summary & Core Platform Vision

The system is a single-tenant, modular School ERP. Each school receives a dedicated database and application instance, with a web application for administration, operational staff, teachers, students, and parents, plus a unified React Native (Expo) mobile application.

```
                                         PLATFORM CORE
    ┌────────────────────────────────────────────────────────────────────────────────┐
    │  Auth │ Dynamic RBAC │ Serial Licensing Engine │ Module Manager │ Audit/Errors  │
    └───────────────────────────────────┬────────────────────────────────────────────┘
                                        │
   ┌─────────────┬──────────────┬───────┼────────┬──────────────┬──────────────┬───────────────┐
   ▼             ▼              ▼       ▼        ▼              ▼              ▼               ▼
ACADEMIC     ATTENDANCE     WORKFORCE FINANCE  LEARNING &   IDENTITY &     LIBRARY /       EVENTS &
Dynamic      Student/       Leave,    Fees,    COLLAB       DOCUMENTS      TRANSPORT /     SPORTS
Stages       Teacher/       Accrual,  Ledger,  Homework,    ID Cards,      HOSTEL /        `[NEW v4]`
Curriculum   Staff          Approval  Payroll  Online Class,Certificates, ASSETS
Promotion    `[v3]`         `[v3]`             LMS-lite     Report Cards
`[NEW v4]`                                     `[NEW v4]`   `[NEW v4]`
   │                                                                                          │
   └──────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               ▼
                          COMMUNICATION │ AI SERVICES (Chatbot/Timetable/Insights) │
                          HELPDESK/TICKETING `[NEW v4]` │ MOBILE │ INTEGRATIONS/HARDWARE
```

The platform is governed by **ten** central architectural pillars (two added in v4.0):

1. Fine-Grained Access Control (RBAC) & Contextual Authorization
2. Dynamic Academic Structure, Syllabus Engine & Promotion `[NEW v4 addition: promotion]`
3. Unified, Multi-Actor Attendance Engine
4. Workforce & Leave Management
5. **Learning & Collaboration Layer (Homework + Virtual Classrooms) `[NEW v4]`** — treats "assignment delivery" and "live/online lesson delivery" as first-class, vendor-agnostic domains rather than bolt-ons.
6. **Identity, Documents & Print Engine `[NEW v4]`** — one templated document-generation service powers ID cards, certificates, and report cards (A4/A5, and custom paper sizes) instead of three separate PDF pipelines.
7. Hardware & Service Vendor Independence via Adapters
8. Single Codebase with Feature-Entitlement Licensing
9. Architectural Reliability, Operational Diagnostics, and Auditing
10. Feature-Level Frontend & Modular Backend Composition

---

## 2. Technology Stack & Architectural Principles

### 2.1 Technology Baseline (updated)

| Subsystem | Technology Choice | Architectural Guidance |
|---|---|---|
| Web Frontend | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui | Feature-based composition; no monolithic pages. |
| Backend API | NestJS, TypeScript, Node.js | Clean Architecture / DDD, strict DI, Controller-Service-Repository. |
| Database | PostgreSQL | FKs, strict constraints, fixed-precision numerics, JSONB for dynamic fields. |
| Cache & Queue | Redis + BullMQ | Sessions, rate limiting, pub/sub, async jobs. |
| Mobile App | React Native + Expo (TypeScript) | Single binary, capability wizard. |
| Object Storage | S3-Compatible (AWS S3, Cloudflare R2, MinIO) | Homework attachments, ID photos, certificate PDFs, video-class recordings metadata. |
| Maps & GPS | Leaflet / React Native Maps + OSM | Vendor-decoupled tiles for bus tracking. |
| Real-Time Layer | WebSockets (Socket.IO) / SSE over Redis Pub/Sub | Live bus tracking, live kiosk feed, **live class-join status `[NEW v4]`**, live helpdesk ticket updates. |
| Background Jobs | BullMQ workers, cron schedulers | Attendance reconciliation, leave accrual, absentee alerts, **assignment-deadline reminders, certificate batch generation `[NEW v4]`**. |
| **Document/Print Engine `[NEW v4]`** | **Headless Chromium (Puppeteer) or a PDF templating library (e.g., PDFKit/Handlebars → PDF) rendering HTML/CSS templates to PDF** | Single templated pipeline for ID cards, certificates, report cards, receipts — paper-size-aware (A4, A5, custom card dimensions, CR80 ID card size). |
| **Video Conferencing Abstraction `[NEW v4]`** | **Adapter layer over Zoom API, Google Meet (via Google Calendar/Workspace API), and self-hosted Jitsi Meet** | Vendor-agnostic `IVideoConferenceAdapter`; school chooses provider per license/config, can mix (e.g., Jitsi for free tier, Zoom for licensed schools). |
| **AI Chat Layer `[NEW v4]`** | **AI Gateway (existing) + Retrieval layer (pgvector or lightweight vector store) for school-specific knowledge (FAQs, policies, fee rules)** | Reuses the existing `AI Gateway & Provider Abstraction Layer`; adds a RAG-lite knowledge base per school. |
| **Internationalization (i18n) `[NEW v5]`** | **next-intl / react-i18next (Web), i18next (Mobile via Expo)** | English (default), Tamil, Sinhala, Arabic at launch; RTL layout support required for Arabic; locale-aware PDF font embedding in the Document/Print Engine (§5.3, §12). |

---

## 3. Product Editions & Feature Entitlement Matrix (updated)

| Feature / Capability | Basic | Standard | Deluxe | Enterprise |
|---|---|---|---|---|
| Core Admin, Students/Parents/Teachers/Staff | Yes | Yes | Yes | Yes |
| Academic Hierarchy, Periods, Curriculum | Yes | Yes | Yes | Yes |
| Student Attendance | Yes | Yes | Yes | Yes |
| Basic Timetable, Exams & Basic Fees | Yes | Yes | Yes | Yes |
| **Homework/Assignments (upload, submit, grade) `[NEW v4]`** | Basic | Yes | Yes | Yes |
| **Student Promotion Engine `[NEW v4]`** | Manual | Semi-Auto | Auto w/ Rules | Auto w/ Rules |
| **Student/Staff ID Card Generator `[NEW v4]`** | Basic Template | Custom Template | Custom + Batch Print | Custom + Batch + Bulk API |
| **Certificate Generator (TC/Bonafide/Character) `[NEW v4]`** | - | Yes | Yes | Yes |
| Teacher/Staff Attendance & Leave Management | Basic/- | Yes | Yes | Yes |
| Substitution Auto-Assignment | - | - | Yes | Yes |
| Advanced Fees, Payroll, Financial Accounting | - | Yes | Yes | Yes |
| WhatsApp / Multi-Channel Alerts | - | Yes | Yes | Yes |
| **Library Management `[FORMALIZED]`** | - | Yes | Yes | Yes |
| **Transport & Bus Tracking (Basic GPS)** | - | Basic | Advanced (Live) | Advanced (Live) |
| **Hostel/Accommodation `[NEW v4]`** | - | - | Add-on | Add-on |
| **Sports & Events Management `[NEW v4]`** | - | Basic | Yes | Yes |
| **Facilities & Sports-Ground Booking `[NEW v5]`** | - | Internal Only | Internal + External Hire | Internal + External Hire |
| **School Hall Rental Pack (deposit, inspection, add-ons) `[NEW v5.2]`** | - | - | Yes | Yes |
| **BookShop & Canteen — School-Run `[NEW v5.2]`** | - | Basic | Yes | Yes |
| **BookShop & Canteen — Third-Party Concession & Settlement `[NEW v5.2]`** | - | - | Yes | Yes |
| **Student Wallet (prepaid, parental limits) `[NEW v5.2]`** | - | - | - | Add-on |
| **Student Alumni Network `[NEW v5]`** | - | - | Directory + Events | Full (incl. Giving/Fundraising) |
| **Student Leadership & Prefect System `[NEW v5]`** | - | Basic | Yes | Yes |
| **Asset & Inventory Management `[EXPANDED]`** | - | Basic | Advanced | Advanced |
| **Online Classrooms (Zoom/Meet/Jitsi) `[NEW v4]`** | - | 1 Provider | Multi-Provider | Multi-Provider + Recording Archive |
| **AI Chatbot (FAQ/Policy Assistant) `[NEW v4]`** | - | - | Yes | Yes |
| AI Timetable Assistant & AI Report Writer | - | - | Yes | Yes |
| **AI Absenteeism/Leave Insights** | - | - | - | Yes |
| **Helpdesk / Complaints & Ticketing `[NEW v4]`** | - | Basic | Advanced (SLA) | Advanced (SLA) |
| Digital Noticeboard, School Bell Engine | - | Yes | Yes | Yes |
| Mobile Applications (all modes incl. Teacher Companion, Staff Self-Service) | - | Yes | Yes | Yes |
| Biometric/RFID Attendance | - | - | Yes | Yes |
| **Reports Engine: A4/A5 Templates, Student Analytics `[NEW v4]`** | Basic | Standard | Advanced | Advanced + Custom Export |
| Hardware & IoT Integrations | - | - | Yes | Yes |
| Custom Integration Adapters & Enterprise APIs | - | - | - | Yes |
| SSO (SAML/OAuth2), HA, Custom Backups | - | - | - | Yes |

---

## 4. Serial-Key Licensing & Activation Architecture

### 4.1 Flow (unchanged from v3.0)
`License Key → Activation Server → Signed Certificate (RSA-2048/ECDSA) → Local Validator → Feature Entitlements Enforcer`

### 4.2 Certificate Payload (extended)

```json
{
  "license_id": "lic_9876543210",
  "product": "EduFlow",
  "edition": "Deluxe",
  "school_id": "sch_om_muscat_01",
  "school_name": "Muscat International Academy",
  "activation_date": "2026-09-01T00:00:00Z",
  "expiry_date": "2027-08-31T23:59:59Z",
  "allowed_modules": [
    "academics", "finance", "attendance", "workforce_leave",
    "learning_collaboration", "identity_documents", "library",
    "transport", "sports_events", "assets", "bookshop", "canteen", "ai_chatbot",
    "helpdesk", "whatsapp", "bell_management", "digital_noticeboard",
    "ai_timetable"
  ],
  "limits": {
    "maximum_students": 1500,
    "maximum_staff": 150,
    "maximum_devices": 10,
    "maximum_mobile_devices": 500,
    "maximum_biometric_terminals": 6,
    "maximum_video_class_concurrent_sessions": 20,
    "maximum_id_cards_per_batch": 2000
  },
  "features": {
    "ai_timetable_assistant": true,
    "ai_chatbot": true,
    "led_matrix_noticeboard": true,
    "custom_curriculum": true,
    "staff_leave_accrual_engine": true,
    "substitution_auto_assignment": true,
    "video_conferencing_provider": "zoom",
    "hostel_module": false,
    "sso_integration": false
  },
  "signature": "MEQCIDX8...[Cryptographic Signature]..."
}
```

### 4.3 Activation (unchanged) + Grace Period (v3.0 retained)

---

## 5. Core Platform Architecture & System Infrastructure (Full Module Tree — v4.0)

```
PLATFORM ARCHITECTURE
│
├── PLATFORM (Core Framework)
│   ├── Authentication (JWT, OTP, Sessions, Token Rotation)
│   ├── Users & Identity Management
│   ├── Dynamic RBAC & Policy Engine
│   ├── License Management & Entitlement Enforcer
│   ├── Dynamic Module Registry
│   ├── System Settings Engine
│   ├── Audit Logging System
│   ├── Error & Diagnostic Logging Engine
│   ├── Multi-Channel Notification Router
│   ├── Document/Print Template Engine `[NEW v4]`
│   ├── Storage & File Manager
│   └── System Health & Monitoring
│
├── ACADEMIC (Educational Domain)
│   ├── Academic Years & Configurable Academic Periods
│   ├── Education Stages (KG1–Grade 13 / Year 1–13)
│   ├── Sections, Classes & Groups
│   ├── Subjects & Resource Allocation
│   ├── Curriculum & Syllabus Engine
│   ├── Student Management & Lifecycles
│   │     └── Student Promotion & Grade Progression Engine `[NEW v4]`
│   ├── Parent & Guardian Management
│   ├── Teacher & Staff Profiling
│   ├── Timetable Management
│   ├── AI Timetable Assistant
│   ├── Examination & Assessment Engine
│   ├── Grading Schemes & Moderation
│   └── Report Card Generator (now via Document/Print Engine)
│
├── ATTENDANCE (Unified Multi-Actor Engine) `[v3]`
│   ├── Attendance Policy & Session Configuration
│   ├── Student / Teacher / Staff Attendance
│   ├── Capture Source Adapters (Manual, QR, Biometric, RFID, Geo-fenced Mobile)
│   ├── Absentee Detection & Auto-Alert Engine
│   └── Attendance Analytics & Regularization Workflow
│
├── WORKFORCE (HR, Leave Management) `[v3]`
│   ├── Leave Types, Accrual & Balance Engine
│   ├── Leave Request & Multi-Level Approval Workflow
│   ├── Substitution / Cover-Teacher Auto-Assignment
│   ├── Holiday & Working-Day Calendar
│   ├── Staff Shift & Duty Roster Management
│   └── HR Document & Contract Vault
│
├── LEARNING & COLLABORATION `[NEW v4 TOP-LEVEL DOMAIN]`
│   ├── Homework & Assignment Engine
│   │     ├── Assignment Creation & Resource Upload
│   │     ├── Student Submission (Text/File/Photo-of-notebook)
│   │     ├── Rubric-Based Evaluation & Feedback
│   │     ├── Deadline & Late-Submission Rules
│   │     └── Assignment Analytics (completion rate, avg. score)
│   ├── Online Classroom / Virtual Lesson Engine
│   │     ├── Video Conference Adapter (Zoom / Google Meet / Jitsi / Custom)
│   │     ├── Class Scheduling (linked to Timetable)
│   │     ├── Attendance-from-Video-Session Bridge (auto-marks attendance on join, subject to teacher confirmation)
│   │     ├── Recording Archive & Access Control
│   │     └── Lesson Resource Sharing (slides, links, files)
│   └── Digital Lesson Plans & Content Library (teacher-authored, reusable)
│
├── IDENTITY & DOCUMENTS `[NEW v4 TOP-LEVEL DOMAIN]`
│   ├── Student ID Card Designer & Generator (batch + single, barcode/QR/RFID-encodable)
│   ├── Staff ID Card Designer & Generator
│   ├── Certificate Generator (Transfer Certificate, Bonafide, Character, Course Completion, Custom)
│   ├── Report Card Template Engine (A4, A5, custom sizes; curriculum-specific layouts)
│   └── Document Template Library & Versioning
│
├── LIBRARY (Media Center Management) `[FORMALIZED]`
│   ├── Catalog & Classification (ISBN/Dewey/Custom)
│   ├── Circulation (Issue/Return/Renew/Reserve)
│   ├── Fines & Damage Tracking
│   ├── Member Management (students, staff)
│   └── Library Reports & Inventory Audit
│
├── TRANSPORT (Bus & Fleet) `[FORMALIZED/EXPANDED]`
│   ├── Vehicle & Driver Registry
│   ├── Routes & Stops
│   ├── Student-to-Route/Stop Allocation
│   ├── Transport Fee Linkage (to Finance)
│   ├── Live GPS Tracking (Deluxe+)
│   └── Boarding/Alighting Attendance (QR/RFID tap, feeds Attendance Engine)
│
├── HOSTEL / ACCOMMODATION `[NEW v4 — optional add-on module]`
│   ├── Hostel/Building & Room/Bed Inventory
│   ├── Student Allocation & Room Change Requests
│   ├── Hostel Attendance (bridges to Unified Attendance Engine)
│   ├── Hostel Fee Linkage (to Finance)
│   └── Visitor Log & Gate Pass Management
│
├── SPORTS, EVENTS & ACTIVITIES `[NEW v4 TOP-LEVEL DOMAIN]`
│   ├── School Event Calendar (Sports Meets, Competitions, Cultural Events)
│   ├── Sports Meet Management (events, heats, scoring, house/team management)
│   ├── Clubs & Extracurricular Activity Registry
│   ├── Student Participation & Achievement Records
│   └── Event Media Gallery (photos/certificates of participation)
│
├── FACILITIES & GROUNDS HIRE `[NEW v5 TOP-LEVEL DOMAIN]`
│   ├── Facility Registry (Swimming Pool, Football Ground, Basketball/other Courts, IT Lab, School Hall)
│   ├── Internal Booking Engine (classes, practices, events; conflict-checked vs. Timetable)
│   ├── External Hire / Rental Workflow (request → approval → rate card → invoice)
│   ├── Supervision & Safety Sign-off (lifeguard, lab technician, etc.)
│   ├── School Hall Rental Pack (enquiry → hold → quote → deposit → inspection → settlement) `[NEW v5.2]`
│   └── Facility Utilization Analytics
│
├── RETAIL & CONCESSIONS `[NEW v5.2 TOP-LEVEL DOMAIN]`
│   ├── Outlet Registry (BookShop, Canteen, extensible) + Operator Model (SCHOOL_RUN | THIRD_PARTY)
│   ├── Concession Contracts, Compliance Documents & Settlement (rent / commission / minimum guarantee)
│   ├── Canteen (menus, allergens, pre-order, meal plans, subsidised meals, hygiene logs)
│   ├── BookShop (grade-wise book sets, pre-order, charge-to-fee-account, returns)
│   ├── Outlet POS (offline-tolerant) — uses the shared stock engine (§20), never a second inventory engine
│   └── Student Wallet (optional add-on)
│
├── ALUMNI NETWORK `[NEW v5 TOP-LEVEL DOMAIN]`
│   ├── Alumni Directory & Profile Conversion (post-graduation, consent-based)
│   ├── Alumni Events & Reunions
│   ├── Mentorship & Career Engagement (school-mediated)
│   └── Giving & Fundraising (optional add-on)
│
├── STUDENT LEADERSHIP & PREFECT SYSTEM `[NEW v5 TOP-LEVEL DOMAIN]`
│   ├── Leadership Role Catalog (Head Boy/Girl, Prefects, House Captains, Council)
│   ├── Nomination & Appointment Workflow
│   ├── Duty Roster Management
│   └── Merit/Conduct Points & Recognition
│
├── FINANCE (Financial & Accounting Engine)
│   ├── Fee Category & Structure Management (incl. Transport/Hostel/Library fines linkage)
│   ├── Student Fee Assignments, Invoicing, Installments
│   ├── Scholarships & Discount Strategy Engine
│   ├── Payment Gateway Adapters & Direct Receipting
│   ├── Double-Entry Chart of Accounts & General Ledger
│   ├── Payroll & Staff Compensation (Attendance/Leave-linked)
│   └── Financial Reporting & Audit Controls
│
├── COMMUNICATION (Messaging Subsystem)
│   ├── Digital Noticeboard System
│   ├── School Announcements Engine
│   ├── Email / SMS / WhatsApp / Push Gateways
│   └── Emergency Alerts Broadcast System
│
├── OPERATIONS (Facilities & Logistics)
│   ├── School Bell Engine & Provider Adapters
│   ├── Asset & Inventory Management `[EXPANDED]`
│   │     ├── Asset Registry (classroom equipment, IT assets, furniture)
│   │     ├── Stock/Consumables Management (stationery, lab supplies)
│   │     ├── Purchase Orders & Supplier Management
│   │     ├── Asset Allocation & Custody Tracking (to staff/room)
│   │     ├── Maintenance Scheduling & Depreciation Tracking
│   │     └── Asset Tagging (QR/Barcode/RFID) reusing Attendance capture hardware pattern
│   ├── Facility & Room Reservation System
│   └── Document Management System (general operational docs)
│
├── SUPPORT (Helpdesk & Complaints) `[NEW v4 TOP-LEVEL DOMAIN]`
│   ├── Ticket Creation (Parent/Student/Staff-initiated)
│   ├── Category Routing (Academic, Finance, IT, Transport, Facilities, Disciplinary)
│   ├── SLA & Escalation Rules
│   ├── Internal Notes vs. Public Replies
│   └── Resolution Analytics & Satisfaction Rating
│
├── MOBILE (Cross-Platform Mobile Ecosystem)
│   ├── Personal Portal Mode (Parent/Student)
│   ├── Bus Tracker Mode (Driver & Parent)
│   ├── Attendance Kiosk Mode
│   ├── Teacher Companion Mode
│   ├── Staff Self-Service Mode
│   └── Device Registration & Security Management
│
├── AI (Artificial Intelligence Services) `[EXPANDED]`
│   ├── AI Gateway & Provider Abstraction Layer
│   ├── AI Timetable Optimization Engine
│   ├── AI Lesson Plan & Quiz Generator
│   ├── AI Report Card Comment Assistant
│   ├── AI Natural Language Query Processor
│   ├── AI Absenteeism & Leave-Pattern Insights
│   ├── **AI Chatbot & Virtual Assistant `[NEW v4]`** (parent/student FAQ, fee-policy Q&A, homework help, ticket triage suggestion)
│   └── Model Usage, Cost & Audit Tracker
│
└── INTEGRATIONS (Hardware & Third-Party Adapters)
    ├── WhatsApp API Adapter
    ├── Biometric & RFID Device Adapters
    ├── Bell Control Hardware Adapters
    ├── SmartBoard & Display Kiosk Adapters
    ├── LED Matrix Hardware Adapters
    ├── Payment Gateway Adapters
    └── Video Conferencing Adapters (Zoom / Google Meet / Jitsi) `[NEW v4]`
```

---

### 5.2 Basic General Ledger (GL) Design `[NEW]`

> Finance in the module tree above lists "Double-Entry Chart of Accounts & General Ledger" — this subsection makes that concrete enough to build against.

**Core GL entities:**
- **Chart of Accounts (CoA):** hierarchical account list (Assets, Liabilities, Equity, Income, Expense), each account typed and school-configurable, with a sensible default CoA pre-seeded on school setup (e.g., `1000 Assets → 1010 Cash, 1020 Bank`, `4000 Income → 4010 Tuition Fees, 4020 Transport Fees, 4030 Facility Hire Income`, `5000 Expense → 5010 Salaries, 5020 Utilities`).
- **Journal Entry:** every financial transaction in the system (fee payment, invoice, expense, payroll run, refund, facility-hire invoice, library fine) posts as a **balanced double-entry journal entry** (total debits = total credits), generated automatically by the originating module — no manual journal entry required for routine transactions, though manual journal entries are supported for adjustments (audited, per §6.1).
- **Ledger Posting Rule Engine:** each transaction type maps to a fixed debit/credit rule (e.g., "Fee Payment Received" → Debit Cash/Bank, Credit Tuition Fee Income) — configurable per school's CoA mapping, implemented as an `ILedgerPostingRule` per transaction type so new income/expense sources (e.g., Facility Hire, §17) plug in without touching core ledger code.
- **Core Reports (Basic GL scope for MVP+1):** Trial Balance, General Ledger (by account, date-filtered), Income & Expenditure Statement, and a simple Balance Sheet. Full Financial Reporting & Audit Controls (multi-branch consolidation, budgeting) remain a later-phase enhancement beyond this basic GL.
- **Period Close:** a configurable monthly/termly "soft close" that flags a period as reconciled (warns, but does not hard-block, on backdated postings into a closed period — hard-lock is a later-phase control for Enterprise).

```
Originating Module (Fees / Payroll / Facility Hire / Library Fine / Manual Adjustment)
        │
        ▼
  Ledger Posting Rule Engine  →  Journal Entry (auto-balanced) → General Ledger
        │
        ▼
  Trial Balance / Income & Expenditure / Balance Sheet (basic GL reports)
```

### 5.3 Multi-Language Support (i18n) `[NEW]`

- **Supported languages at launch:** **English (default)**, **Tamil**, **Sinhala**, **Arabic**.
- **Architecture:** all user-facing strings (Web, Mobile, and generated documents/certificates/report cards §12) are externalized into locale resource files (e.g., `en.json`, `ta.json`, `si.json`, `ar.json`); no hard-coded UI strings in components.
- **RTL support:** Arabic requires right-to-left layout — the frontend must support a global `dir="rtl"` mode (mirrored layout: sidebar, form alignment, icons) alongside the `dir="ltr"` languages (English/Tamil/Sinhala).
- **Per-user language preference:** stored on the `User` profile, selectable at login or from settings; defaults to the school's configured default language for new users.
- **Document generation (§12) is locale-aware:** a Report Card or Certificate can render in the recipient's/school's chosen language, including correct font support for Tamil, Sinhala, and Arabic scripts in the PDF rendering pipeline (§2.1 Document/Print Engine — font embedding must be verified per script, not assumed from a default Latin font stack).
- **Out of scope for v1 of i18n:** machine-translated dynamic content (e.g., free-text teacher remarks) — only system UI strings and templated document labels are translated; user-entered free text displays as entered.

---

## 6. Audit Logging & System Diagnostics Architecture

Unchanged from v3.0 (§6), with additional audited actions: `ASSIGNMENT_GRADED`, `VIDEO_CLASS_STARTED/ENDED`, `ID_CARD_ISSUED`, `CERTIFICATE_ISSUED`, `STUDENT_PROMOTED/RETAINED`, `ASSET_ALLOCATED/TRANSFERRED`, `HOSTEL_ROOM_REASSIGNED`, `TICKET_ESCALATED`.

---

## 7. Dynamic Academic Architecture & Multi-Syllabus Engine

Unchanged core design from v2.0/v3.0 (Education Stage → Grade/Year → Section → Subject → Curriculum Assignment; configurable Annual/Semester/Trimester/Quarter periods; multi-track curriculum). See §11 below for the new **Promotion Engine**, which is the natural extension of this hierarchy (moving a student from one Grade/Year node to the next).

---

## 8. Unified Attendance Engine `[v3 — retained]`

Student/Teacher/Staff attendance under one actor-agnostic model, pluggable capture adapters, absentee auto-alerts, regularization workflow. *(Full detail unchanged from v3.0 §8.)* `[NEW v4 bridge]` — Transport boarding/alighting taps and Hostel check-ins now also write into this same engine as additional attendance *contexts* (not new actor types), so a student's "attendance" view can show classroom presence, bus boarding, and hostel curfew check-in side by side.

---

## 9. Workforce Management: Teacher & Staff Attendance and Leave `[v3 — retained]`

Leave types, accrual engine, multi-level approvals, substitution auto-assignment, shift rosters, payroll linkage. *(Full detail unchanged from v3.0 §9.)*

---

## 10. Learning & Collaboration: Homework, Assignments & Online Classrooms `[NEW v4]`

### 10.1 Homework & Assignment Engine

- **Creation:** Teacher creates an assignment scoped to Class/Section/Subject (or individual students for differentiated work), with instructions, attached resources (PDF/image/video link), due date/time, and grading rubric.
- **Submission:** Students submit via Web or Mobile — text entry, file upload, or **photo-of-notebook capture** (common need for handwritten work in lower grades), with resubmission allowed until the deadline (configurable).
- **Late-Submission Rules:** configurable grace window, automatic late-flag, optional score penalty curve.
- **Evaluation:** Teacher grades inline (score + written/audio feedback), rubric-based scoring optional; grades can optionally feed into the continuous-assessment component of the Examination & Grading module.
- **Notifications:** New assignment, due-date-approaching reminder (24h/2h configurable), and grade-published alerts — routed through the Multi-Channel Notification Router.
- **Assignment Analytics:** per-class completion rate, average score, late-submission rate, and a per-student "missing work" tracker visible to homeroom teacher and parent.

```typescript
export interface IAssignmentSubmissionAdapter {
  submit(assignmentId: string, studentId: string, payload: SubmissionPayloadDTO): Promise<SubmissionDTO>;
  evaluate(submissionId: string, evaluatorId: string, score: number, feedback?: string): Promise<void>;
  getSubmissionStatus(assignmentId: string, classId: string): Promise<SubmissionStatusSummaryDTO>;
}
```

### 10.2 Online Classroom / Virtual Lesson Engine

- **Vendor-agnostic design:** a school can plug in **Zoom**, **Google Meet** (via Google Workspace Calendar/Meet API), or a **self-hosted open-source option (Jitsi Meet)** — selectable per license/config, and even mixed (e.g., Jitsi for free-tier schools, Zoom/Meet for schools with existing subscriptions).

```typescript
export interface IVideoConferenceAdapter {
  createSession(classId: string, subjectId: string, scheduledAt: Date, durationMinutes: number): Promise<VideoSessionDTO>;
  getJoinLink(sessionId: string, userId: string, role: 'HOST' | 'PARTICIPANT'): Promise<string>;
  endSession(sessionId: string): Promise<void>;
  getAttendanceLog(sessionId: string): Promise<ParticipantLogDTO[]>;
  getRecordingUrl(sessionId: string): Promise<string | null>;
}
```

- **Scheduling:** Online classes are scheduled as a special Timetable entry type ("Virtual Period"), so they appear in the same student/teacher/parent timetable views as physical classes — no separate calendar to maintain.
- **Attendance Bridge:** join/leave events reported by the video adapter are ingested into the Unified Attendance Engine as a `VIDEO_SESSION` capture source, with the teacher able to confirm/override before it's finalized (prevents "joined and left immediately" from counting as present).
- **Recording Archive:** optional per-provider recording storage with access control (only enrolled students/parents + teacher can view), retention policy configurable (e.g., auto-delete after 90 days) for storage cost control.
- **Resource Sharing:** slides/links/files attached to a virtual session are automatically also visible in the Digital Lesson Plans & Content Library for later reference.
- **`[NEW idea]` Low-bandwidth fallback:** if a student's connection can't sustain video, the platform surfaces the lesson recording + slides + homework link as an asynchronous fallback path, so remote/rural students aren't fully excluded.

### 10.3 Digital Lesson Plans & Content Library

- Teachers author reusable lesson plans (objectives, resources, linked curriculum outcome), taggable by Subject/Grade/Curriculum-track, shareable within the department (permission-gated).
- AI Lesson Plan Generator (existing AI module) can draft a first version for teacher review — never auto-published without teacher edit/approval, consistent with the platform's human-in-the-loop principle for AI outputs.

---

## 11. Student Promotion & Grade Progression Engine `[NEW v4]`

- **Purpose:** move students from one Grade/Year to the next at year-end (or mid-year for transfers), based on configurable rules, without manual re-entry of enrollment records.
- **Promotion Rule Types** (configurable per curriculum/track):
  - **Automatic:** all students in Grade N move to Grade N+1 (common in early years).
  - **Criteria-Based:** minimum overall grade/percentage, minimum attendance %, no outstanding disciplinary hold, no outstanding fee balance (configurable whether fee dues block promotion).
  - **Manual Review Required:** flagged borderline students routed to a promotion-committee review queue.
- **Workflow:**
  1. End-of-year snapshot pulls final grades (Examination module), attendance % (Attendance Engine), and fee status (Finance).
  2. Rule engine classifies each student: **Promote / Retain / Review Required**.
  3. Academic Coordinator/Principal reviews the "Review Required" and "Retain" lists, can override with mandatory reason (audited).
  4. On approval, the system bulk-creates next-year enrollment records, preserving full student history (previous-year records remain queryable, never overwritten — see §5 Student History).
- **Section Reallocation:** optional auto-balancing of new sections (e.g., keep class sizes even) or manual drag-and-drop section assignment tool.
- **Outputs:** Promotion Letters/Notices to parents (via the Identity & Document Generator, §12), updated ID cards if grade/section is printed on the card, updated transport-route eligibility check.
- **Mid-Year Transfers:** same engine handles a single-student promotion/transfer between sections or grades outside the annual cycle, with full audit trail and Transfer Certificate generation if the student is leaving the school entirely.

---

## 12. Identity & Document Generator: ID Cards, Certificates, Report Cards `[NEW v4]`

> **Design rationale:** ID cards, certificates, and report cards are all "structured data → styled template → printable PDF." v4.0 introduces **one Document/Print Template Engine** (§5 Platform module) that all three features share, instead of three separate rendering pipelines — reducing duplicate work and giving schools a consistent template-editing experience.

### 12.1 Student & Staff ID Card Designer & Generator

- **Template Designer:** drag-and-drop layout editor (school logo, photo, name, ID/roll number, class/section or department/designation, barcode/QR/RFID-encodable identifier, validity date, emergency contact strip).
- **Card sizes:** standard CR80 ID card, plus custom dimensions.
- **Batch generation:** generate/print an entire class, entire staff roster, or a single reprint (e.g., lost card), with a print-ready multi-up PDF layout for card printers or standard printer + laminator workflows.
- **Encoding:** QR/barcode on the card can double as the **Attendance capture identifier** (§8), unifying "ID card" and "attendance card" into one artifact — no separate RFID enrollment needed if QR-based capture is used.
- **Lifecycle:** issue date, expiry/revalidation date, deactivation on student/staff exit (auto-revokes the card's use as an attendance/access credential).

### 12.2 Certificate Generator

- Configurable certificate types out of the box: **Transfer Certificate (TC)**, **Bonafide Certificate**, **Character Certificate**, **Course/Grade Completion Certificate**, plus a **Custom Certificate Builder** for school-specific needs (sports participation, honor roll, etc.).
- Merge-field templating (student name, DOB, admission number, class, dates, principal signature image, school seal image) with jurisdiction-specific legal-wording templates where applicable.
- Approval workflow before issuance (e.g., TC requires Principal e-sign-off + confirmation that fee/library/asset dues are cleared — cross-checks Finance and Library modules automatically).
- Full issuance ledger (who, when, for what reason) for compliance/audit.

### 12.3 Report Card Template Engine — A4 / A5 & Custom Layouts

- **Paper-size-aware templates:** A4 (standard full-page), A5 (compact/booklet style), and custom sizes, selectable per curriculum track or school preference.
- **Layout variants:** grade-table style, narrative/descriptive style (common in early-years/IB), rubric-based style, or a hybrid — each curriculum track (§7) can bind to its own report-card layout.
- **Content blocks:** subject-wise marks/grades, attendance % (pulled live from the Attendance Engine), teacher/homeroom remarks (optionally AI-drafted via the AI Report Card Comment Assistant, teacher-approved), co-curricular/sports participation (pulled from §16), conduct/behavior notes, promotion status (pulled from §11).
- **Batch & single generation**, watermarking/security-seal option, digital signature support for e-report-cards distributed via Parent Portal.

### 12.4 Document Template Library & Versioning

- All templates (ID card, certificate, report card, receipts, promotion letters) are versioned; a template change doesn't retroactively alter already-issued documents (each issued document stores a snapshot reference to the template version used) — important for audit and reprint consistency.

---

## 13. Library Management *(formalized from v2.0 mention)*

- **Catalog:** ISBN lookup/auto-fill, Dewey or custom classification, multiple copies per title, digital-resource entries (e-books/links) alongside physical stock.
- **Circulation:** issue/return/renew, reservation queue, due-date reminders (via Notification Router), overdue fine calculation (configurable rate), damage/lost-book charge workflow (feeds Finance as a fine/fee item).
- **Members:** students and staff, borrowing-limit rules per role/grade.
- **Reports:** most-borrowed titles, overdue list, inventory shrinkage/audit report.
- **`[NEW v4 idea]` Barcode/QR reuse:** the same ID-card QR/barcode (§12.1) is used as the library card, again avoiding duplicate credential issuance.

---

## 14. Transport & School Bus Tracking *(formalized/expanded from v2.0)*

- **Registry:** vehicles, drivers (with license/document expiry reminders, linked to HR Document Vault §9.7), routes, stops.
- **Allocation:** student-to-route/stop assignment, capacity checks per vehicle.
- **Fees:** transport-fee plans linked to Finance, prorated for mid-term route changes.
- **Live GPS Tracking (Deluxe+):** real-time map view for parents/admin (Mobile Bus Tracker Mode, §24), ETA calculation, geofenced stop-arrival alerts.
- **Boarding/Alighting Attendance:** driver-side QR/RFID tap at pickup/drop-off feeds the Unified Attendance Engine as a `TRANSPORT` context — parents get a "child boarded bus" / "child reached school" notification automatically.
- **`[NEW v4]` Incident/SOS:** driver app has an emergency button broadcasting location + alert to Transport Admin and Emergency Alert system.
- **`[NEW v4]` Route Optimization (optional AI-assisted):** suggests stop ordering to minimize total route time given current student addresses — proposal only, human-approved before publishing (same human-in-the-loop principle as AI Timetable).

---

## 15. Hostel / Accommodation Management `[NEW v4 — optional add-on module]`

*(Included per the reference checklist; scoped as an optional, separately licensed module since not all schools operate hostels.)*

- **Inventory:** buildings/hostels → rooms → beds, capacity and gender/floor rules.
- **Allocation:** student room/bed assignment, room-change request workflow with warden approval.
- **Attendance:** evening roll-call / curfew check-in feeds the Unified Attendance Engine as a `HOSTEL` context, with absconding/late-return alerts to warden + parent.
- **Fees:** hostel fee plans linked to Finance (termly/annual).
- **Visitor & Gate Pass Management:** visitor log with ID capture, outing/leave-pass approval workflow (reuses the Leave/Approval workflow pattern from §9.3, generalized to a `IApprovalWorkflow` used by both Staff Leave and Hostel Gate Passes).

---

## 16. Sports, Events & Extracurricular Activities `[NEW v4]`

### 16.1 School Event Calendar
- Unified calendar (shared with Attendance/Leave/Timetable per §7.2) covering Sports Meets, Competitions, Cultural Events, PTA meetings, exam dates — filterable by audience.

### 16.2 Sports Meet Management
- **Event/Heat Setup:** define events (track & field, team sports), age-group categories, heats/rounds.
- **House/Team Management:** house allocation for students (e.g., Red/Blue/Green/Yellow houses), team roster builder.
- **Scoring & Results:** live or post-event score entry, automatic point-tally and leaderboard per house/team, printable results sheet (via the Document/Print Engine, A4/A5).
- **`[NEW idea]` Live scoreboard display:** results can be pushed to the Digital Noticeboard (§23.2) for real-time display during the event.

### 16.3 Clubs & Extracurricular Activity Registry
- Club catalog (Robotics, Debate, Music, etc.), enrollment/capacity limits, attendance for club sessions (bridges to Unified Attendance Engine as an `ACTIVITY` context), supervising-teacher assignment.

### 16.4 Student Participation & Achievement Records
- Per-student achievement ledger (events participated, positions won, certificates earned) — feeds the co-curricular section of the Report Card (§12.3) and Student Analytics (§26).

### 16.5 Event Media Gallery
- Photo/video gallery per event, access-controlled (parents of participating students, or school-public per admin setting), with participation-certificate auto-generation via §12.2.

---

## 17. Facilities, School Hall Rental & Retail Concessions (BookShop, Canteen) `[NEW v5 / v5.2]`

> **Design rationale:** Sports/recreation facilities (Swimming Pool, Football Ground, Basketball & other Courts) and academic-support facilities (IT Lab, School Hall) share the same underlying need: a **bookable, schedulable resource** with capacity/time-slot rules, an internal booking calendar for school use, and — for many schools — the ability to **hire the facility out to external parties** (community sports clubs, other schools, private events) for additional revenue. v5.0 introduces one generalized **Facility Booking Engine** reused by every physical resource, rather than a bespoke booking flow per facility type.

### 17.1 Facility Registry
- Each facility (Swimming Pool, Football Ground, Basketball Court, Tennis/Volleyball/other Courts, IT Lab, School Hall, and any other bookable space) is registered with: capacity, operating hours, maintenance-closure calendar, required supervision (e.g., lifeguard for pool, IT technician for lab), and hire rate card (if externally hireable).
- Reuses the **Facility & Room Reservation System** already present under Operations (§5) as its foundation — this section formalizes and extends it into a full booking + hire product rather than a simple internal room-booking tool.

### 17.2 Internal Booking (School Use)
- Teachers/Coaches/Departments book a facility for a class period, practice session, or event (e.g., PE class books the Football Ground; Computer Science books the IT Lab; Assembly books the School Hall).
- Conflict detection against the Timetable (§7) and against other bookings/maintenance windows for the same facility.
- Recurring bookings (e.g., "Basketball Court, every Tuesday 3–4pm, Term 1") supported via the same recurrence pattern used by the Bell Engine's schedule variations (§23 Hardware Adapters).

### 17.3 External Hire / Rental Management
- **Hire Request:** external parties (or parents/community groups) submit a booking request for a facility (e.g., "Swimming Pool, Saturday 6–8am, private swim club") through a public-facing or invite-only booking portal.
- **Approval Workflow:** routed to the Facility Manager/Admin for approval — reuses the same generalized `IApprovalWorkflow` pattern already used for Leave (§9.3) and Hostel Gate Passes (§15).
- **Rate Cards & Invoicing:** per-hour/per-session hire rates (configurable per facility, peak/off-peak pricing optional), auto-generates an invoice/receipt through the Finance module (§5) — this is external, non-student revenue, tracked as its own income category in the General Ledger for clean financial reporting.
- **Supervision & Safety Sign-off:** facilities requiring supervision (pool lifeguard, lab technician) block confirmation until a qualified staff member is assigned to the slot — cross-checks Staff Attendance/Roster (§9.6) for availability.
- **Liability/Waiver Documents:** optional digital waiver/consent capture for external hirers, generated via the Document/Print Engine (§12) and stored against the booking record.

### 17.4 Facility Utilization Analytics
- Occupancy/utilization rate per facility, internal-vs-external usage split, hire revenue trend — feeds the Reports Engine (§26).

### 17.5 Facility Booking Adapter Interface
```typescript
export interface IFacilityBookingAdapter {
  checkAvailability(facilityId: string, start: Date, end: Date): Promise<boolean>;
  createBooking(facilityId: string, requesterId: string, start: Date, end: Date, type: 'INTERNAL' | 'EXTERNAL_HIRE'): Promise<FacilityBookingDTO>;
  approveBooking(bookingId: string, approverId: string): Promise<void>;
  generateInvoice(bookingId: string): Promise<InvoiceDTO>;
}
```

---

### 17.6 School Hall — Internal Use & Rental to Other Schools / Events `[NEW v5.2]`

The School Hall is a facility on the shared Facility Booking Engine (§17.1–17.5) with a richer rental pack. It is never a separate booking system.

- **Hall profile:** capacity per layout (theatre, banquet, exam, classroom), equipment inventory (sound, projector, stage lighting, chairs/tables), operating hours, setup/teardown buffers, and utility-metering (optional).
- **Use types:** `INTERNAL` (assembly, exams, PTA, graduation, rehearsals) and `EXTERNAL_HIRE` (other schools, exam boards, community/private events).
- **Booking lifecycle:** Enquiry (public form) → **Tentative hold** (auto-expires) → **Quote** (rate card + add-ons + buffers + overtime) → **Deposit** → Confirmation → Pre-event inspection checklist → Event → Post-event inspection (photos) → **Settlement** (invoice, deposit refund or damage deduction).
- **Priority rules:** confirmed bookings are never displaced silently; an internal academic event may pre-empt only a *tentative* external hold. Displacing a confirmed booking requires Admin override, a reason, and an audit record (§6.1).
- **Add-ons:** sound/lighting technician, cleaning, security, extra seating, and **catering** — a catering add-on creates an order in the Canteen outlet (§17.8) if the outlet's operator allows event catering.
- **Documents:** hire agreement, waiver, and insurance certificate (with expiry) via the Document/Print Engine (§12); external hirers remain lightweight contacts, not full user accounts.
- **Finance/GL:** hire income posts to *Facility Hire Income*; damage deposits post to a *Deposits Held* liability account and are released on settlement — all via `ILedgerPostingRule` (§5.2).
- **Approval:** reuses the shared `IApprovalWorkflow`; notifications via the Notification Router.

### 17.7 Retail Concessions Framework (BookShop & Canteen) `[NEW v5.2]`

BookShop and Canteen may be **run by the school** or **operated by a third party** (concessionaire), and the operator can change over time. The design therefore treats each shop as an **Outlet** whose *operator model is data, not code*.

- **Outlet entity:** `type` (BOOKSHOP, CANTEEN, extensible e.g. UNIFORM_SHOP), `operator_model` (`SCHOOL_RUN | THIRD_PARTY`) with effective dates, location, opening hours, active flag.
- **One engine for both models.** Catalog, stock, POS, pricing, and reporting are identical; the differences are (a) the **settlement strategy** and (b) **who may see/do what** (RBAC scope).

```typescript
export interface IConcessionSettlementStrategy {
  // SCHOOL_RUN: gross sales + COGS post to school GL.
  // THIRD_PARTY: only rent/commission/minimum-guarantee posts to school GL; gross sales are the vendor's.
  calculateSettlement(outletId: string, period: DateRange): Promise<SettlementStatementDTO>;
  toLedgerEntries(statement: SettlementStatementDTO): JournalEntryDraft[];
}
```

| Aspect | SCHOOL_RUN | THIRD_PARTY (concession) |
|---|---|---|
| Stock ownership | School (shared stock engine, §20) | Vendor's stock; school sees sales only |
| GL impact | Sales revenue + COGS | Rent / commission income only |
| Suppliers & POs | School POs (auto-generated POs are drafts; human approves) | Vendor's own |
| Staff | School staff roles | Restricted *Vendor* role, scoped to that outlet only |
| Contract | — | Term, rent or commission %, minimum guarantee, security deposit, price-cap/menu-approval rules |
| Compliance | Internal checklists | Vendor documents with expiry alerts (business registration, food-hygiene licence, staff health certificates, insurance) |
| Settlement | Month-end sales report | Auto-generated monthly settlement statement/invoice from recorded sales |
| Disputes | Helpdesk (§22) | Helpdesk (§22) with immutable sales log as evidence |

- **Data minimisation for third parties:** vendors receive a student token/ID and only the flags required to serve them (e.g. allergy alerts, wallet balance decision) — never full student profiles or unrelated data.
- **Outlet POS:** tablet/web POS, ID-card QR scan (§12.1), **offline-tolerant** (queue and sync, same pattern as the Attendance Kiosk §24), receipts via the Document Engine.
- **Reuse, don't fork:** stock uses the shared Asset/Inventory stock engine (§20) with ledger-style movements; payments use the existing Payment Gateway Adapters; tax/currency come from School Settings and adapters.

### 17.8 Canteen `[NEW v5.2]`

- **Menu management:** categories, items, price, availability by day/meal period, **allergen and dietary tags** (halal/vegetarian/nut-free etc.), optional nutrition info; daily menu published to the mobile app and Digital Noticeboard (§23.2).
- **Allergy safety:** allergy/dietary flags entered by parents on the student profile surface at the POS on scan; blocked items require an explicit staff override that is logged. The system supports but never guarantees allergen safety — see Risks.
- **Pre-order & pickup slots:** parents/students pre-order for break/lunch to cut queues; pickup by ID-card QR.
- **Meal plans & subscriptions:** daily/weekly/termly plans billed via Finance or Wallet.
- **Subsidised/free meals:** link to scholarship/concession rules; the subsidy amount posts to GL as a school expense.
- **Staff pricing** and **event catering** (from §17.6) supported.
- **School-run extras:** ingredient stock, wastage logging, supplier POs (draft-only automation), recipe costing (optional).
- **Hygiene & safety logs:** daily cleaning/temperature checklists with timestamps and sign-off (audited) — applies to both operator models.
- **Reports:** sales by item/period, peak times, wastage, subsidy utilisation, vendor settlement.

### 17.9 BookShop `[NEW v5.2]`

- **Catalog:** textbooks, workbooks, stationery, exam materials, optional uniforms; ISBN/SKU, variants (size), multiple suppliers.
- **Grade-wise book sets:** bundles per Grade/Year and **curriculum track** (linked to the Curriculum Engine §7.3), so a parent buys "Grade 7 – Cambridge track" in one action.
- **Pre-order for the new academic year:** after the Promotion Engine (§11) finalises next-year placement, parents receive the relevant book list and can pre-order for collection.
- **Payment choices:** pay now (gateway/wallet/cash) or **charge to the student's fee account** (adds a line to the student invoice via Finance).
- **Returns/exchanges** with reason capture and stock reinstatement; **reservations** for out-of-stock items.
- **Stock & reorder:** low-stock alerts; auto-generated purchase orders are drafts only (school-run).
- **Reports:** sales by grade/title, sell-through per academic year, outstanding pre-orders, vendor settlement (third-party).
- **Optional idea:** second-hand textbook exchange board (school-moderated).

### 17.10 Student Wallet (optional add-on) `[NEW v5.2]`

- Prepaid balance funded by parents through the payment adapters; spent at Canteen/BookShop via ID-card QR.
- **Parental controls:** daily spend limit, blocked categories/items, low-balance alerts.
- **GL treatment:** wallet balances are a **liability** account; spending moves value to sales/settlement accounts; refunds on student exit go through an approval workflow and are audited.
- Stored-value rules vary by jurisdiction — keep this module optional and subject to legal review (see Risks).

---

## 18. Student Alumni Network `[NEW v5]`

### 18.1 Alumni Directory & Profiles
- On graduation/exit, a student record can be converted (with consent) into an **Alumni Profile** — preserving academic history (read-only, from Student History §5) while adding post-school fields: current occupation, higher-education institution, contact/social links, privacy preferences (opt-in visibility controls, since alumni are no longer minors under school custodial care once they leave).
- Searchable/filterable directory (by graduation year, program/curriculum track, location) for alumni networking, visible per each alumnus's own privacy setting.

### 18.2 Alumni Events & Engagement
- Reunion and alumni-event management, reusing the School Event Calendar (§16.1) as a shared calendar layer.
- RSVP tracking, event-specific communication via the Multi-Channel Notification Router (§5 Communication), scoped to an "Alumni" audience segment.

### 18.3 Mentorship & Career Engagement
- Optional alumni-to-student mentorship matching (by field of interest/career path), moderated by school staff (never unsupervised direct alumni-minor contact — school-mediated introductions/communication channel only, consistent with child-safety-conscious design).
- Alumni guest-speaker/career-day scheduling, linked into the Sports/Events module (§16) as a special event category.

### 18.4 Giving & Fundraising *(optional add-on, Enterprise)*
- Donation/fundraising campaign tracking (scholarship funds, facility upgrades — can directly reference the Facility Hire module §17 for "sponsor a court" style campaigns), receipt generation via the Document/Print Engine, and integration with the same Payment Gateway Adapters used by Fee Collection (§5 Finance).
- Donor acknowledgment and giving-history reports, kept as a distinct income category from tuition/fees for clean audit separation.

### 18.5 Data & Consent Considerations
- Alumni data handling is governed by explicit opt-in consent captured at/after graduation; alumni can request removal from the directory at any time (self-service via a dedicated Alumni Portal login, reusing the Personal Portal Mode architecture, §24).

---

## 19. Student Leadership & Prefect System `[NEW v5]`

> **Design rationale:** Many schools run a formal student-leadership structure (Head Boy/Head Girl, Prefects, House Captains, Class Monitors, Student Council) that is distinct from the general Clubs registry (§16.3) — it involves an appointment/selection process, defined duties/rosters, and often a merit/demerit or conduct-points system. v5.0 gives this its own lightweight module rather than overloading the Clubs feature.

### 19.1 Leadership Roles & Structure
- Configurable role catalog (Head Boy/Girl, Deputy, House Captain, Prefect, Class Monitor, Student Council Member, custom roles per school tradition), each with a defined scope (school-wide, house-level, class-level).

### 19.2 Appointment / Selection Workflow
- Nomination (self-nominate, teacher-nominate, or peer-vote depending on school policy), review, and appointment approval by staff — reuses the generalized `IApprovalWorkflow` pattern (as in §9.3, §15, §17.3).
- Term-of-office tracking (e.g., one academic year), automatic role expiry/renewal prompt at year-end, integrating with the Promotion Engine's year-end cycle (§11).

### 19.3 Duties & Roster Management
- Duty roster builder (e.g., gate duty, hallway supervision, assembly leading, canteen supervision) with recurring schedule patterns, reusing the same rostering pattern as Staff Shift & Duty Rosters (§9.6).
- Duty-completion / attendance-for-duty logging, feeding into the student's participation record (shared with §16.4).

### 19.4 Merit / Conduct Points *(optional)*
- Configurable merit/demerit point system tied to leadership duty performance and general conduct, visible to homeroom teacher and (summarized) to parents — feeds the "conduct/behavior notes" block of the Report Card (§12.3).

### 19.5 Recognition
- Leadership badges/insignia noted on the Student ID Card (§12.1, optional template field) and on the Report Card's co-curricular section; leadership-completion certificates issuable via the Certificate Generator (§12.2).

---

## 20. Asset & Inventory Management *(expanded from v2.0's brief mention)*

- **Asset Registry:** classroom equipment, IT assets (laptops/projectors), furniture, lab equipment — each with tag ID, purchase date, value, warranty/AMC expiry.
- **Stock/Consumables:** stationery, lab supplies, cleaning supplies — reorder-level alerts, consumption tracking per department.
- **Purchase Orders & Suppliers:** PO creation, supplier registry, goods-received matching, linked to Finance for expense recording.
- **Asset Allocation & Custody:** assign an asset to a staff member or room, transfer-of-custody workflow with acknowledgment, loss/damage reporting.
- **Maintenance & Depreciation:** scheduled maintenance reminders, configurable depreciation method for financial reporting.
- **Tagging:** QR/Barcode/RFID tags — **reuses the same `IAttendanceCaptureAdapter`-style device fleet** used for attendance/library/ID where practical, minimizing distinct hardware SKUs the school must buy.

---

## 21. AI Services: Chatbot, Timetable, Insights *(expanded)*

### 18.1 AI Chatbot & Virtual Assistant `[NEW v4]`

- **Audience-aware assistant** embedded in Parent Portal, Student Portal, and (internally) Staff/Admin views, answering natural-language questions such as "What's my child's attendance this month?", "When is the next fee due?", "What's the homework for today?", or "What's the school's uniform policy?"
- **Architecture:**
  - Reuses the existing **AI Gateway & Provider Abstraction Layer** (provider-agnostic: OpenAI/Anthropic/local model, configurable per license).
  - Adds a lightweight **Retrieval layer** (school policy documents, FAQs, fee-rule text) so answers to "policy" questions are grounded in the school's own documents rather than hallucinated.
  - For **data questions** (attendance, homework, fees), the chatbot calls the same internal APIs the portals use (respecting the asking user's RBAC scope — a parent's chatbot session can only ever query that parent's own children's data).
- **Guardrails:** no chatbot response can perform a write action (submit a leave request, make a payment) without explicit user confirmation through the normal UI flow — the chatbot **assists and navigates**, it does not silently act.
- **Staff-facing mode:** can help admin staff quickly query "how many students are absent today in Grade 8?" as a natural-language front-end to Reports/Analytics (§26).
- **Escalation:** if the chatbot can't answer confidently, it offers to open a Helpdesk ticket (§22) pre-filled with the conversation context.

### 18.2 AI Timetable Optimization Engine *(retained from v3.0, now also feeds §10.2 virtual-period scheduling and §9.5 substitution)*

### 18.3 AI Lesson Plan & Quiz Generator *(retained; now also seeds the Digital Lesson Plan Library, §10.3)*

### 18.4 AI Report Card Comment Assistant *(retained; drafts remarks for §12.3, teacher-approved before publishing)*

### 18.5 AI Absenteeism & Leave-Pattern Insights *(retained from v3.0)*

### 18.6 Model Usage, Cost & Audit Tracker *(retained; now tracks chatbot token usage per school for cost-control/license-limit enforcement)*

---

## 22. Helpdesk, Complaints & Support Ticketing `[NEW v4]`

- **Ticket Creation:** parents, students, or staff raise a ticket (via Web, Mobile, or escalated from the AI Chatbot §21.1) categorized as Academic, Finance, IT/Technical, Transport, Facilities, Disciplinary, or Other.
- **Routing:** category-based auto-assignment to the responsible department/role (configurable routing table), with manual reassignment allowed.
- **SLA & Escalation:** configurable response/resolution time targets per category/priority; auto-escalates to the next role in the chain if breached (reuses the same generalized `IApprovalWorkflow`/escalation pattern as Leave Approval §9.3 and Hostel Gate Passes §15).
- **Conversation Thread:** public replies (visible to requester) vs. internal notes (staff-only), file attachments, status tracking (Open/In Progress/Resolved/Closed/Reopened).
- **Resolution Analytics:** average resolution time by category/department, ticket volume trends, optional post-resolution satisfaction rating from the requester.
- **`[NEW idea]` Linkage to other modules:** a fee-dispute ticket can deep-link to the relevant invoice; a transport-complaint ticket can deep-link to the relevant route/trip log — avoiding the requester having to re-describe context already in the system.

---

## 23. Dynamic Hardware & External Integration Adapters

```
                  CORE SYSTEM WORKFLOWS
  (Attendance | Notices | Bell | Messaging | Workforce | Library | Assets | Virtual Classrooms)
                            │
                            ▼
          UNIFIED ADAPTER INTERFACE LAYER
 IBellHardwareAdapter │ IWhatsAppAdapter │ IAttendanceCaptureAdapter │ IVideoConferenceAdapter `[NEW v4]`
                            │
                            ▼
      VENDOR-SPECIFIC IMPLEMENTATIONS
 IP Relay Controller │ ZKTeco/Hikvision │ Meta/Twilio/Wati │ Zoom API │ Google Meet API │ Jitsi (self-hosted)
 SmartBoard/LED Controllers │ RFID Gate/Card Readers │ Payment Gateways
```

*(§10.1 Bell Engine, §10.2 Noticeboard, §10.3 WhatsApp, §10.4 Biometric/RFID, §10.5 AI Timetable interfaces are retained unchanged from v3.0; the Video Conference Adapter interface is defined in §10.2 of this document.)*

---

## 24. Mobile Ecosystem — Deep Architecture `[v3 — retained, extended]`

All v3.0 modes retained (Personal Portal, Bus Tracker, Attendance Kiosk, Teacher Companion, Staff Self-Service, Device Management, Offline-First Sync, Push Architecture). `[NEW v4 additions]`:

- **Homework tab** in Personal Portal (Parent/Student) and Teacher Companion modes — view/submit/grade assignments, with camera-capture submission for handwritten work.
- **Join Virtual Class** button surfaced directly on the mobile Timetable view (deep-links into the configured provider's app or an in-app WebView for Jitsi).
- **Digital ID Card** view-in-app (mobile wallet-style card with live QR) as a backup if the physical card is forgotten — still resolves to the same `IAttendanceCaptureAdapter` identifier.
- **Helpdesk ticket** creation and tracking screen.
- **Sports/Events** feed and personal achievement record view for students.

---

## 25. Unified Frontend Architecture & Modular Backend Design

Retains the strict feature-level composition pattern from v2.0/v3.0. New feature modules follow the same directory convention, e.g.:

```
apps/web/src/features/learning-collaboration/    `[NEW v4]`
├── pages/ (AssignmentListPage, AssignmentSubmissionReviewPage, VirtualClassSchedulePage, LessonLibraryPage)
├── components/ (AssignmentCard, SubmissionGrid, RubricScorer, VideoSessionCard)
├── hooks/ (useAssignments, useVideoSession)
├── services/ (assignmentApi.ts, videoConferenceApi.ts)
└── permissions/ (learningPermissions.ts)

apps/web/src/features/identity-documents/         `[NEW v4]`
├── pages/ (IdCardDesignerPage, CertificateIssuePage, ReportCardTemplatePage)
├── components/ (CardTemplateCanvas, BatchPrintQueue, CertificateMergeFieldEditor)
├── services/ (documentEngineApi.ts)
└── permissions/ (documentPermissions.ts)

apps/api/src/modules/learning/                     `[NEW v4]`
├── use-cases/ (CreateAssignmentUseCase, SubmitAssignmentUseCase, ScheduleVirtualClassUseCase, SyncVideoAttendanceUseCase)
├── domain/ (entities/, repositories/)
├── infrastructure/ (adapters/ — ZoomAdapter, GoogleMeetAdapter, JitsiAdapter)
└── dto/

apps/api/src/modules/documents/                     `[NEW v4]`
├── use-cases/ (GenerateIdCardUseCase, IssueCertificateUseCase, RenderReportCardUseCase, BatchPrintUseCase)
├── domain/ (entities/, repositories/)
├── infrastructure/ (pdf-renderer/, template-store/)
└── dto/
```

---

## 26. Reports Engine & Student Analytics `[NEW v4 — expanded from v3.0 §13]`

### 23.1 Print/Export Report Templates

- **Paper-size-aware** output for every printable artifact (report cards, certificates, ID cards, fee receipts, library slips, promotion letters) via the shared Document/Print Template Engine (§5, §12): **A4** (default administrative/report documents), **A5** (compact report cards/notices, common for younger grades), **CR80** (ID cards), and custom sizes.
- Export formats: PDF (primary), Excel/CSV for tabular reports, and ministry/jurisdiction-specific compliance templates (retained from v3.0).

### 23.2 Student Analytics — by Student, Class, Section, Grade

- **By Student:** consolidated dashboard — academic performance trend across terms, attendance %, homework completion rate, fee status, co-curricular participation, disciplinary notes (role-gated visibility).
- **By Class/Section:** average performance per subject, attendance heat-map, assignment completion comparison across sections of the same grade.
- **By Grade/Stage:** cohort-level trend across the Education Stage hierarchy (§7.1), useful for curriculum-effectiveness review across a whole grade level.
- **By Curriculum Track:** performance comparison across concurrent tracks (e.g., National vs. Cambridge track within the same grade, §7.3).
- **Grading Analytics:** grade-distribution histograms per subject/exam, teacher-moderation variance check (flags subjects/teachers whose grade distribution is a statistical outlier for review — informational only, never automated punitive action).
- **Promotion Analytics:** promotion/retention rate trends per grade/year, feeding into the Promotion Engine's rule tuning (§11).

### 23.3 Operational Analytics *(retained/extended from v3.0 §13)*

- Attendance, leave-utilization, fee-collection, asset-utilization, library-circulation, transport on-time performance, helpdesk resolution-time dashboards — unified in one cross-domain Admin Analytics view for Deluxe/Enterprise.

---

## 27. Non-Functional Requirements & Security

*(Retained from v3.0 §14 — data privacy for biometrics, availability targets, backup policy, performance targets, accessibility, localization, data retention.)* `[NEW v4 addition]`: recorded video-class content and homework-submission files inherit the same object-storage encryption-at-rest and role-gated access rules as other student records; recordings default to teacher/enrolled-student/parent visibility only, never public, unless explicitly published to the Event Media Gallery (§16.5) with consent settings honored.

---

## 28. Phase-by-Phase Delivery Roadmap `[REVISED v4]`

```
Phase 0: Architecture, ERD & SRS Sign-Off
  │
  ▼
Phase 1: Foundation (Auth, RBAC, Licensing, Audit, Error Logs, Document/Print Engine skeleton)
  │
  ▼
Phase 2: Academic Core (Dynamic Stages, Syllabus Engine, Timetable, Promotion Engine)
  │
  ▼
Phase 3: Unified Attendance Engine (Student → Teacher → Staff; Manual → QR → Biometric/RFID)
  │
  ▼
Phase 4: Workforce Management (Leave, Accrual, Approval, Substitution, Holiday Calendar)
  │
  ▼
Phase 5: Identity & Document Generator (ID Cards → Certificates → Report Card A4/A5 templates)
          — unlocks Library/Transport/Hostel credential reuse in later phases
  │
  ▼
Phase 6: Finance Subsystem (Fees, Invoices, Ledger, Payroll incl. Attendance/Leave deductions)
  │
  ▼
Phase 7: Learning & Collaboration (Homework/Assignments → Online Classrooms → Lesson Library)
  │
  ▼
Phase 8: Library, Transport & Asset/Inventory Management (shared QR/RFID credential reuse)
  │
  ▼
Phase 9: Operational Integrations (Bell, Digital Noticeboard, WhatsApp) + Sports/Events + Hostel (if licensed)
  │
  ▼
Phase 10: Facilities & Grounds Hire (Registry → Internal Booking → External Hire/Invoicing → School Hall Rental Pack)
          + Retail Concessions (Outlet Registry → Canteen → BookShop → Third-Party Settlement → optional Wallet)
          + Student Leadership & Prefect System (depends on Clubs/Sports from Phase 9)
  │
  ▼
Phase 11: AI Suite (Timetable Optimization, Lesson/Quiz Generator, Report Comments, Absenteeism Insights, AI Chatbot)
  │
  ▼
Phase 12: Helpdesk/Ticketing & Reports Engine + Student Analytics
  │
  ▼
Phase 13: Alumni Network (Directory → Events/Mentorship → Giving/Fundraising, if licensed)
  │
  ▼
Phase 14: Mobile Ecosystem (all modes incl. Homework, Join-Class, Digital ID, Helpdesk, Sports feed, Facility booking, Alumni portal)
  │
  ▼
Phase 15: Security Auditing, Performance Hardening & Production Rollout
```

**Key sequencing rationale:** the Identity & Document Generator moves earlier (Phase 5) because ID-card QR/barcode identifiers are deliberately reused by Attendance (already built in Phase 3), Library, and Asset tagging — building it early avoids retrofitting credential logic later. Learning & Collaboration (Phase 7) follows Finance so that Homework-linked continuous-assessment scores can optionally feed fee-linked scholarship/merit rules if a school configures that. Facilities & Grounds Hire (Phase 10) is deliberately placed after Finance (Phase 6) and Sports/Events (Phase 9) since external-hire invoicing depends on the Ledger and internal-booking conflict-checking benefits from an already-populated Event Calendar. Alumni (Phase 13) is placed late by design — it depends on the Promotion/Exit workflow (§11) being mature enough to reliably convert graduating students into alumni records.

---

## 29. Module Coverage Cross-Check (vs. Standard SMS Feature Checklist) `[NEW v4]`

A mapping of the commonly-referenced 24-module SMS checklist to where each is addressed in this plan, so nothing is silently missing:

| # | Checklist Module | Covered In |
|---|---|---|
| 1 | Admin & User Management | §5 Platform, §Auth/RBAC |
| 2 | Student Management | §5 Academic, §7 |
| 3 | Admission Management | §5 Academic (Student Lifecycle) — *recommend confirming a dedicated Admission pipeline (online application → review → entrance/placement → approval → enrollment) be modeled as its own use-case set under Academic in the ERD; flagged in §30 Risks* |
| 4 | Academic Management | §7 |
| 5 | Attendance Management | §8 |
| 6 | Timetable Management | §7 (Academic), §10.2 (Virtual Periods) |
| 7 | Examination & Assessment | §7, §11 (Promotion), §12.3 (Report Cards) |
| 8 | Fees & Finance | §5 Finance |
| 9 | Teacher & Staff Management | §5 Academic (profiling), §9 (Attendance/Leave/Payroll) |
| 10 | Parent Portal | §24 Mobile, Web Personal Portal |
| 11 | Teacher Portal | §24 Teacher Companion Mode, Web |
| 12 | Student Portal | §24 Personal Portal (student sub-mode), Web |
| 13 | Homework & Assignments | §10.1 |
| 14 | Library Management | §13 |
| 15 | Transport Management | §14 |
| 16 | Hostel/Accommodation | §15 |
| 17 | Communication & Notifications | §5 Communication |
| 18 | HR & Payroll | §9, §5 Finance (Payroll) |
| 19 | Inventory & Assets | §20 |
| 20 | Reports & Analytics | §26 |
| 21 | Certificates & Documents | §12 |
| 22 | Events & Activities | §16 |
| 23 | Helpdesk/Complaints | §22 |
| 24 | System Settings & Security | §5 Platform, §27 |
| 25 | *(beyond checklist)* Facilities & Sports-Ground Booking/Hire | §17 |
| 26 | *(beyond checklist)* Student Alumni Network | §18 |
| 27 | *(beyond checklist)* Student Leadership & Prefect System | §19 |
| 28 | *(beyond checklist)* BookShop (school-run or third-party) | §17.7, §17.9 |
| 29 | *(beyond checklist)* Canteen (school-run or third-party) | §17.7, §17.8 |
| 30 | *(beyond checklist)* School Hall rental to other schools / events | §17.6 |

**Additionally covered beyond the checklist:** Online Classrooms/Video Conferencing (§10.2), AI Chatbot (§21.1), AI Timetable/Insights suite (§21), Facility Booking/External Hire (§17), Alumni Network (§18), Student Leadership/Prefect System (§19), Serial-Key Licensing & Editions (§3–4), Unified multi-actor Attendance architecture (§8), Student Promotion Engine (§11), and Document/Print templating shared across ID cards, certificates, and report cards (§12).

---

## 30. Open Risks, Assumptions & Recommendations

**Retained from v3.0** (kiosk offline handling, teacher-attendance/payroll discrepancy review, leave-approval delegate chains, biometric privacy, license grace period).

**New for v4.0:**

| Risk / Open Item | Recommendation |
|---|---|
| Admission Management was implied but not modeled as its own pipeline in v2.0–v3.0 | Add a dedicated **Admission & Enrollment** use-case set (online application form → document upload → entrance/placement test recording → approval → auto-conversion to Student record) in the ERD before Phase 2 sign-off. |
| Video conferencing vendor costs/limits (Zoom/Meet paid tiers) | Confirm per-edition concurrent-session limits (see `maximum_video_class_concurrent_sessions` in §4.2) and default new schools to self-hosted Jitsi unless they explicitly connect a Zoom/Google Workspace account. |
| AI Chatbot data-grounding risk (hallucinated policy answers) | Enforce retrieval-grounded answers only for policy/FAQ questions; anything outside the retrieved knowledge base should trigger a "let me open a helpdesk ticket" fallback rather than a guessed answer. |
| Hostel module scope creep for non-boarding schools | Keep Hostel strictly as an optional, separately licensed add-on (already reflected in §3 matrix) so it never appears in the UI for schools that don't enable it. |
| Shared QR/RFID credential (ID card = attendance card = library card = asset-custody card) increases blast radius if a card is lost | Card deactivation (§12.1) must immediately revoke it across *all* consuming modules (Attendance, Library, Asset custody) — design the credential-revocation event as a single platform-wide broadcast, not per-module. |
| Report card layout diversity (A4 vs A5, narrative vs grade-table) across curriculum tracks | Confirm the initial customer set's required layouts before Phase 5, since template variety directly affects the Document/Print Engine's abstraction design. |

**New for v5.0:**

| Risk / Open Item | Recommendation |
|---|---|
| External facility hire introduces non-student parties (external renters) into a system designed around students/staff/parents | Model external hirers as a distinct, lightweight identity type (contact record, not a full user account) unless the school wants them to have portal login — avoids polluting the core RBAC/user model built for school-affiliated people. |
| Facility liability/insurance requirements vary by jurisdiction (e.g., swimming pool hire) | Treat the waiver/consent document (§17.3) as a configurable template, not a fixed legal form — schools must supply/approve their own wording; the platform only handles capture and storage. |
| Alumni are no longer minors and fall outside the school's normal child-safety-first data model | Alumni Portal accounts and data handling should be reviewed against general adult-data-privacy practice (not the stricter minor-safeguarding rules used elsewhere in the platform), with explicit consent capture at conversion time (§18.5). |
| Prefect merit/demerit points risk being perceived as punitive if not handled carefully | Keep the merit/demerit feature strictly optional and configurable per school culture/policy; default it to **off** rather than **on**. |

**New for v5.2:**

| Risk / Open Item | Recommendation |
|---|---|
| Third-party vendors gain access to student-related data | Vendor role is scoped to one outlet; expose only a student token + required flags (allergy, wallet decision); log every vendor lookup. |
| Canteen allergy liability | Present allergy flags at POS and require logged override; state clearly that flags depend on parent-entered data; obtain school legal sign-off on wording. |
| Stored-value wallet may be regulated in some jurisdictions | Keep Wallet optional/Enterprise add-on; confirm local rules before enabling; no cash-out, refunds only on exit via approval. |
| Commission disputes with concessionaires | Immutable sales log, auto-generated settlement statements, and audit trail; disputes tracked in Helpdesk. |
| Hall double-booking with exams or assemblies | Academic events may only pre-empt *tentative* holds; confirmed bookings need audited Admin override. |
| Operator model switch mid-year (school-run to third-party) | Effective-dated operator model with a closing settlement and stock hand-over checklist; historical GL entries stay untouched. |

---

*End of Master Plan v5.2*
