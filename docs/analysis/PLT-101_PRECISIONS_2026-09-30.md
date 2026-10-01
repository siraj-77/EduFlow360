# Decisions to settle before `PLT-101` — BigInt and Google OAuth

**Date:** 2026-09-30 · **Status:** owner decisions required · **Blocks:** `PLT-101`, `ARC-06`

`ADR-024` and `PLT-107` left two questions open that `PLT-101` has to answer before
it can be written. Both are here because they are cheap to settle now and expensive
to change once login exists.

---

## 1. Web `BigInt` — what I need from you

`ADR-024` decided money crosses the wire as a decimal string, read through a
branded `MoneyMinor` that is a `bigint`. **Open:** whether the _web_ build can use
real `bigint`, or must hold minor units as `number` with a runtime safe-range check.

### What I need — one question

> **Which browsers must the staff-facing web app support?**

That is the only input the decision actually depends on. Everything else I can
determine myself.

### Why I am asking rather than deciding

`bigint` landed in Chrome 67, Edge 79, Firefox 68 and **Safari 14** (September
2020). As of 2026 that is a five-year-old baseline. So the honest question is not
"does `bigint` exist" — it does — but whether your deployment includes **iOS
devices below 14**, or a managed browser estate you do not control. For a school
staff app in Sri Lanka, that is a realistic question: institutional iPads are
often not replaced quickly, and Safari is the _last_ browser to get these features.

### My recommendation, if you have no constraint

**Use real `bigint`, no polyfill.** Reasons, in order of weight:

1. A polyfill is a **runtime dependency that exists to serve browsers from 2018**,
   and it must be correct for arithmetic that decides whether a school's books
   balance. That is a poor place to accept a third-party number implementation.
2. `tsconfig` can set `"target": "ES2020"` and `bigint` literals then work natively
   with no transform at all. Babel's `bigint` support has historically been the
   sticking point; the modern answer is to raise the target and stop transpiling it.
3. The `number` fallback is safe _today_ for a single school — LKR at 2dp caps near
   90 trillion minor units, and a school's annual fee income is nowhere near that —
   but "safe today" is a number that moves if the product is ever licensed to a
   larger body, and it moves silently.

### If you need Safari < 14

Then the choice is `number` **plus** a runtime assertion, and the assertion is not
optional — it is the whole reason option (B) was rejected in `ADR-024`. Concretely,
`MoneyMinor.fromNumber()` must throw when `!Number.isSafeInteger(n)`, and there
must be a test that fails when the school's `minorUnitScale` exceeds 2. Without
that test the fallback reintroduces exactly the silent-loss hazard the ADR rules
out.

### What I do **not** need

Nothing about infrastructure, proxying, or Node versions. Those are settled.

---

## 2. Google OAuth — the honest recommendation first

You asked for a step-by-step Google setup. Here it is. But I have to give you one
decision **before** the steps, because the obvious answer is the wrong one for this
repository, and finding that out after writing the login would be expensive.

### ⚠️ The conflict: Auth.js contradicts `ADR-008`

Auth.js is the standard Next.js choice and it is what most guides will tell you to
install. **Do not install it here.** Not a style preference — it collides with a
decision this project already made and tested.

`ADR-008` (`Token Strategy: Short-Lived Access JWT, Rotating Refresh with Family
Reuse Detection`) rules out stateless-only tokens, and says why:

> _"A stateless access token cannot be revoked before it expires, so a role change
> would not take effect for up to 15 minutes."_

Auth.js offers exactly two session strategies, and **both are disqualified**:

| Auth.js strategy    | Why it fails here                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `jwt` (its default) | Stateless. Directly contradicts `ADR-008`. This is the one people install by default.                             |
| `database`          | Needs a Prisma adapter and **its own session tables** — duplicating the `Session` model `ARC-01` already designed |

The schema already implements `ADR-008` properly, and the comment in it says so:

> `Session`: _"One server-side record per login. `ADR-008`: stateless-only JWTs cannot be revoked before expiry…"_
> `RefreshToken`: _"Opaque, single-use, rotating. `familyId` is the load-bearing column…"_

with `familyId`, `usedAt` and `replacedByTokenId` columns built for reuse
detection. Auth.js would throw that away and replace it with something weaker.

### Three options

|       | Approach                                                                                     | Effort   | `ADR-008`                      |
| ----- | -------------------------------------------------------------------------------------------- | -------- | ------------------------------ |
| **A** | **Auth.js**                                                                                  | 1–2 days | ❌ **contradicts it** — reject |
| **B** | **Raw OIDC code flow**, sessions issued against our own `Session`/`RefreshToken`             | 5–8 days | ✅ correct                     |
| **C** | **Google Sign-In (One Tap / GIS)** for credential verification, **we** issue our own session | 3–4 days | ✅ correct                     |

**Recommendation: C, falling back to B if you later need non-Google providers.**

Google Sign-In returns a signed **ID token** (a JWT) from the browser. You verify
its signature server-side against Google's published keys and — crucially — you
**still issue your own `Session` + `RefreshToken`**. Google authenticates the
person; it does not own the session. That keeps `ADR-008` fully intact, keeps
`PLT-107`'s setup-token bootstrap as the _first_ login of a fresh install (OAuth
cannot be that), and avoids hand-rolling an OAuth redirect flow you do not need
for a single provider.

