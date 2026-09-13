# The `users` PII column fix — completion record

**Status: applied and verified, 2026-09-13.** The fix in `bf2add6` closed a
column-grant gap on `public.users`. This file was written before any of it had
run, as the runbook; it is now the record of what was run and what came back.

## Outcome

| | |
|---|---|
| Applied | 2026-09-13 |
| `npm run rls:check` | **57 passed, 0 failed** |
| PHASE 5 (the new half) | 16/16 pass |
| PostgREST embeds through `users_admin` | **work** — both assertions pass |
| `authenticated` grant on `users` | 9 of 13 columns |
| Withheld | `email`, `phone`, `zipcode`, `ban_reason` |
| Types / tests / build | `tsc` 0 errors · `npm test` 72/72 · `next build` clean |

The four withheld columns are granted to no client role, and no table-level
SELECT survives on `users` for `anon` or `authenticated` — a table-level grant
would re-admit every column and silently undo the whole change.

## What was wrong

`20260804020000_rls_consolidated.sql` §4b reset column access and handed back a
whitelist, but the REVOKE/GRANT pair named `anon` only. `authenticated` kept the
blanket `GRANT ... ON ALL TABLES IN SCHEMA public` that Supabase installs by
default, so the stated intent was enforced against logged-out visitors and
nobody else.

Row access made that reachable rather than theoretical. `public.can_view_user()`
carries an unconditional arm — any caregiver's row is visible, no relationship
required, because the public profile page is public by design. Combined with
self-serve signup, any account anyone could mint read every caregiver's row,
and with no column gate that included contact details:

```js
await supabase.from('users').select('full_name, email, phone, zipcode')
```

For a childcare marketplace that is the caregiver side's phone number and home
zipcode handed to any signup — a physical-safety exposure, not only a privacy
one. The row arm is correct and was left alone. The defect was that "which
rows" was doing a job only "which columns" can do.

## What was run, in order

The two migrations were deliberately split so that no deploy window existed
where one half was live without the other.

**1 — `supabase/migrations/20260805000000_user_views.sql`** (additive)

Created `user_self` (the caller's own row, gated by `id = auth.uid()`) and
`users_admin` (every row, gated by `is_ruah_admin()`). Both
`security_invoker = false`, so the WHERE clause is the gate. Nothing was
revoked; old and new code both worked from this point on.

**2 — deploy**

The application commit moved own-row reads to `user_self` (about twenty pages
plus `src/proxy.ts`) and admin reads to `users_admin` (six pages). It also
added `/api/request-distances`, because `/caregiver/requests` had been pulling
every family's `zipcode` into the browser to render a "12 mi away" chip.

**3 — `supabase/migrations/20260805000100_users_column_grants.sql`** (revoke)

Dropped the table-level SELECT for `authenticated` and re-granted a computed
column list — everything except the four PII columns. Computed rather than
hand-listed so that a column added later is granted by default and only the
named four are withheld. Also installed
`ALTER DEFAULT PRIVILEGES ... REVOKE SELECT ... FROM authenticated`, which is
what stops the same gap reopening on the next new table.

**4 — `npm run rls:check`**

57 passed, 0 failed. PHASES 1–4 (pre-existing) stayed green, so the change
broke no existing row-level rule.

## The question that could not be answered by reading the repo

Six admin pages select users with a nested `caregiver_profiles` or
`family_profiles` resource. PostgREST resolves embeds on a view through the
view's source relation — but that is PostgREST behaviour, not something a
migration can guarantee, and if it stopped working those pages would render
empty with no error.

**Resolved: it works.** Both assertions pass:

```
PASS  admin users_admin embeds caregiver_profiles (admin console depends on it)
PASS  admin users_admin embeds family_profiles (admin console depends on it)
```

The contingency drafted here — moving those two pages' reads to a server route
behind `requireAdmin()` — was therefore not needed. If a future PostgREST
upgrade breaks it, that is still the fix, and
`supabase/checks/postgrest_view_embed_probe.sql` reproduces the shape on
throwaway tables in any empty project.

## What binds new work from now on

- `select('*')` on `users` from the browser **fails** — Postgres expands `*`
  before checking privileges. Own-row reads go through `user_self`, admin reads
  through `users_admin`. `.update()` still targets the base table.
- A **new table is unreadable from the browser** until it ships its own explicit
  GRANT alongside its policies, and it reads as **empty rather than as an
  error** — the confusing failure mode. Budget for it on anything new.
- Never put another user's PII in a client query so the UI can compute
  something from it. `/api/request-distances` is the pattern: both zipcodes are
  resolved server-side with the service role and only whole miles come back.

## Still open — same class, product decision taken

`caregiver_profiles` and `family_profiles` have correct ROW gates and no COLUMN
gates. Before matching, any caregiver-role account reads a family's entire row,
including `onboarding_answers`; a matched family reads the caregiver's
`id_photo_path` and `selfie_path` (paths only — the bucket is private).

Unlike the `users` gap this was never a pure security patch: it needed a
product answer about what each side should see before a match. That answer has
now been given, and the work is specified separately. The same shape applies —
views plus a computed column grant, split into an additive migration and a
revoking one, with `rls:check` assertions on both halves.
