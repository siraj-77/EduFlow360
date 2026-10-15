# API-101 Local Residue Snapshot (2026-10-15)

Read-only evidence collected from the local `eduflow360db` while the integration gate was red.

- Execution database used by `apps/api`: `eduflow360db`
- Table counts (database-level, not seeded test rows):
  - `school_settings`: 5173 rows
  - `users`: 7591 users
- Integration result: `database-contract.integration.spec.ts` fails with
  `no account in the seed's school carries a password` because the residue
  `Seed` school (id `00000000-0000-4000-8000-000000000001`) includes accounts
  with password hashes (D42 violation)
- All other integration tests passed (323/324)

## Recommended operating choices

| Option | Consequence |
|---|---|
| **Keep eduflow360db** | Integration stays red on the passworded-seed-contract test until data is scrubbed |
| **Use eduflowdb_new** | Restores the full green integration gate; no residue interference |
| **Archive eduflow360db** | Keep bytes unreferenced and auditable; declare `eduflowdb_new` as the active local database |

## Non-actions
- Do not alter the seed test or password contract solely to hide residue
- Do not make a silent default in `.env`; the current pointer is explicit
- Do not drop the residue tables without an owner action

This activity and the worklog entries are the auditable trail for API-101.
