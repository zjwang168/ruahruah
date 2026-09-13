-- =====================================================================
-- STEP 2 of 2 — close the pre-match household exposure.
--
-- ⚠  RUN ORDER MATTERS. Do all three, in order:
--      1. supabase/migrations/20260913000000_family_views.sql   (additive)
--      2. deploy the application commit                         (reads views)
--      3. THIS FILE                                             (revoke)
--    Running this before the deploy empties the caregiver job board and
--    silently blanks the household intake on four admin pages.
--
-- Two independent changes, in one transaction:
--
--   §1  ROW access. Deletes the pre-match arm from
--       family_profiles_select and its mirror from can_view_user(). This
--       is the actual fix — a caregiver who has not matched with a
--       household can no longer reach its row at all, through either
--       table. The job board reads family_public instead.
--
--   §2  COLUMN access. Withholds onboarding_answers and auto_replies from
--       `authenticated` on the base table. This is a SECOND layer, and it
--       covers the rows a caregiver can still reach AFTER matching, plus
--       the standing blanket grant that made the users bug possible.
--
-- Either one alone would be defensible. Both, because §1 protects the
-- pre-match case and §2 protects everything downstream of it, including
-- whatever policy arm someone adds next year.
--
-- Idempotent. Safe to re-run. One transaction.
-- =====================================================================

BEGIN;

-- Refuse to run before step 1.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('family_public', 'family_self', 'family_admin')
      AND c.relkind = 'v'
    GROUP BY true HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION
      'run 20260913000000_family_views.sql first, and deploy the application, before this file';
  END IF;
END $$;


-- =====================================================================
-- §1a  can_view_user() — drop the "family advertising work" arm.
--
--   BEFORE: a caregiver could read the `users` row of any household with
--   an open request, which is where the job board got full_name from and
--   then abbreviated it in the browser. family_public.display_name now
--   carries the abbreviation, computed in Postgres.
--
--   The caregiver arm is left ALONE. A caregiver's own row stays public
--   because the public profile page is public by design, and
--   caregiver_public is how that is served.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.can_view_user(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    target = auth.uid()
    -- any caregiver's row: the public profile page is public by design
    OR EXISTS (SELECT 1 FROM public.caregiver_profiles cp WHERE cp.user_id = target)
    -- a family the caller has ACTUALLY MATCHED WITH. Advertising work no
    -- longer admits a stranger to the household's row; the job board reads
    -- public.family_public, which carries an abbreviated name and no
    -- contact detail of any kind.
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
-- §1b  family_profiles_select — drop the same arm on the profile table.
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
-- §2  family_profiles: reset `authenticated` and re-grant all but two.
--
--   onboarding_answers — the raw intake blob: childcare_budget, zipcode,
--     city, state, extra_details, and every answer the household gave.
--     A column grant cannot reach INSIDE a jsonb, so the column is
--     withheld whole and the two keys a caregiver legitimately needs
--     (languages, children_ages) are served as real columns by
--     family_public.
--   auto_replies — a household's private setting. Nothing consumes it
--     (see the known-open list in CLAUDE.md); it should certainly not be
--     legible to the other side of the marketplace.
--
--   Everything else stays granted. family_name, about, num_children,
--   children_ages, has_pets and languages are all things a MATCHED
--   caregiver may see, and §1 is what keeps an unmatched one away.
--
--   Computed, not hand-listed, for the same reason as the users fix: a
--   column added later is granted by default and only the two named ones
--   are withheld, so re-running after a schema change stays correct.
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
    RAISE EXCEPTION 'public.family_profiles has no grantable columns — aborting rather than locking the table';
  END IF;

  -- A column-level REVOKE cannot subtract from a table-level GRANT, so the
  -- table-level grant has to go first. Both statements are in one
  -- transaction, so `authenticated` is never left holding nothing.
  REVOKE SELECT ON public.family_profiles FROM authenticated;
  EXECUTE format('GRANT SELECT (%s) ON public.family_profiles TO authenticated', cols);

  RAISE NOTICE 'family_profiles → authenticated may read: %', cols;
  RAISE NOTICE 'family_profiles → withheld: %', array_to_string(denied, ', ');
END $$;

-- INSERT/UPDATE are untouched. family_profiles_insert_self and
-- family_profiles_update_own already scope writes to the caller's own row,
-- and a write privilege does not imply a read privilege on the same column
-- — which is why the profile page can still SAVE auto_replies and the
-- onboarding flow can still write onboarding_answers.

COMMIT;


-- =====================================================================
-- VERIFICATION — runs after COMMIT.
-- =====================================================================

-- A. The two withheld columns are granted to NO client role. Expect ZERO rows.
SELECT grantee, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'family_profiles'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'SELECT'
  AND column_name IN ('onboarding_answers', 'auto_replies')
ORDER BY grantee, column_name;

-- B. authenticated still holds the rest — expect id, user_id, family_name,
--    num_children, children_ages, has_pets, languages, about, created_at.
SELECT string_agg(column_name, ', ' ORDER BY column_name) AS granted_to_authenticated
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'family_profiles'
  AND grantee = 'authenticated' AND privilege_type = 'SELECT';

-- C. No TABLE-level SELECT lingers — one would re-admit every column.
--    Expect ZERO rows.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'family_profiles'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'SELECT';

-- D. The pre-match arm is gone from both places. Expect ZERO rows each.
SELECT polname FROM pg_policy
WHERE polrelid = 'public.family_profiles'::regclass
  AND pg_get_expr(polqual, polrelid) ILIKE '%family_has_open_request%';

SELECT proname FROM pg_proc
WHERE proname = 'can_view_user'
  AND pg_get_functiondef(oid) ILIKE '%family_has_open_request%';

-- E. information_schema filters by the current role and can under-report.
--    The catalogs do not. After this file: false, true, true.
SELECT has_column_privilege('authenticated','public.family_profiles','onboarding_answers','SELECT') AS oa,
       has_column_privilege('authenticated','public.family_profiles','children_ages','SELECT')      AS ages,
       has_table_privilege ('authenticated','public.family_public','SELECT')                        AS fam_public;

-- F. End-to-end, as real sessions. The SQL Editor runs as superuser and
--    cannot show this — run `npm run rls:check`, PHASE 6:
--
--      caregiver SELECT family_profiles(onboarding_answers) → 42501
--      caregiver SELECT family_profiles of an unmatched household → 0 rows
--      caregiver SELECT family_public → rows, display_name 'Sarah C.'
--      family_public carries no full_name / zipcode / onboarding_answers
--      family SELECT family_self → exactly 1 row, its own, whole
--      non-admin SELECT family_admin → 0 rows
--      admin family_admin embeds under users_admin (four admin pages)


-- =====================================================================
-- ROLLBACK
--
--   GRANT SELECT ON public.family_profiles TO authenticated;
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
--   -- plus restore the family arm inside can_view_user(); the pre-2026-09-13
--   -- body is in 20260804020000_rls_consolidated.sql.
--
-- This re-opens the pre-match exposure.
-- =====================================================================
