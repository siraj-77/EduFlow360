# `PLT-101` decisions taken 2026-09-30 — and the identity design

**Status:** owner answered all three · `PLT-101` unblocked once the domain literal arrives
**Supersedes:** the open questions in `docs/analysis/PLT-101_PRECISIONS_2026-09-30.md`

---

## Decisions

| #   | Question                              | **Answer**                                                           | Consequence                                                                                                                   |
| --- | ------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Web `BigInt`                          | ✅ **Recommendation — real `bigint`, no polyfill.** `target: ES2020` | `MoneyMinor` is a native `bigint`. No polyfill dependency standing between a school and a balanced ledger                     |
| 2   | Google only, or more providers later? | ✅ **More providers later**                                          | Build for the **general** case, not the Google case. `ExternalIdentity` has a `provider` **column**, not a table per provider |
| 3   | Restrict staff to one email domain?   | ✅ **One domain**                                                    | ⚠️ **The literal domain is still needed** — see below                                                                         |

### Why #2 changes the recommendation

The earlier note recommended _Google Sign-In only_ (option C, 3–4 days) on the
grounds that it avoids hand-rolling an OAuth flow. **That reasoning assumed one
provider.** With more providers coming, the redirect-and-callback flow has to exist
regardless, so the saving evaporates. Build **option B** — a provider-agnostic
OIDC authorization-code flow with `provider` as data — and Google is simply its
first entry.

The practical shape is identical either way: a table with a `provider` column, a
verify-the-token step, and a lookup by `(provider, subject)`. The difference is
whether the first provider is hard-coded into a route name.

---

## The identity question: what do we actually store?

**Asked by the owner:** _"once we add google Auth, we need to add the user gmail id
to the system is it"_

**Answer: we store Google's `sub`, not the gmail address.** A gmail _is_ stored —
`User.email` is `NOT NULL` and unique (§ `ADR-003` single-tenant, so per-school), so
it must be — but it is an **attribute**, not the identity.

Google's ID token carries two claims that look interchangeable and are not:

| Claim   | What it is                                     | Safe as a key?                      |
| ------- | ---------------------------------------------- | ----------------------------------- |
| `sub`   | Google's **immutable** user id. Never changes. | ✅ **Yes — this is the lookup key** |
| `email` | The gmail or Workspace address                 | ❌ **No**                           |

### Three concrete failures if gmail is the key

1. **A teacher is renamed.** Google renames the account → new gmail → under an
   email key they become a _brand new user_ and lose their history, attendance and
   enrolments. `plausible deniability` is not a defence here; it is data loss.
2. **The school moves Workspace domain** — `@old.lk` → `@new.lk`. That rewrites
   _every staff member's_ address simultaneously. One morning, nobody logs in, and
   no error is raised: each address simply stops matching.
3. **`email_verified` is absent** for some Google account types, so "trust the
   address Google returned" is not always safe either.

### The table

```ts
model ExternalIdentity {
  schoolId        // metadata, as everywhere (ADR-003)
  id
  provider        // 'google' | 'microsoft' | 'apple' - DATA, not a table per provider
  providerSubject // Google's `sub`. Immutable. The lookup key.
  userId          // -> users.id
  providerEmail   // the address AT LOGIN TIME. A snapshot, for humans.
  linkedAt
  @@unique([schoolId, provider, providerSubject])
}
```

**This is precisely what decision #2 buys.** `provider` is a column, so Microsoft or
Apple later is one row per provider — no new model, no new FK, no migration. Had we
keyed on the email address, "more providers later" would have been a rewrite rather
than an addition.

`providerEmail` is a **snapshot, not a key**. It is what an administrator sees when
asked _"who is this account?"_, and it is allowed to go stale — that is the point.

### A case it gets right that a naive design gets wrong

A parent signs in with `parent@gmail.com`. Later a different person signs in with
the _same_ address as a Google Workspace account. Because `sub` differs, they are
correctly **two separate users**; the email matches, so they can never be merged by
accident. Under an email key they would collide into one account — which is a
privacy incident involving two unrelated families' children's data
(`AGENTS.md` §2.13), not merely a bug.

⚠️ **Consequence to state now:** this table is a **seventeenth model**, so it trips
the same three registration points `D-4.1` did — `PLATFORM_CORE_MODELS`
(`prisma-schema.spec.ts`), `PLATFORM_CORE_ENTITIES`
(`apps/api/erd/project-erd-source.mjs`) and `CLUSTER` (`apps/api/prisma/render-erd.mjs`).
All three must move **in one commit**, as they did for `UserRole`.

---

## ⚠️ Still needed from the owner

| #   | What                                                                  | Why it cannot be guessed                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **The literal email domain**, e.g. `@school.lk`                       | It goes into the allow-list filter. A wrong value either locks every staff member out, or lets outsiders in. There is no safe default and no failure that is obvious at review time                                                                                |
| 2   | **Is the Google tenant a Workspace organisation, or consumer gmail?** | Workspace ⇒ an **Internal** consent screen, which skips verification and returns `email_verified` reliably. Consumer gmail ⇒ **External**, and `email_verified` may be absent — so the server-side check has to treat "absent" as a _decision point_, not a `true` |

Neither is needed to _start_ `PLT-101`: the table, the OIDC flow, and the session
issuance are identical either way. They are needed before the sign-in filter is
written, which is the last step.

---

## Implementation order, once the domain arrives

1. `ExternalIdentity` model + the **three** tripwires, one commit.
2. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` through `env.ts`, which already
   fails fast naming a missing variable (`AGENTS.md` §11).
3. OIDC authorization-code flow: redirect → callback → exchange code → verify the
   ID token against Google's JWKS. **Check `aud` is our client id and `iss` is
   Google.** Never trust a client-supplied email without that signature check.
4. Resolve `(provider, providerSubject)` → `User`, creating one if new.
5. Issue **our** session: a `Session` row and a `RefreshToken` family, per `ADR-008`.
   **Google's credential ends here** — it is not a session.
6. `@Audited('LOGIN_PROVIDER')`, recording the provider subject, with **no token in
   the log** (§2.13).
7. Domain allow-list filter, using the literal from the table above.

⚠️ **OAuth is never the first login of a fresh install.** `PLT-107`'s setup token
is, by design — a new deployment has no `User` for an external identity to attach to.

---

_Refs: `ADR-002`, `ADR-003`, `ADR-008`, `ADR-024`, `ARC-01`, `ARC-06`, `PLT-101`, `PLT-104`, `PLT-107`, `AGENTS.md` §2.13, §11, `D-4.1`, `D-4.3`_
