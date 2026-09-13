-- =====================================================================
-- STEP 1 of 2 — the three family views. PURELY ADDITIVE: run this whenever.
--
-- Nothing existing changes. No grant is revoked, no policy is touched, no
-- query that works today stops working. It only adds the read paths that
-- STEP 2 will depend on. Same split, and the same reason, as the
-- 20260805 user_views / users_column_grants pair:
--
--   1. run THIS file            (additive — old code unaffected)
--   2. deploy the application   (new code reads these views)
--   3. run 20260913000100       (revoke + drop the pre-match row arm)
--
-- Between 1 and 3 both the old and the new code work, so the deploy can
-- take as long as it takes and a rollback at any point is safe.
--
-- ── WHAT IS BEING FIXED ──────────────────────────────────────────────
-- family_profiles_select carries a pre-match arm:
--
--     OR (current_user_role() = 'caregiver' AND family_has_open_request(id))
--
-- and can_view_user() carries the mirror of it for the family's `users`
-- row. Together, ANY caregiver-role account reads the WHOLE row of ANY
-- family that has an open request — family_name, about, children_ages,
-- auto_replies, and onboarding_answers, which carries childcare_budget,
-- zipcode, city, state and extra_details.
--
-- The founder's rule, 2026-09-13: before a match a caregiver may see the
-- REQUEST (care type, schedule, languages, area, age ranges) and nothing
-- that identifies the household — no name, phone, email or street address.
-- Contact details are handed over by Ruah after the match is confirmed.
--
-- ── WHY THIS IS NOT A COLUMN GATE ON ITS OWN ─────────────────────────
-- The one pre-match reader is the caregiver job board, which selects
--
--     family_profiles ( id, onboarding_answers, user_id )
--
-- and NEVER READS onboarding_answers — the string appears once in that
-- file, in the select. So the pre-match arm buys the product nothing, and
-- STEP 2 deletes the row access outright rather than trimming columns off
-- it. Removing an arm is stronger than narrowing one: there is no column
-- list to keep in sync as the table grows.
--
-- The column grant in STEP 2 is a second, independent layer, for the rows
-- a caregiver can still reach AFTER matching.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

BEGIN;

