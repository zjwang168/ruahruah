-- =====================================================================
-- STEP 1 of 2 — one account, two profiles.
--
-- PURELY ADDITIVE. No grant is revoked, no policy is rewritten, and
-- `users.role` is not touched. Everything running today still runs after
-- this file. Same three-beat sequence as 20260805 and 20260913:
--
--   1. run THIS file            (additive)
--   2. deploy the application   (capability-based routing, role switcher)
--   3. run 20260914000100       (swap the two policies, retire
--                                current_user_role() from RLS)
--
-- ── WHAT CHANGES, AND WHAT DOES NOT ──────────────────────────────────
-- A person can already hold a family_profiles row AND a caregiver_profiles
-- row: my_family_profile_id() and my_caregiver_profile_id() each look up
-- their own table by user_id and neither consults `users.role`. The model
-- was there; nothing in the product let anyone reach it.
--
-- What blocks it is `users.role` being a single column that RLS reads
-- through current_user_role(). After 20260913000100 deleted the two
-- pre-match arms, only TWO live policies still read it:
--
--   service_requests_select    status='open' AND current_user_role()='caregiver'
--   messages_select_audience   sender_id=auth.uid() AND current_user_role()='family'
--
-- STEP 2 replaces both. This file builds what they will need.
--
-- `users.role` survives as "which side did this person sign up as". It
-- stops deciding anything. The side a person is CURRENTLY looking at is a
-- cookie, like the locale — the proxy can read it, switching costs no
-- round trip, and it is per-device, which is the honest model for someone
-- who is a family on their phone and a caregiver on their laptop.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

BEGIN;

-- =====================================================================
-- §1  One profile of each kind per person.
--
--   my_family_profile_id() is a SCALAR subquery. A second row for the
--   same user does not return the newer one — it raises
--   "more than one row returned by a subquery", inside a SECURITY DEFINER
--   function, inside an RLS policy, which is about the worst place in this
--   system to discover a data problem. The constraint is what makes the
--   two-profile model safe rather than merely possible.
--
--   Checked first: 18 family rows across 18 users, 9 caregiver rows across
--   9 users, no duplicates and nobody holding both yet. The ALTER cannot
--   fail on today's data; the pre-check is for whoever re-runs this later.
-- =====================================================================

DO $$
DECLARE
  dupes int;
BEGIN
  SELECT count(*) INTO dupes FROM (
    SELECT user_id FROM public.family_profiles
    WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1
  ) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION
      'family_profiles has % user(s) with more than one row — merge them before adding the constraint', dupes;
  END IF;

  SELECT count(*) INTO dupes FROM (
    SELECT user_id FROM public.caregiver_profiles
    WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1
  ) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION
      'caregiver_profiles has % user(s) with more than one row — merge them before adding the constraint', dupes;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'family_profiles_user_id_key'
  ) THEN
    ALTER TABLE public.family_profiles
      ADD CONSTRAINT family_profiles_user_id_key UNIQUE (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'caregiver_profiles_user_id_key'
  ) THEN
    ALTER TABLE public.caregiver_profiles
      ADD CONSTRAINT caregiver_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;