⚠️ **The thing people get wrong with C:** treating the Google credential as a
session. It is not one. It expires in an hour, it cannot be revoked, and a school
must be able to suspend a teacher _immediately_. That is what our `Session` and
`User.status = SUSPENDED` are for.

---

## Step-by-step: Google Cloud Console setup

Do these in order. Nothing here needs to be committed, and **no client secret goes
in a tracked file** (`AGENTS.md` §11).

### Step 1 — Create the project

1. Open <https://console.cloud.google.com/>.
2. Top-left project picker → **New Project**.
3. Name: `eduflow-<your-org>` (not `EduFlow` — you may have several).
4. **Create**.

### Step 2 — Configure the OAuth consent screen

1. With the project selected: **APIs & Services → OAuth consent screen**.
2. Choose **External** (unless your school is a Workspace customer, in which case
   **Internal** is better and skips verification entirely).
3. Fill in: app name, **user support email**, developer contact email.
4. **Authorized domains:** your production domain only, e.g. `eduflow.example.lk`.
   ⚠️ **Not** `localhost` — localhost goes in the redirect URI list instead.
5. Add the scopes you actually need — **do not add "all scopes"**:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
6. Click **Publish**. With only those two scopes and no sensitive scopes, Google
   shows them as _low risk_ and **no verification review is required**. Adding
   Drive/Gmail scopes triggers a weeks-long review — avoid unless needed.

### Step 3 — Create the OAuth client

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized redirect URIs** — add each environment separately:

   | Environment | Redirect URI                                             |
   | ----------- | -------------------------------------------------------- |
   | Local dev   | `http://localhost:3500/api/auth/google/callback`         |
   | Staging     | `https://staging.<your-domain>/api/auth/google/callback` |
   | Production  | `https://<your-domain>/api/auth/google/callback`         |

   ⚠️ **The port is in the path-adjacent part of the URL and must match exactly** —
   your web dev server is fixed at **3500** by `web-port.spec.ts`, not 3000. A
   mismatch here fails with `redirect_uri_mismatch` and nothing else useful.

4. **Create**. You now have a **Client ID** and a **Client Secret**.

### Step 4 — Put them in `.env`, never in code

Your `.env` is git-ignored (verified). Add:

```bash
# Google Sign-In. Local dev only in this file; production uses the per-school
# environment (ADR-010 puts activation on an external vendor service).
GOOGLE_CLIENT_ID="<client-id>.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="<client-secret>"
```

`.env.example` keeps **placeholders only**. Never commit the secret, and never
paste it into a ticket.

### Step 5 — Rotate after setup

⚠️ The secret from Step 3 is in this chat transcript and in `.env`. **Regenerate it
in the console once the flow works**, then update `.env`. Same applies to the
PostgreSQL password agreed earlier.

### Step 6 — What you hand back to me

I do not need the secret. I need only:

1. **The redirect URI you chose** (so the route path matches).
2. **Whether the consent screen is Internal or External** — it changes whether
   Google returns `email_verified` reliably, which changes the server-side check.
3. **Whether staff must be restricted to one domain** (e.g. only `@school.lk`).

That is enough to write the integration. The secret stays in your environment.

---

## What I would then build, in order

1. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` read through `env.ts` — it already
   fails fast naming a missing variable, per `AGENTS.md` §11.
2. `POST /auth/google/verify` — verify the ID token's signature against Google's
   JWKS, then check `aud` is our client id and `iss` is Google. **Never trust the
   client-sent email** without that signature check.
3. Enforce `email_verified`, and the domain restriction if you want one.
4. Resolve to a `User` by `ExternalIdentity (provider, providerSubject)` — **not by
   email**. `providerSubject` is Google's stable user id; emails change and are
   unverified in some flows. This is shape B from the readiness assessment.
5. Issue **our** session: a `Session` row plus a `RefreshToken` family, exactly as
   `ADR-008` specifies. Google's credential ends at this boundary.
6. `@Audited('LOGIN_GOOGLE')`, with the provider subject recorded and **no token in
   the log** (`AGENTS.md` §2.13).

**Not the first login of a fresh install.** `PLT-107`'s setup token is, by design —
a fresh deployment has no `User` to attach a Google identity to.

---

## Summary of what I need from you

| #   | Question                                                                              | Blocking                           |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | **Which browsers must the staff web app support?** — specifically, any iOS below 14?  | `ARC-06` client type               |
| 2   | **Google only, or more providers later?** (affects whether C is enough or we build B) | `PLT-101` scope                    |
| 3   | **Consent screen Internal or External?**                                              | server-side `email_verified` check |
| 4   | **Restrict staff to one email domain?**                                               | the `signIn` filter                |

**Explicitly not needed from you:** the client secret, the database password, or
any code.

_Refs: `ADR-002`, `ADR-008`, `ADR-024`, `ARC-06`, `ARC-01`, `PLT-101`, `PLT-107`, `AGENTS.md` §2.3, §2.13, §11, `apps/web/src/lib/web-port.ts`, `docs/analysis/AUTH_RBAC_READINESS_2026-09-30.md` §5_
