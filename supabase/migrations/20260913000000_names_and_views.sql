-- =====================================================================
-- STEP 1 of 2 — split names, and build every view that reads them.
--
-- PURELY ADDITIVE. Nothing is revoked, no policy changes, every query
-- that works today still works after it. Same three-beat sequence the
-- 20260805 users fix used:
--
--   1. run THIS file            (additive — old code unaffected)
--   2. deploy the application   (reads the views, writes first/last)
--   3. run 20260913000100       (revoke + drop the pre-match arms)
--
-- ── WHAT THIS IS FOR ─────────────────────────────────────────────────
-- Two problems, one shape.
--
-- A. NAMES. `users` carries a single `full_name`, and the job board
--    shipped it whole to every caregiver and then abbreviated it in the
--    BROWSER. Founder's rule, 2026-09-13: each side sees "First L." and
--    the full surname never leaves Postgres. Registration will require a
--    Latin first and last name as separate fields, so the abbreviation
--    becomes a projection rather than a guess.
--
-- B. HOUSEHOLDS. family_profiles_select carries a pre-match arm:
--
--      OR (current_user_role() = 'caregiver' AND family_has_open_request(id))
--
--    and can_view_user() carries its mirror. Together, ANY caregiver-role
--    account reads the WHOLE row of ANY household with an open request —
--    including onboarding_answers, which holds childcare_budget, zipcode
--    and every intake answer. STEP 2 deletes both arms; this file builds
--    the view that replaces the one legitimate read.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

BEGIN;

-- =====================================================================
-- §1  users.first_name / users.last_name
--
--   Nullable on purpose. 18 of 26 existing rows cannot be split — 15 are
--   a single word ('Mango', 'Jialiang') and 3 are digits ('123456') —
--   and the founder's call is to leave them alone rather than invent a
--   surname. NOT NULL would fail on contact with the table.
-- =====================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name  text;


-- =====================================================================
-- §2  Backfill the rows that CAN be split.
--
--   Latin, two or more words: 'Shirley Lawson' -> ('Shirley','Lawson'),
--   'Ana María Ruiz' -> ('Ana','Ruiz'). Everything else is skipped and
--   stays NULL. Only touches rows not already split, so re-running is a
--   no-op rather than a second pass.
-- =====================================================================

WITH splittable AS (
  SELECT id, btrim(regexp_replace(full_name, '\s+', ' ', 'g')) AS n
  FROM public.users
  WHERE full_name IS NOT NULL
)
UPDATE public.users u
SET first_name = split_part(s.n, ' ', 1),
    last_name  = regexp_replace(s.n, '^.* ', '')
FROM splittable s
WHERE u.id = s.id
  AND u.first_name IS NULL
  AND u.last_name  IS NULL
  AND strpos(s.n, ' ') > 0
  AND s.n ~ '^[A-Za-z][A-Za-z''’ .-]*$';


-- =====================================================================
-- §3  The shape of a name, from here on.
--
--   NOT VALID so the 18 rows above are grandfathered: Postgres enforces
--   this on every INSERT and UPDATE from now on and never rechecks what
--   is already stored. Run
--
--     ALTER TABLE public.users VALIDATE CONSTRAINT users_latin_name_ck;
--
--   once those rows are cleaned up, and the grandfathering ends.
--
--   The character class is Latin letters plus the punctuation real names
--   carry — apostrophe, hyphen, period, space (O'Brien, Anne-Marie,
--   Jr.). Han characters, Cyrillic and digits all fall outside it, which
--   is the point: the display rule is "First L.", and an initial is only
--   meaningful for a script that has them. The form validates the same
--   rule client-side so the error arrives before the round trip.
-- =====================================================================

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_latin_name_ck;

ALTER TABLE public.users ADD CONSTRAINT users_latin_name_ck CHECK (
  first_name IS NOT NULL
  AND last_name IS NOT NULL
  AND first_name ~ '^[A-Za-z][A-Za-z''’ .-]*$'
  AND last_name  ~ '^[A-Za-z][A-Za-z''’ .-]*$'
) NOT VALID;