-- =====================================================================
-- §2  is_family_on_match — "am I the household on THIS match?"
--
--   The arm it replaces asks a question about the PERSON:
--
--     sender_id = auth.uid() AND current_user_role() = 'family'
--
--   which exists because a Ruah message to a caregiver carries the
--   household's user id as sender, while a Ruah report ABOUT a caregiver,
--   written to the household, carries the CAREGIVER's user id as sender.
--   Probing once found four such reports readable by the caregiver they
--   concerned; the arm is what closed that.
--
--   Asked about the person, it breaks the moment one person is both. A
--   user holding both profiles satisfies "I am a family" even on a match
--   where she is the caregiver — and would read the reports written about
--   her. Asked about the MATCH, it is correct for everyone, including the
--   single-role accounts that exist today. This is a better rule than the
--   one it replaces, not a compatibility shim.
--
--   SECURITY DEFINER for the usual reason: matches and service_requests
--   are both RLS-protected, and an inline EXISTS across them recurses.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_family_on_match(mid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    JOIN public.service_requests sr ON sr.id = m.request_id
    WHERE m.id = mid
      AND sr.family_id = public.my_family_profile_id()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_family_on_match(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.is_family_on_match(uuid) TO authenticated;


-- =====================================================================
-- §3  user_self carries both profile ids.
--
--   The proxy routes on CAPABILITY now — "does a caregiver profile exist"
--   rather than "what does users.role say" — and it already reads
--   user_self once per request. Two scalar subqueries there cost one
--   round trip; two extra queries from the proxy would cost two.
--
--   CREATE OR REPLACE, not DROP and CREATE: `u.*` expands to exactly the
--   columns the view has today, in the same order, and the two new ones
--   are appended. Postgres allows adding columns at the END of a view's
--   list, so no grant is reissued and no session sees a gap.
--
--   Safe for the twenty `select('*')` call sites: every one of them ends
--   in setUser(userData), and nothing in the tree writes a user row back
--   from that object — checked before writing this. Two extra fields are
--   ignored by code that does not ask for them.
-- =====================================================================

CREATE OR REPLACE VIEW public.user_self
WITH (security_invoker = false) AS
SELECT
  u.*,
  (SELECT fp.id FROM public.family_profiles fp    WHERE fp.user_id = u.id) AS family_profile_id,
  (SELECT cp.id FROM public.caregiver_profiles cp WHERE cp.user_id = u.id) AS caregiver_profile_id
FROM public.users u
WHERE u.id = auth.uid();

COMMIT;


-- =====================================================================
-- VERIFICATION — runs after COMMIT.
-- =====================================================================

-- A. Both constraints exist. Expect two rows.
SELECT conrelid::regclass AS table_name, conname
FROM pg_constraint
WHERE conname IN ('family_profiles_user_id_key', 'caregiver_profiles_user_id_key')
ORDER BY 1;

-- B. The helper exists and authenticated may call it. Expect one row.
SELECT p.proname, p.prosecdef AS security_definer,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS callable
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'is_family_on_match';

-- C. user_self gained exactly two columns, at the end. Expect the users
--    columns in order, then family_profile_id, then caregiver_profile_id.
SELECT ordinal_position, column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_self'
ORDER BY ordinal_position;

-- D. Nothing was taken away. `users.role` still exists and is still
--    granted — STEP 2 does not touch it either. Expect one row.
SELECT grantee, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'users'
  AND grantee = 'authenticated' AND privilege_type = 'SELECT'
  AND column_name = 'role';

-- E. The two policies STEP 2 will rewrite are still on the old predicate.
--    Expect two rows, both mentioning current_user_role.
SELECT polrelid::regclass AS table_name, polname
FROM pg_policy
WHERE pg_get_expr(polqual, polrelid) ILIKE '%current_user_role%'
ORDER BY 1;

-- F. End-to-end, as real sessions: `npm run rls:check`. PHASE 6 runs every
--    browser-side select as written, and picks up the two new columns on
--    user_self without anything being added by hand.


-- =====================================================================
-- ROLLBACK (only before step 2):
--
--   CREATE OR REPLACE VIEW public.user_self
--   WITH (security_invoker = false) AS
--   SELECT * FROM public.users WHERE id = auth.uid();
--
--   DROP FUNCTION IF EXISTS public.is_family_on_match(uuid);
--
--   ALTER TABLE public.family_profiles    DROP CONSTRAINT IF EXISTS family_profiles_user_id_key;
--   ALTER TABLE public.caregiver_profiles DROP CONSTRAINT IF EXISTS caregiver_profiles_user_id_key;
--
--   The constraints are worth keeping either way — nothing in the product
--   has ever wanted two profiles of one kind for one person.
-- =====================================================================
