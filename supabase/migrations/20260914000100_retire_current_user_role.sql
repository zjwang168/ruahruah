-- =====================================================================
-- STEP 2 of 2 — retire current_user_role() from RLS.
--
-- ⚠  RUN ORDER MATTERS:
--      1. supabase/migrations/20260914000000_two_profiles_per_account.sql
--      2. deploy the application commit
--      3. THIS FILE
--
--    Unlike the two grant migrations before it, running this early breaks
--    nothing that is deployed today — no column is withheld and the new
--    predicates are TRUE for every single-role account exactly where the
--    old ones were. The order is kept because the application commit is
--    what makes a two-profile account reachable, and this file is what
--    makes one SAFE: without it, a person holding both profiles reads
--    Ruah's reports about herself the moment she has them.
--
-- Two policies. Both were asked about the PERSON; both are now asked
-- about the CAPABILITY or the MATCH, which is correct for everyone,
-- including the 27 single-role accounts that exist today.
--
-- Idempotent. Safe to re-run. One transaction.
-- =====================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_family_on_match'
  ) THEN
    RAISE EXCEPTION 'run 20260914000000_two_profiles_per_account.sql first, and deploy, before this file';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'caregiver_profiles_user_id_key') THEN
    RAISE EXCEPTION 'caregiver_profiles_user_id_key is missing — run 20260914000000 first';
  END IF;
END $$;


-- =====================================================================
-- §1  service_requests_select — open requests are for anyone who can
--     act as a caregiver, not for anyone whose sign-up role says so.
--
--     Capability, not the side currently shown. Gating on the cookie's
--     side would be no security at all (one click flips it) and would
--     make a query return empty after a switch, which is the failure
--     nobody can diagnose.
-- =====================================================================

DROP POLICY IF EXISTS service_requests_select ON public.service_requests;

CREATE POLICY service_requests_select ON public.service_requests
  FOR SELECT TO authenticated
  USING (
    family_id = public.my_family_profile_id()
    OR public.is_ruah_admin()
    OR (status = 'open' AND public.my_caregiver_profile_id() IS NOT NULL)
    OR public.caregiver_has_match_on_request(id)
  );


-- =====================================================================
-- §2  messages_select_audience — the family arm asks about THE MATCH.
--
--     Ruah's outreach to a caregiver carries the household's user id as
--     sender; Ruah's reports TO a household ABOUT a caregiver carry the
--     caregiver's user id as sender. The arm that lets a sender read a
--     Ruah message therefore has to mean "I am the household on this
--     match", never "I am a household". A person holding both profiles
--     is a household on some matches and the caregiver on others, and on
--     the latter the reports are about her.
--
--     Only 3 of 81 messages have no match_id, all human-written, all
--     admitted by the first arm regardless — checked on 2026-09-14.
-- =====================================================================

DROP POLICY IF EXISTS messages_select_audience ON public.messages;

CREATE POLICY messages_select_audience ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.is_ruah_admin()
    OR (
      (sender_id = auth.uid() OR receiver_id = auth.uid())
      AND (
        NOT (coalesce(sender_type, '') = 'ruah' OR coalesce(is_ai, false))
        OR receiver_id = auth.uid()
        OR (sender_id = auth.uid() AND public.is_family_on_match(match_id))
      )
    )
  );

-- current_user_role() itself stays defined. Nothing reads it any more; a
-- later cleanup can drop it once the grants file that lists it is revised.

COMMIT;


-- =====================================================================
-- VERIFICATION — runs after COMMIT.
-- =====================================================================

-- A. No policy reads current_user_role() any more. Expect ZERO rows.
--    (This same query returned 2 rows after STEP 1.)
SELECT polrelid::regclass AS table_name, polname
FROM pg_policy
WHERE pg_get_expr(polqual, polrelid) ILIKE '%current_user_role%';

-- B. The two policies exist and carry the new predicates. Expect two rows,
--    one mentioning my_caregiver_profile_id, one is_family_on_match.
SELECT polrelid::regclass AS table_name, polname,
       pg_get_expr(polqual, polrelid) ILIKE '%my_caregiver_profile_id%' AS capability_arm,
       pg_get_expr(polqual, polrelid) ILIKE '%is_family_on_match%'      AS match_arm
FROM pg_policy
WHERE polname IN ('service_requests_select', 'messages_select_audience')
ORDER BY 1;

-- C. End-to-end, as real sessions: `npm run rls:check`. PHASE 7 is armed
--    the moment one account holds both profiles; until then it reports
--    itself as skipped rather than as passing.


-- =====================================================================
-- ROLLBACK — the pre-2026-09-14 bodies are in
-- 20260804020000_rls_consolidated.sql (§8 service_requests, §10 messages).
-- =====================================================================
