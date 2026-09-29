-- EduFlow — audit_records immutability (AGENTS.md §2.7, PLT-401, ADR-013)
--
-- WHY THIS IS SQL AND NOT A SCHEMA ATTRIBUTE
-- ------------------------------------------
-- `AGENTS.md` §2.7 requires audit records to be append-only, and says the
-- repository exposes only create() and query(). That is a convention. A
-- convention binds the code that chooses to follow it and nothing else: a
-- future migration, a support session, or the application's own database
-- connection can all rewrite history without going near the repository. The
-- acceptance criterion in PLT-401 is explicit — "attempting an UPDATE/DELETE
-- against the audit table AT THE DATABASE CONNECTION LEVEL fails".
--
-- Prisma has no grammar for a GRANT, so the protection cannot live in
-- schema.prisma. It lives here, and
-- `apps/api/src/config/schema-generation.spec.ts` fails the build if this
-- file is deleted or weakened. Per ARCHITECTURE.md:307, a rule that is not
-- mechanically enforced is a suggestion.
--
-- HOW TO APPLY
-- ------------
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/prisma/hardening/audit-immutability.sql
--
-- Run it AFTER `prisma migrate deploy` (the table must exist) and it is
-- idempotent, so it is safe to re-run on every deployment.
--
-- The application role is expected to be named `eduflow_app`, created by
-- infra/docker provisioning (OPS-06). If a deployment names it differently,
-- change it here — the revokes below are deliberately NOT written against
-- PUBLIC, because revoking from PUBLIC is a different act that does not
-- constrain the role the application actually connects as.
--
-- One database per school (ADR-003): this runs once per school deployment,
-- which is the same count as migrations and backups.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. REVOKE. The application role may INSERT and SELECT, and nothing else.
-- ---------------------------------------------------------------------------
-- UPDATE and DELETE are the two operations that break append-only. TRUNCATE is
-- revoked too: it is not in the AGENTS.md list, but it empties the table just as
-- effectively, and a protection that can be bypassed with the statement next
-- door is not a protection.
DO
$$
DECLARE
    app_role text := COALESCE(NULLIF(current_setting('eduflow.app_role', true), ''), 'eduflow_app');
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
        RAISE EXCEPTION
            'application role % does not exist. Create it before applying audit hardening — revoking from a role that does not exist is a silent no-op, which is the failure this file exists to prevent.',
            app_role;
    END IF;

    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_records FROM %I', app_role);
    EXECUTE format('GRANT INSERT, SELECT ON TABLE public.audit_records TO %I', app_role);

    RAISE NOTICE 'audit_records: UPDATE/DELETE/TRUNCATE revoked from %', app_role;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. A trigger, because a REVOKE only binds the role it is revoked from.
-- ---------------------------------------------------------------------------
-- Prisma migrations run as the table OWNER, and an owner is not stopped by a
-- revoke against a different role. So the privilege above is necessary and not
-- sufficient: an owner-side UPDATE would still succeed. This BEFORE trigger
-- raises for everyone, including the owner, including a superuser who sets
-- session_replication_role = replica.
--
-- It is defence in depth with a specific job, not a second copy of the same
-- control: the revoke limits the application's blast radius, and the trigger
-- makes the invariant true of the table rather than true of one role.
--
-- The allowlist exists so this file can be applied and re-applied: the trigger
-- must be dropped before it can be replaced. `IF EXISTS` is what makes the
-- whole script idempotent.
CREATE OR REPLACE FUNCTION public.audit_records_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS
$$
BEGIN
    RAISE EXCEPTION
        'audit_records is append-only (AGENTS.md §2.7, PLT-401). % is not permitted. Retention is archival, never deletion (PLT-404).',
        TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS audit_records_append_only ON public.audit_records;

CREATE TRIGGER audit_records_append_only
    BEFORE UPDATE OR DELETE ON public.audit_records
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_records_block_mutation();

COMMENT ON TABLE public.audit_records IS
    'Append-only audit trail. UPDATE/DELETE/TRUNCATE revoked from the application role and blocked by trigger. Retained per category, archived never deleted (PLT-404).';

COMMIT;
