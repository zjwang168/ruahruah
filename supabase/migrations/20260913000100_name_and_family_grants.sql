-- =====================================================================
-- STEP 2 of 2 — withhold the surname, and close the pre-match household
-- exposure.
--
-- ⚠  RUN ORDER MATTERS. Do all three, in order:
--      1. supabase/migrations/20260913000000_names_and_views.sql  (additive)
--      2. deploy the application commit                           (reads views)
--      3. THIS FILE                                               (revoke)
--
--    Running this before the deploy takes /family/matches,
--    /family/dashboard, the messages thread and four admin pages down at
--    once. That is not hypothetical: on 2026-09-13 the users column grant
--    landed while two pages were still selecting `email` two embeds deep,
--    and PostgREST answered the WHOLE query with 42501 rather than
--    dropping the column. A grant that is correct in the catalogs still
--    breaks a query that names a column it cannot read.
--
-- Three independent changes, one transaction:
--
--   §1  ROW access on households. Deletes the pre-match arm from
--       family_profiles_select and its mirror from can_view_user(). An
--       unmatched caregiver loses the household row entirely rather than
--       seeing a trimmed version of it. The job board reads family_public.
--
--   §2  COLUMN access on users. Withholds full_name and last_name on top
--       of the four the 20260805 file already withheld. Both browse views
--       serve display_name ("Sarah C."); the whole name stays legible to
--       user_self and users_admin, and nowhere else.
--
--   §3  COLUMN access on households. Withholds onboarding_answers and
--       auto_replies, covering the rows a MATCHED caregiver can still
--       reach and the standing blanket grant that made the users bug
--       possible in the first place.
--
-- Idempotent. Safe to re-run. One transaction.
-- =====================================================================

BEGIN;

-- Refuse to run before step 1 — all four views and both columns.
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'v'
        AND c.relname IN ('family_public', 'family_self', 'family_admin',
                          'caregiver_public', 'user_display')) < 5
  THEN
    RAISE EXCEPTION 'run 20260913000000_names_and_views.sql first, and deploy, before this file';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_name'
  ) THEN
    RAISE EXCEPTION 'users.last_name is missing — run 20260913000000 first';
  END IF;
END $$;


-- =====================================================================
-- §1a  can_view_user() — drop the "household advertising work" arm.
--
--   A caregiver could read the `users` row of any household with an open
--   request, which is where the job board got full_name and then
--   abbreviated it in the browser. family_public.display_name now carries
--   the abbreviation, computed here.
--
--   The caregiver arm stays: a caregiver's own row is public by design,
--   and caregiver_public is how that is served.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.can_view_user(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    target = auth.uid()
    -- any caregiver's row: the public profile page is public by design
    OR EXISTS (SELECT 1 FROM public.caregiver_profiles cp WHERE cp.user_id = target)
    -- a household the caller has ACTUALLY MATCHED WITH. Advertising work
    -- no longer admits a stranger to the row; the board reads family_public.
    OR EXISTS (
      SELECT 1 FROM public.family_profiles fp
      WHERE fp.user_id = target
        AND public.shares_match_with_family(fp.id)
    )
    -- anyone already in a thread with the caller
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE (m.sender_id = auth.uid() AND m.receiver_id = target)
         OR (m.receiver_id = auth.uid() AND m.sender_id = target)
    );
$$;


-- =====================================================================
-- §1b  family_profiles_select — the same arm, on the profile table.
-- =====================================================================

DROP POLICY IF EXISTS family_profiles_select ON public.family_profiles;

CREATE POLICY family_profiles_select ON public.family_profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_ruah_admin()
    OR public.shares_match_with_family(id)
  );


