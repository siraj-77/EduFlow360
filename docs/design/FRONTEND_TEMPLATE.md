# FRONTEND TEMPLATE — Assessment

**Subject:** `docs/template/EduFlow — Frontend Template.html`
**Assessed:** 2026-09-28 · **Method:** full-file read, regex probes, encoding verification
**Purpose:** `AGENTS.md` §2.8 directs harvesting this template into `packages/i18n-resources/` and `packages/ui-kit`. This document records what is actually in it, so the harvest is sized correctly.

---

## 1. Verdict

**Harvest the tokens. Reject the dictionary claim. Borrow the RTL *pattern*, not the RTL *implementation*.**

`AGENTS.md` §2.8 describes the template as containing *"a complete `en`/`ta`/`si`/`ar` dictionary and a working RTL implementation"*. Measured, that is **21 marketing keys with zero application keys**, and **4 CSS rules that mirror a landing page**. The token set is genuinely good and the translations are genuinely encoded. The dictionary claim is off by roughly two orders of magnitude for the work it implies.

---

## 2. What the file actually is

| Property | Value |
|---|---|
| Size | 34.4 KB (35,204 bytes) |
| Lines | 511 |
| `<style>` blocks | 1 |
| `<script>` blocks | 1 |
| Structure | **A marketing landing page** — hero, marquee, 4 feature cards, login screen, forgot-password screen. Not an application shell. |

There is no sidebar, no data table, no dashboard, no form library, no component set. It is a *design reference*, not a starting application.

---

## 3. Claim-by-Claim Verification

### 3.1 "A complete `en`/`ta`/`si`/`ar` dictionary" ❌ **OVER-CLAIMED**

**Measured: 21 keys per locale. All marketing copy. Zero application keys.**

Complete key list:
```
badge  ctaDemo  ctaTrial  f1h  f1p  f2h  f2p  f3h  f3p  f4h  f4p
footer  heroSub  heroTitle  kpiAttendance  kpiFees  kpiLeave  kpiStudents
marqueeLabel  navLogin  navStart  statSchools  statStudents
```

Wired via `data-i18n="<key>"` attributes, resolved by an `I18N` object with `en` / `ta` / `si` / `ar` sub-objects.

**The translations are real.** Verified by codepoint inspection (the console cannot render them, so the file was read as UTF-8 and the code points dumped):

```
ar.navLogin = "تسجيل الدخول"
  → 062A 0633 062C 064A 0644 0020 0627 0644 062F 062E 0648 0644
  → 12 chars, 0 literal '?'. Genuine Arabic, correctly encoded.
```

**So the dictionary is genuine — it is just tiny, and every key is marketing copy.** There is not one `nav.students`, `form.save`, `error.required` or `report.grade` in it.

**Consequence:** `packages/i18n-resources` content must be **authored per module** (`DSN-02`). The template contributes the *mechanism* (`data-i18n` + an `I18N` object + a locale switcher) and nothing else.

**Tracked as `SSOT.md` D9. The estimate impact is material and is why `DSN-02` is estimated as build-from-scratch.**

### 3.2 "A working RTL implementation" ⚠️ **PARTIALLY TRUE — A LANDING PAGE IS MIRRORED, NOT AN APP SHELL**

**Measured: 4 CSS rules + 1 JS line.**

```css
html[dir="rtl"] .stats,
html[dir="rtl"] .hero-cta,
html[dir="rtl"] .nav-links   { direction: rtl }
html[dir="rtl"] .marquee-track { animation-direction: reverse }
html[dir="rtl"] .lang-menu    { right: auto; left: 0 }
html[dir="rtl"] .lang-menu button { text-align: right }
```
```js
document.documentElement.setAttribute('dir', code === 'ar' ? 'rtl' : 'ltr');
```

**What is genuinely reusable:** the *mechanism* — set `dir` on `<html>` from the locale, and scope RTL rules under `html[dir="rtl"]`. That is the right approach and `DSN-03` adopts it.

**What is missing** for `AGENTS.md` §3.2.6 ("RTL-safe: use logical properties, mirror directional icons, verify Arabic on every new screen"):

| Required | Present? |
|---|---|
| Logical properties (`ms/me/ps/pe`, `start/end`) | ❌ 0 — uses physical `right`/`left` |
| Sidebar mirrored | ❌ no sidebar exists |
| Form input alignment mirrored | ❌ no RTL-aware form |
| Data tables mirrored | ❌ no table exists |
| Directional icon mirroring | ❌ no icons |
| Responsive behaviour under RTL | ❌ |