-- =====================================================================
-- §4  abbreviate_name — the legacy fallback.
--
--   Only reached by rows that predate §1 and were never split. The Han
--   branch an earlier draft carried is GONE: §3 keeps Han characters out
--   of new names, and the 18 legacy rows are Latin or digits.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.abbreviate_name(full_name text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  WITH n AS (
    SELECT nullif(btrim(regexp_replace(full_name, '\s+', ' ', 'g')), '') AS s
  )
  SELECT CASE
    WHEN n.s IS NULL          THEN NULL
    WHEN strpos(n.s, ' ') = 0 THEN n.s
    ELSE split_part(n.s, ' ', 1)
         || ' '
         || upper(left(regexp_replace(n.s, '^.* ', ''), 1))
         || '.'
  END
  FROM n;
$$;


-- =====================================================================
-- §5  display_name — THE one definition, used by both browse views.
--
--   caregiver_public and family_public call this, so the two sides of the
--   marketplace cannot drift apart. Change the rule here and both move.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.display_name(
  first_name text, last_name text, full_name text
) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN nullif(btrim(first_name), '') IS NOT NULL
     AND nullif(btrim(last_name), '')  IS NOT NULL
      THEN btrim(first_name) || ' ' || upper(left(btrim(last_name), 1)) || '.'
    WHEN nullif(btrim(first_name), '') IS NOT NULL
      THEN btrim(first_name)
    ELSE public.abbreviate_name(full_name)
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.abbreviate_name(text)             FROM public;
REVOKE EXECUTE ON FUNCTION public.display_name(text, text, text)    FROM public;
GRANT  EXECUTE ON FUNCTION public.abbreviate_name(text)             TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.display_name(text, text, text)    TO anon, authenticated;


-- =====================================================================
-- §6  caregiver_public — ADD display_name. full_name stays, for now.
--
--   The nested object gains a `display_name` key. `full_name` STAYS, and
--   stays TRUTHFUL, for the length of the deploy. Code in production
--   reads row.users.full_name, and this file's contract is that nothing
--   working today changes — a key that suddenly answered "Sarah C." would
--   change the live site before the deploy that intends it, and would put
--   an abbreviation behind a key whose name promises otherwise.
--
--   20260913000100 removes the key, once the deploy has moved the three
--   readers (family/chat, search, api/match) onto display_name.
--
--   CREATE OR REPLACE, not DROP and CREATE: the key lives INSIDE a jsonb
--   VALUE, so the view's column list — 17 columns, `users` among them —
--   is byte-identical before and after. Nothing is dropped, no grant has
--   to be reissued, and no session sees a gap. (An earlier draft dropped
--   and recreated it on the theory that this was a column rename. It is
--   not.)
-- =====================================================================

CREATE OR REPLACE VIEW public.caregiver_public
WITH (security_invoker = false) AS
SELECT
  cp.id, cp.user_id, cp.bio, cp.years_experience, cp.languages, cp.services,
  cp.hourly_rate_min, cp.hourly_rate_max, cp.is_verified,
  cp.background_check_status, cp.rating, cp.review_count, cp.created_at,
  cp.availability_type, cp.overnight_ok, cp.last_active_at,
  -- Nested object, not flat columns, so callers keep reading row.users.*
  -- unchanged apart from the renamed key.
  jsonb_build_object(
    'id',           u.id,
    -- TRANSITIONAL, and deliberately the real name. Removed by
    -- 20260913000100 after the deploy. Until then this is what the
    -- currently-deployed code reads, and it must keep answering what it
    -- answered yesterday.
    'full_name',    u.full_name,
    'display_name', public.display_name(u.first_name, u.last_name, u.full_name),
    'avatar_url',   u.avatar_url,
    'city',         u.city,
    'state',        u.state
  ) AS users
FROM public.caregiver_profiles cp
JOIN public.users u ON u.id = cp.user_id
WHERE coalesce(u.is_banned, false) = false
  AND coalesce(u.is_shadow_banned, false) = false;

-- No REVOKE/GRANT pair here. CREATE OR REPLACE leaves the existing grants
-- on the view untouched, and reissuing them would only risk narrowing what
-- 20260804020000 already established.


-- =====================================================================
-- §6b  user_display — "who is this person", for anyone allowed to see them.
--
--   caregiver_public answers "browse the caregivers" and family_public
--   answers "who posted this job". Neither answers the third question the
--   product actually asks: the messages thread shows whoever is on the
--   other end, and that partner is a caregiver on some threads and a
--   household on others. The public caregiver profile page has the same
--   need. Without this view both would have to branch on role and query a
--   different view per branch.
--
--   The gate is can_view_user() — the SAME predicate the users SELECT
--   policies already use, so this view widens nothing. It only changes
--   WHICH COLUMNS come back: display_name instead of full_name, and no
--   contact details at all.
--
--   Granted to anon as well: can_view_user()'s caregiver arm is
--   unconditional, so a logged-out visitor sees exactly the caregiver rows
--   the anon policy already lets them see, and nothing else.
-- =====================================================================

DROP VIEW IF EXISTS public.user_display;

CREATE VIEW public.user_display
WITH (security_invoker = false) AS
SELECT
  u.id,
  public.display_name(u.first_name, u.last_name, u.full_name) AS display_name,
  u.first_name,
  u.avatar_url,
  u.city,
  u.state,
  u.role,
  u.is_banned,
  u.is_shadow_banned
FROM public.users u
WHERE public.can_view_user(u.id);

REVOKE ALL   ON public.user_display FROM anon, authenticated;
GRANT SELECT ON public.user_display TO anon, authenticated;


-- =====================================================================
-- §7  family_public — the mirror of caregiver_public.
--
--   What a CAREGIVER may see about a household before matching. The
--   WHERE clause is the gate (security_invoker = false), same
--   construction as caregiver_public and user_self.
--
--   NOT INCLUDED, deliberately: full_name, last_name, zipcode,
--   family_name, about, onboarding_answers, auto_replies.
--
--   ⚠ ZIPCODE. The rule allows area "down to zip level". This stops at
--   city/state, reading that as a CEILING rather than an instruction to
--   publish it — shipping the zip here would undo /api/request-distances,
--   which exists so a household's zipcode never reaches a caregiver's
--   browser, and the board already shows whole miles computed on the
--   server. Add `u.zipcode` to the select list if the intent is the
--   other one; the distance route then becomes redundant.
-- =====================================================================

DROP VIEW IF EXISTS public.family_public;

CREATE VIEW public.family_public
WITH (security_invoker = false) AS
SELECT
  fp.id,
  fp.user_id,
  public.display_name(u.first_name, u.last_name, u.full_name) AS display_name,
  u.avatar_url,
  u.city,
  u.state,
  fp.languages,
  fp.num_children,
  fp.children_ages
FROM public.family_profiles fp
JOIN public.users u ON u.id = fp.user_id
WHERE coalesce(u.is_banned, false) = false
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
-- §8  family_self / family_admin — own row, and the console.
--
--   ⚠ THE EMBED QUESTION, AGAIN. Four admin pages read the household
--   intake as a resource nested under users_admin:
--
--       users_admin ( ..., family_profiles ( onboarding_answers ) )
--
--   After STEP 2 that resolves to the BASE table with the column gone,
--   and PostgREST answers the WHOLE query with 42501 — which is exactly
--   how /family/matches and /family/dashboard went blank on 2026-09-13.
--   Those pages embed family_admin instead, and PHASE 6 of
--   scripts/rls-regression.mjs asserts it with the select copied verbatim
--   from the page.
-- =====================================================================

DROP VIEW IF EXISTS public.family_self;

CREATE VIEW public.family_self
WITH (security_invoker = false) AS
SELECT * FROM public.family_profiles WHERE user_id = auth.uid();

REVOKE ALL   ON public.family_self FROM anon, authenticated;
GRANT SELECT ON public.family_self TO authenticated;

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

-- A. The split. Expect roughly 8 split, 18 left NULL, 0 violating the
--    shape among those that WERE split.
SELECT count(*) FILTER (WHERE first_name IS NOT NULL)                    AS split,
       count(*) FILTER (WHERE first_name IS NULL)                        AS left_alone,
       count(*) FILTER (WHERE first_name IS NOT NULL
                          AND first_name !~ '^[A-Za-z][A-Za-z''’ .-]*$') AS bad_shape
FROM public.users;

-- B. display_name behaves. Expect: Sarah C. | Ana R. | Mango | (null)
SELECT public.display_name('Sarah', 'Chen', NULL)          AS split_row,
       public.display_name('Ana', 'Ruiz', NULL)            AS split_row_2,
       public.display_name(NULL, NULL, 'Mango')            AS legacy_one_word,
       public.display_name(NULL, NULL, NULL)               AS nothing;

-- C. The constraint rejects what it should. Both must ERROR:
--    UPDATE public.users SET first_name='李', last_name='明华' WHERE id = <any>;
--    UPDATE public.users SET first_name='123', last_name='456' WHERE id = <any>;

-- D. The two flat views leak no surname. Expect ZERO rows.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('family_public', 'user_display')
  AND column_name IN ('full_name', 'last_name', 'zipcode',
                      'onboarding_answers', 'auto_replies', 'family_name');

-- D2. caregiver_public's nested object, DURING the transition. Expect six
--     keys including BOTH full_name and display_name — full_name is what
--     the deployed code is still reading. 20260913000100 removes it.
SELECT DISTINCT jsonb_object_keys(users) AS transitional_key
FROM public.caregiver_public ORDER BY 1;

-- E. Nothing was taken away. `authenticated` should STILL hold table-level
--    SELECT on users and on family_profiles. Expect TWO rows.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('users', 'family_profiles')
  AND grantee = 'authenticated' AND privilege_type = 'SELECT';

-- F. caregiver_public still reachable by a logged-out visitor — the browse
--    surface. Expect anon + authenticated.
SELECT grantee FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'caregiver_public'
  AND privilege_type = 'SELECT' ORDER BY grantee;


-- =====================================================================
-- ROLLBACK (only before step 2):
--
--   DROP VIEW IF EXISTS public.family_public;
--   DROP VIEW IF EXISTS public.family_self;
--   DROP VIEW IF EXISTS public.family_admin;
--   ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_latin_name_ck;
--   -- first_name/last_name can stay; nothing breaks if they do.
--   -- caregiver_public must be restored from 20260804020000 §-- browse views.
-- =====================================================================