-- =====================================================================
-- §2  users: withhold the surname.
--
--   Adds full_name and last_name to the denylist 20260805000100
--   established. first_name STAYS granted — "Sarah C." needs it, and a
--   first name alone does not identify a household.
--
--   full_name is withheld rather than dropped: user_self and users_admin
--   still read it, /api/* holds the service role, and the 18 legacy rows
--   that were never split have nothing else to fall back on.
--
--   Computed, not hand-listed, so a column added later is granted by
--   default and only the six named ones are withheld.
-- =====================================================================

DO $$
DECLARE
  cols text;
  denied CONSTANT text[] :=
    ARRAY['email', 'phone', 'zipcode', 'ban_reason', 'full_name', 'last_name'];
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'users'
    AND NOT (column_name = ANY (denied));

  IF cols IS NULL THEN
    RAISE EXCEPTION 'public.users has no grantable columns — aborting rather than locking the table';
  END IF;

  REVOKE SELECT ON public.users FROM authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.users TO authenticated', cols);

  RAISE NOTICE 'users → authenticated may read: %', cols;
  RAISE NOTICE 'users → withheld: %', array_to_string(denied, ', ');
END $$;

-- anon's whitelist from 20260804020000 §4b still names full_name. A
-- logged-out visitor browses through caregiver_public, which serves
-- display_name, so the base-table grant is redundant — and it is the same
-- column this file is withholding from logged-in callers.
REVOKE SELECT (full_name) ON public.users FROM anon;


-- =====================================================================
-- §2b  caregiver_public — drop the transitional full_name key.
--
--   20260913000000 left `full_name` in the nested object so that the
--   code in production, which reads row.users.full_name, kept working for
--   the length of the deploy. The deploy has happened by the time this
--   file runs — family/chat, search and api/match read display_name now —
--   so the key comes out and the surname stops leaving the database
--   through the browse surface.
--
--   CREATE OR REPLACE again: the column list does not change, only the
--   contents of the jsonb. No grants are touched, including anon's, which
--   is what makes the public browse page keep working through this.
--
--   This is the half of the surname fix that §2 cannot do. §2 governs the
--   BASE table; caregiver_public is security_invoker = false and reads the
--   base table as its owner, so a column grant does not constrain it. The
--   view stops publishing the name because this statement says so, and for
--   no other reason — which is the same reason caregiver_public has always
--   needed its column list curated by hand.
-- =====================================================================

CREATE OR REPLACE VIEW public.caregiver_public
WITH (security_invoker = false) AS
SELECT
  cp.id, cp.user_id, cp.bio, cp.years_experience, cp.languages, cp.services,
  cp.hourly_rate_min, cp.hourly_rate_max, cp.is_verified,
  cp.background_check_status, cp.rating, cp.review_count, cp.created_at,
  cp.availability_type, cp.overnight_ok, cp.last_active_at,
  jsonb_build_object(
    'id',           u.id,
    'display_name', public.display_name(u.first_name, u.last_name, u.full_name),
    'avatar_url',   u.avatar_url,
    'city',         u.city,
    'state',        u.state
  ) AS users
FROM public.caregiver_profiles cp
JOIN public.users u ON u.id = cp.user_id
WHERE coalesce(u.is_banned, false) = false
  AND coalesce(u.is_shadow_banned, false) = false;


-- =====================================================================
-- §3  family_profiles: withhold the intake blob and the private setting.
--
--   onboarding_answers — childcare_budget, zipcode, city, state,
--     extra_details, every answer the household gave. A column grant
--     cannot reach INSIDE a jsonb, so the column is withheld whole and
--     the two keys a caregiver legitimately needs (languages,
--     children_ages) are served as real columns by family_public.
--   auto_replies — a household's private setting. Nothing consumes it.
--
--   family_name, about, num_children, children_ages, has_pets and
--   languages stay granted: all are things a MATCHED caregiver may see,
--   and §1 is what keeps an unmatched one away.
-- =====================================================================

DO $$
DECLARE
  cols text;
  denied CONSTANT text[] := ARRAY['onboarding_answers', 'auto_replies'];
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'family_profiles'
    AND NOT (column_name = ANY (denied));

  IF cols IS NULL THEN
    RAISE EXCEPTION 'public.family_profiles has no grantable columns — aborting';
  END IF;

  REVOKE SELECT ON public.family_profiles FROM authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.family_profiles TO authenticated', cols);

  RAISE NOTICE 'family_profiles → authenticated may read: %', cols;
  RAISE NOTICE 'family_profiles → withheld: %', array_to_string(denied, ', ');
END $$;

-- INSERT/UPDATE untouched on both tables. The *_insert_self and
-- *_update_own policies already scope writes to the caller's own row, and a
-- write privilege does not imply a read privilege on the same column —
-- which is why onboarding still writes onboarding_answers, the profile page
-- still saves auto_replies, and registration still writes first/last/full.

COMMIT;


-- =====================================================================
-- VERIFICATION — runs after COMMIT.
-- =====================================================================

-- A. The six withheld user columns reach no client role. Expect ZERO rows.
SELECT grantee, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'users'
  AND grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT'
  AND column_name IN ('email','phone','zipcode','ban_reason','full_name','last_name')
ORDER BY grantee, column_name;

-- B. first_name survived — "Sarah C." needs it. Expect one row.
SELECT grantee, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'users'
  AND grantee = 'authenticated' AND privilege_type = 'SELECT'
  AND column_name = 'first_name';

-- C. The two withheld household columns. Expect ZERO rows.
SELECT grantee, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'family_profiles'
  AND grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT'
  AND column_name IN ('onboarding_answers', 'auto_replies')
ORDER BY grantee, column_name;

-- C2. caregiver_public's nested object after this file. Expect FIVE keys,
--     with full_name GONE: avatar_url, city, display_name, id, state.
SELECT DISTINCT jsonb_object_keys(users) AS remaining_key
FROM public.caregiver_public ORDER BY 1;

-- D. No TABLE-level SELECT lingers on either — one re-admits every column.
--    Expect ZERO rows.
SELECT table_name, grantee
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('users', 'family_profiles')
  AND grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT';

-- E. The pre-match arm is gone from both places. Expect ZERO rows each.
SELECT polname FROM pg_policy
WHERE polrelid = 'public.family_profiles'::regclass
  AND pg_get_expr(polqual, polrelid) ILIKE '%family_has_open_request%';

SELECT proname FROM pg_proc
WHERE proname = 'can_view_user'
  AND pg_get_functiondef(oid) ILIKE '%family_has_open_request%';

-- F. information_schema filters by current role and can under-report; the
--    catalogs do not. Expect: false, false, true, false, true.
SELECT has_column_privilege('authenticated','public.users','full_name','SELECT')                  AS full_name,
       has_column_privilege('authenticated','public.users','last_name','SELECT')                  AS last_name,
       has_column_privilege('authenticated','public.users','first_name','SELECT')                 AS first_name,
       has_column_privilege('authenticated','public.family_profiles','onboarding_answers','SELECT') AS intake,
       has_table_privilege ('authenticated','public.family_public','SELECT')                      AS fam_public;

-- G. End-to-end, as real sessions. The SQL Editor runs as superuser and
--    cannot show this — run `npm run rls:check`, PHASE 6, plus the
--    verbatim page-select assertions added to PHASES 2 and 3.


-- =====================================================================
-- ROLLBACK
--
--   GRANT SELECT ON public.users           TO authenticated;
--   GRANT SELECT ON public.family_profiles TO authenticated;
--   GRANT SELECT (full_name) ON public.users TO anon;
--
--   DROP POLICY IF EXISTS family_profiles_select ON public.family_profiles;
--   CREATE POLICY family_profiles_select ON public.family_profiles
--     FOR SELECT TO authenticated
--     USING (
--       user_id = auth.uid()
--       OR public.is_ruah_admin()
--       OR public.shares_match_with_family(id)
--       OR (public.current_user_role() = 'caregiver'
--           AND public.family_has_open_request(id))
--     );
--
--   -- plus restore the household arm inside can_view_user(); the
--   -- pre-2026-09-13 body is in 20260804020000_rls_consolidated.sql.
--
-- This re-opens both the surname and the pre-match exposure.
-- =====================================================================