**Consequence:** `DSN-03` must build RTL for the **login page, a form page and a data-table page** — the three archetypes every later screen copies — rather than assuming the template proves the approach.

### 3.3 "A light/dark token set" ✅ **ACCURATE AND USEFUL**

This is the template's real value.

```css
:root:not([data-theme="light"]) { /* light tokens */ }
:root[data-theme="dark"]         { /* dark tokens */ }
```

Token usage measured in the file: `--brand` ×26, `--border` ×25, `--muted` ×19, `--surface` ×12, `--bg` ×11, `--accent` ×10.

`AGENTS.md` §2.8 / §3.2.5 specify this token set, and the template implements it. **Harvest in full.**

JS behaviour also matches §3.2.5:
- `toggleTheme()` flips `data-theme` on `document.documentElement`
- persisted choice restored pre-paint on load
- one `prefers-color-scheme` occurrence

### 3.4 "Honour `prefers-color-scheme`" (§3.2.5) 🟡 **present but thin**

One occurrence. The mechanism exists; whether it correctly *prefers* the OS setting when no stored choice exists needs verification during `DSN-01`.

### 3.5 `prefers-reduced-motion` (§3.2.7) ❌ **ABSENT**

**Zero occurrences.** The template has several animations (`drift`, `fadeUp`, `scroll`, hover transforms). `AGENTS.md` §3.2.7 requires motion ≤ 200 ms **and** respect for `prefers-reduced-motion`. This must be **added** in `DSN-05`, not inherited.

---

## 4. Do Not Harvest

| Item | Why |
|---|---|
| **"Trusted by 200+ schools"** | **False.** No such customer base. `AGENTS.md` §2.8 already flags this. |
| **"1.2M Students Managed"** | **False.** `AGENTS.md` §2.8 already flags this. |
| **"Start Free Trial"** | Contradicts the product: per-school deployment sold on **editions** (Basic/Standard/Deluxe/Enterprise). There is no trial. `AGENTS.md` §2.8 already flags this. |
| **Google / Microsoft / Apple / Facebook login buttons** | A `social()` handler exists for all four. `AGENTS.md` §13 **forbids** implementing real Google/Microsoft/Apple/Facebook OAuth without confirming which client credentials and redirect URIs are configured — and these differ between local, staging and production. Do not port the buttons. |
| The hero/preview/marquee markup | Marketing layout, not application layout |

---

## 5. Harvest Plan

| From the template | Into | Story |
|---|---|---|
| CSS token set (`--bg --surface --text --muted --border --brand --brand-2 --accent --danger --ok`) | `packages/ui-kit` as CSS variables | `DSN-01` |
| `data-theme` light/dark mechanism | `packages/ui-kit` + `apps/web` root layout | `DSN-01` |
| Pre-paint theme restoration | `apps/web` inline script in `<head>` | `DSN-01` |
| `dir` set on `<html>` from locale | `apps/web` i18n config | `DSN-03` |
| `html[dir="rtl"]` scoping *pattern* | Convention for `DSN-03` | `DSN-03` |
| `data-i18n` + `I18N`-object *pattern* (not content) | `packages/i18n-resources` | `DSN-02` |

## 6. Must Be Built From Scratch

| Item | Story |
|---|---|
| All application i18n keys, ×4 locales | `DSN-02` |
| Font stack covering Tamil, Sinhala, Arabic — screen **and** PDF | `DSN-04` |
| Full app-shell RTL: sidebar, forms, tables, logical properties, icon mirroring | `DSN-03` |
| shadcn/ui component set (light + dark) | `DSN-01` |
| `prefers-reduced-motion`, ≤ 200 ms motion, ≥ 44 px touch targets | `DSN-05` |
| CI enforcement: no literal user-facing string; no hard-coded hex | `DSN-06` |

---

## 7. Note on Encoding

`AGENTS.md` §3.2.7 requires fonts covering Tamil, Sinhala and Arabic **on screen and in generated PDFs**, and states font embedding must be **verified per script, not assumed** from a default Latin stack. The template's HTML proves browser-side rendering of all four scripts; it says nothing about the **PDF pipeline** (headless Chromium / PDFKit+Handlebars per Master Plan §2.1). That is a separate and commonly-late discovery — `DSN-04` covers both.

---

*Companion documents: `AGENTS.md` §2.8, §3.2.5–3.2.7 · `docs/core/SSOT.md` D9 · `docs/core/ARCHITECTURE.md` §16 · `docs/work/CHANGELOG.md` "Known issues".*
