-- EduFlow — minimum provisioning of the application role (SEC-101)
--
-- `audit-immutability.sql` revokes UPDATE, DELETE and TRUNCATE on
-- `audit_records` from `eduflow_app`, and raises when the role does
-- not exist — revoking from a role that does not exist is a silent
-- no-op, which is precisely the failure this pair of files exists
-- to prevent.
--
-- The role is owned by infra/docker provisioning (OPS-06). Until
-- that lands, `deploy.mjs` runs this file first, so a fresh
-- deployment reaches the hardened state end to end instead of
-- failing closed on the hardening step. Idempotent: the DO block
-- is a no-op when the role already exists.
--
-- No password is set here. A password is a deployment secret and
-- belongs in provisioning, never in a committed file (AGENTS.md
-- section 11).

DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'eduflow_app') THEN
        CREATE ROLE eduflow_app LOGIN;
        RAISE NOTICE 'created role eduflow_app';
    ELSE
        RAISE NOTICE 'role eduflow_app already exists';
    END IF;
END
$$;