-- =====================================================================
-- abbreviate_name — 'Sarah Chen' -> 'Sarah C.'
--
--   The job board already rendered an abbreviated name; it just did the
--   abbreviating in the BROWSER, which means the full legal name of every
--   family with an open request was shipped to every caregiver looking at
--   the board and then thrown away by the formatter. Same shape as the
--   zipcode the distance chip used to need. Doing it here means the full
--   name never leaves Postgres.
--
--   IMMUTABLE: depends only on its argument, so it is inlinable and may
--   be used in a view.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.abbreviate_name(full_name text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  -- Collapse runs of whitespace once, then work off that. The last word is
  -- taken with a greedy regexp rather than split_part(..., -1): negative
  -- indexes need PG14, and nothing else in this repo pins a server version.
  WITH n AS (
    SELECT nullif(btrim(regexp_replace(full_name, '\s+', ' ', 'g')), '') AS s
  )
  SELECT CASE
    WHEN n.s IS NULL THEN NULL

    -- A Han name carries the surname FIRST and is written without spaces,
    -- so the Latin rule below would fall through to "one word, keep it
    -- whole" and publish 李明华 intact — the exact thing this function
    -- exists to prevent, for the half of the market the product is built
    -- for. The surname alone is the same granularity a Latin initial
    -- gives: 李明华 -> 李.
    WHEN strpos(n.s, ' ') = 0 AND n.s ~ '[一-鿿]' THEN left(n.s, 1)

    -- One Latin word stays whole: "Madonna" has no surname to reduce, and
    -- "M." would be less recognisable rather than more private.
    WHEN strpos(n.s, ' ') = 0 THEN n.s

    -- First name, then the initial of the LAST word: "Ana María Ruiz"
    -- gives "Ana R.", not "Ana M.".
    ELSE split_part(n.s, ' ', 1)
         || ' '
         || upper(left(regexp_replace(n.s, '^.* ', ''), 1))
         || '.'
  END
  FROM n;
$$;

REVOKE EXECUTE ON FUNCTION public.abbreviate_name(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.abbreviate_name(text) TO anon, authenticated;


-- =====================================================================
-- family_public — what a CAREGIVER may see about a household.
--
--   security_invoker = false so the WHERE clause is the gate, exactly as
--   in caregiver_public and user_self. This is the mirror of
--   caregiver_public: one side browses the other through a view, never
--   through the base table.
--
--   NOT INCLUDED, deliberately:
--     users.full_name   — display_name carries the abbreviation instead
--     users.zipcode     — see the note below
--     family_name, about, onboarding_answers, auto_replies
--
--   ⚠ ZIPCODE. The rule says a caregiver may see the area "down to zip
--   level". This view stops at city/state and does NOT carry the zipcode,
--   reading that as a CEILING on precision rather than an instruction to
--   publish it. Shipping the zipcode here would undo 20260805 and
--   /api/request-distances, which exist precisely so a family's home
--   zipcode never reaches a caregiver's browser; the board already shows
--   distance in whole miles computed server-side. If the intent really is
--   to show the zip, add `u.zipcode` to the select list — one line — and
--   /api/request-distances becomes redundant.
-- =====================================================================

DROP VIEW IF EXISTS public.family_public;

CREATE VIEW public.family_public
WITH (security_invoker = false) AS
SELECT
  fp.id,
  fp.user_id,
  public.abbreviate_name(u.full_name) AS display_name,
  u.avatar_url,
  u.city,
  u.state,
  fp.languages,
  fp.num_children,
  fp.children_ages
FROM public.family_profiles fp
JOIN public.users u ON u.id = fp.user_id
WHERE
  -- a banned or shadow-banned household is not browsable, the same rule
  -- caregiver_public applies in the other direction
  coalesce(u.is_banned, false) = false
  AND coalesce(u.is_shadow_banned, false) = false
  AND (
    public.is_ruah_admin()
    OR public.shares_match_with_family(fp.id)
    OR (public.current_user_role() = 'caregiver'
        AND public.family_has_open_request(fp.id))
  );

REVOKE ALL   ON public.family_public FROM anon, authenticated;
GRANT SELECT ON public.family_public TO authenticated;


-- =====================================================================
-- family_self — the caller's own household row, whole.
--
--   STEP 2 withholds onboarding_answers and auto_replies from
--   `authenticated`. Seven client reads want them on the caller's OWN row
--   (the six family pages plus /api/chat, which builds Ruah's system
--   prompt from the household's intake answers through the SESSION
--   client, not the service role). They all move here.
-- =====================================================================

DROP VIEW IF EXISTS public.family_self;

CREATE VIEW public.family_self
WITH (security_invoker = false) AS
SELECT * FROM public.family_profiles WHERE user_id = auth.uid();

REVOKE ALL   ON public.family_self FROM anon, authenticated;
GRANT SELECT ON public.family_self TO authenticated;


-- =====================================================================
-- family_admin — every household row, whole, for the admin console.
--
--   Isomorphic to users_admin. is_ruah_admin() mirrors
--   src/lib/admin/emails.ts — CHANGE ONE, CHANGE THE OTHER.
--
--   ⚠ THE EMBED QUESTION, AGAIN. Four admin pages read the household
--   intake as a NESTED resource hanging off users_admin:
--
--       users_admin ( ..., family_profiles ( onboarding_answers ) )
--
--   Once STEP 2 lands, that embed resolves to the BASE table and the
--   column is gone, so it returns null rather than erroring — the silent
--   failure mode. Those four pages must embed family_admin instead, and
--   whether PostgREST resolves a view-to-view embed through the
--   underlying users -> family_profiles foreign key is exactly the class
--   of thing that cannot be settled by reading the repo. PHASE 6 of
--   scripts/rls-regression.mjs asserts it. Run `npm run rls:check`.
-- =====================================================================

DROP VIEW IF EXISTS public.family_admin;

CREATE VIEW public.family_admin
WITH (security_invoker = false) AS
SELECT * FROM public.family_profiles WHERE public.is_ruah_admin();

REVOKE ALL   ON public.family_admin FROM anon, authenticated;
GRANT SELECT ON public.family_admin TO authenticated;

COMMIT;


-- =====================================================================
-- VERIFICATION — runs after COMMIT.
-- =====================================================================

-- A. All three views exist and are readable by authenticated only.
--    Expect three rows, grantee `authenticated`.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('family_public', 'family_self', 'family_admin')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

-- B. None of them is security_invoker — that would apply the caller's own
--    RLS to the base read and defeat the point.
SELECT c.relname, c.reloptions
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('family_public', 'family_self', 'family_admin');

-- C. The abbreviation behaves. Expect, in order:
--      Sarah C. | Madonna | Ana R. | 李 | 李 明. | (null)
SELECT public.abbreviate_name('Sarah Chen')          AS two_part,
       public.abbreviate_name('Madonna')             AS one_part,
       public.abbreviate_name('  Ana  María  Ruiz ') AS messy_spacing,
       public.abbreviate_name('李明华')               AS han_no_space,
       public.abbreviate_name('李 明华')              AS han_spaced,
       public.abbreviate_name('   ')                 AS blank;

-- D. family_public leaks no full name. Expect ZERO rows.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'family_public'
  AND column_name IN ('full_name', 'zipcode', 'onboarding_answers',
                      'auto_replies', 'family_name', 'about');

-- E. Nothing was taken away by this file. `authenticated` should STILL
--    hold a table-level SELECT on family_profiles — step 2 removes it.
--    Expect one row.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'family_profiles'
  AND grantee = 'authenticated' AND privilege_type = 'SELECT';


-- =====================================================================
-- ROLLBACK (only before step 2 — after it, this breaks the family pages
-- and the admin console):
--
--   DROP VIEW IF EXISTS public.family_public;
--   DROP VIEW IF EXISTS public.family_self;
--   DROP VIEW IF EXISTS public.family_admin;
--   DROP FUNCTION IF EXISTS public.abbreviate_name(text);
-- =====================================================================
