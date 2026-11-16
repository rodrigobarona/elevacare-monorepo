-- ADR-026: signed-in surfaces moved under fixed namespaces. Rewrite in-app
-- notification links stored in the old shapes so the inbox never opens a
-- public profile or a 404:
--   /space-{12 hex}/…  -> /space/…
--   /{slug}/team/…     -> /expert/{slug}/…   (expert tools; CRM digest)
--   /{slug}/admin/…    -> /team/{slug}/…     (clinic management)
--   /{slug}/academy/…  -> /academy/{slug}/…  (lecturers)
-- Rows whose first segment is already a namespace or a fixed route are left
-- alone, so re-running changes nothing.
--
-- notifications_owner_update_guard (0042) lets owners change only read_at;
-- this system rewrite runs as platform admin, set for this transaction only.
-- One DO block keeps the setting and all four updates in one statement (the
-- runner sends each statement separately) and makes the rewrite atomic.
--
-- notifications has FORCE ROW LEVEL SECURITY and its only UPDATE policy needs
-- the row owner's context, so the rewrite reaches every owner's rows only as
-- a role that bypasses RLS (neondb_owner on every Neon branch). Fail loudly
-- rather than silently skip rows under any other role.
DO $$
DECLARE
  fixed_routes text[] := ARRAY['space', 'expert', 'team', 'academy', 'account', 'join', 'onboarding', 'admin', 'docs'];
BEGIN
  IF NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
    RAISE EXCEPTION '0076 must run as a role that bypasses row-level security (got %)', current_user;
  END IF;

  PERFORM set_config('eleva.platform_admin', 'true', true);

  UPDATE "notifications"
  SET "href" = regexp_replace("href", '^/space-[0-9a-f]{12}([/?].*)?$', '/space\1')
  WHERE "href" ~ '^/space-[0-9a-f]{12}([/?].*)?$';

  UPDATE "notifications"
  SET "href" = regexp_replace("href", '^/([a-z0-9-]+)/team([/?].*)?$', '/expert/\1\2')
  WHERE "href" ~ '^/([a-z0-9-]+)/team([/?].*)?$'
    AND NOT (split_part("href", '/', 2) = ANY (fixed_routes));

  UPDATE "notifications"
  SET "href" = regexp_replace("href", '^/([a-z0-9-]+)/admin([/?].*)?$', '/team/\1\2')
  WHERE "href" ~ '^/([a-z0-9-]+)/admin([/?].*)?$'
    AND NOT (split_part("href", '/', 2) = ANY (fixed_routes));

  UPDATE "notifications"
  SET "href" = regexp_replace("href", '^/([a-z0-9-]+)/academy([/?].*)?$', '/academy/\1\2')
  WHERE "href" ~ '^/([a-z0-9-]+)/academy([/?].*)?$'
    AND NOT (split_part("href", '/', 2) = ANY (fixed_routes));
END $$;
