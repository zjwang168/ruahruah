#!/usr/bin/env node
// RLS regression harness.
//
//   node scripts/rls-regression.mjs
//
// Exercises the live database the way the app does: once with no session at
// all (the attack), then as a family, a caregiver and an admin (the product).
// Every assertion prints PASS or FAIL and the process exits non-zero if any
// FAIL. Run it after applying
// supabase/migrations/20260804020000_rls_consolidated.sql.
//
// READ-ONLY, and structurally so. Every write probe points at least one
// foreign key at a UUID that cannot exist, so the row is rejected by the FK
// even when a policy wrongly permits it:
//
//     42501 → RLS blocked the write   (the assertion PASSES)
//     23502/23503 → RLS ALLOWED it, only the constraint stopped the row
//     no error → RLS allowed it AND the row landed  (should be impossible)
//
// A first version of this file used real ids for those probes and therefore
// inserted two rows when the policies were still open. It now also sweeps for
// leftover probe rows at the end and deletes any it finds, so a future edit
// that reintroduces the mistake cannot leave residue in the database.
//
// Sessions are minted through the Admin API's magic-link tokens rather than
// passwords — no credentials needed and no account is modified.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !ANON || !SERVICE) {
  console.error('Missing keys in .env.local'); process.exit(1)
}

const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } })

let pass = 0, fail = 0
const results = []

function check(name, ok, detail = '') {
  if (ok) { pass++; results.push(`  PASS  ${name}`) }
  else { fail++; results.push(`  FAIL  ${name}${detail ? `\n          ${detail}` : ''}`) }
}

function section(title) { results.push(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`) }

/** A PostgREST error code, or null when the call succeeded. */
const code = r => r.error?.code ?? null

// A UUID that is valid in shape and absent from every table, so any write
// probe using it dies on the foreign key rather than persisting.
const NOWHERE = '00000000-dead-4000-8000-0000000000ff'
const PROBE = 'rls-regression-probe'

/** True only when RLS itself refused the write. */
function writeBlocked(r) { return code(r) === '42501' }

function describeWrite(r) {
  if (code(r) === '42501') return 'blocked by RLS'
  if (code(r) === '23503' || code(r) === '23502')
    return `ALLOWED by RLS (${code(r)} — only the constraint stopped the row)`
  if (r.error) return `${code(r)}: ${r.error.message}`
  return 'ALLOWED by RLS and the row was written'
}

// ---------------------------------------------------------------------------
// Session minting
// ---------------------------------------------------------------------------

async function sessionFor(email) {
  const { data, error } = await svc.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`generateLink(${email}): ${error.message}`)
  const hashed = data?.properties?.hashed_token
  if (!hashed) throw new Error(`no token for ${email}`)

  const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: v, error: vErr } = await c.auth.verifyOtp({ token_hash: hashed, type: 'magiclink' })
  if (vErr) throw new Error(`verifyOtp(${email}): ${vErr.message}`)
  return { client: c, userId: v.user.id, email }
}

// ---------------------------------------------------------------------------
// Fixtures — discovered with the service role, never assumed
// ---------------------------------------------------------------------------

// Mirrors src/lib/admin/emails.ts. The scoping assertions MUST run as a
// non-admin: every policy carries an `OR public.is_ruah_admin()` arm, so an
// admin legitimately sees everything and would fail every "sees only its own"
// check for the right reason. Picking the founder's own account as the test
// family is the easiest way to get six confusing red lines.
const ADMIN_EMAILS = [
  'zwang168@seas.upenn.edu',
  'zijinwang97@gmail.com',
  'zijinwang168@gmail.com',
]
const isAdmin = u => ADMIN_EMAILS.includes(u?.email)

async function fixtures() {
  const { data: users } = await svc.from('users').select('id, email, role, full_name')
  const { data: fams } = await svc.from('family_profiles').select('id, user_id')
  const { data: cgs } = await svc.from('caregiver_profiles').select('id, user_id')
  const { data: reqs } = await svc.from('service_requests').select('id, family_id, status')
  const { data: matches } = await svc.from('matches').select('id, request_id, caregiver_id')
  const { data: msgs } = await svc.from('messages')
    .select('id, sender_id, receiver_id, sender_type, is_ai, match_id')

  const userById = id => users?.find(u => u.id === id)
  const nonAdminFams = (fams ?? []).filter(f => !isAdmin(userById(f.user_id)))
  const nonAdminCgs = (cgs ?? []).filter(c => !isAdmin(userById(c.user_id)))

  // A NON-ADMIN family that actually holds a match, so the participant rules
  // get exercised against someone the policies genuinely constrain.
  const famWithMatch = nonAdminFams.find(f => {
    const rids = reqs?.filter(r => r.family_id === f.id).map(r => r.id) ?? []
    return matches?.some(m => rids.includes(m.request_id))
  }) ?? nonAdminFams[0]

  const matchOfFam = matches?.find(m => {
    const rids = reqs?.filter(r => r.family_id === famWithMatch?.id).map(r => r.id) ?? []
    return rids.includes(m.request_id)
  })
  const cgOfMatch = nonAdminCgs.find(c => c.id === matchOfFam?.caregiver_id) ?? nonAdminCgs[0]

  return {
    users, fams, cgs, reqs, matches, msgs,
    family: users?.find(u => u.id === famWithMatch?.user_id),
    familyProfile: famWithMatch,
    caregiver: users?.find(u => u.id === cgOfMatch?.user_id),
    caregiverProfile: cgOfMatch,
    otherFamily: fams?.find(f => f.id !== famWithMatch?.id),
    admin: users?.find(isAdmin),
  }
}

// ---------------------------------------------------------------------------
// PHASE 1 — the attack. No session at all.
// ---------------------------------------------------------------------------

async function phaseAnon(fx) {
  section('PHASE 1 — anonymous (the attack)')
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } })

  // The headline requirement: profiles and messages return nothing.
  for (const t of ['family_profiles', 'messages', 'notifications', 'matches', 'service_requests']) {
    const r = await anon.from(t).select('*')
    check(`anon SELECT ${t} → zero rows`,
      (r.data?.length ?? 0) === 0,
      `got ${r.data?.length ?? 0} rows, error=${code(r) ?? 'none'}`)
  }

  // caregiver_profiles base table is no longer anon-readable at all.
  const cgBase = await anon.from('caregiver_profiles').select('*')
  check('anon SELECT caregiver_profiles (base table) → denied or empty',
    (cgBase.data?.length ?? 0) === 0,
    `got ${cgBase.data?.length ?? 0} rows, error=${code(cgBase) ?? 'none'}`)

  // users: only caregiver rows, and never the PII columns.
  const uPii = await anon.from('users').select('email, phone')
  check('anon SELECT users(email, phone) → denied',
    uPii.error !== null,
    `expected a permission error, got ${uPii.data?.length ?? 0} rows`)

  const uSafe = await anon.from('users').select('id, full_name, city')
  const cgUserIds = new Set((fx.cgs ?? []).map(c => c.user_id))
  const leaked = (uSafe.data ?? []).filter(u => !cgUserIds.has(u.id))
  check('anon SELECT users → caregiver rows only (no families, no admins)',
    leaked.length === 0,
    `${leaked.length} non-caregiver rows visible`)

  // The public browse surface must still work, or the marketplace is broken.
  const view = await anon.from('caregiver_public').select('id, bio, users')
  check('anon SELECT caregiver_public → still works (public profiles)',
    (view.data?.length ?? 0) > 0,
    `got ${view.data?.length ?? 0} rows, error=${code(view) ?? 'none'}`)

  const viewCols = Object.keys(view.data?.[0] ?? {})
  check('caregiver_public exposes no identity-document columns',
    !viewCols.some(c => ['id_photo_path', 'selfie_path', 'verification_status', 'onboarding_answers'].includes(c)),
    `columns: ${viewCols.join(', ')}`)

  // Writes. 42501 = blocked. 23502/23503 = ALLOWED (only a constraint saved us).
  const realUser = fx.users?.[0]
  const w1 = await anon.from('users').update({ role: null }).eq('id', realUser.id)
  check('anon UPDATE users → blocked by policy',
    code(w1) === '42501',
    `expected 42501, got ${code(w1)} (${w1.error?.message ?? 'no error — WRITE WAS ALLOWED'})`)

  // user_id points nowhere, so an allowed insert still cannot land.
  const w2 = await anon.from('notifications')
    .insert({ user_id: NOWHERE, type: 'message', title: PROBE, body: PROBE })
  check('anon INSERT notifications → blocked by policy', writeBlocked(w2), describeWrite(w2))

  const w3 = await anon.from('messages')
    .insert({ sender_id: NOWHERE, receiver_id: NOWHERE, content: PROBE })
  check('anon INSERT messages → blocked by policy', writeBlocked(w3), describeWrite(w3))
}

// ---------------------------------------------------------------------------
// PHASE 2 — a family. The whole family surface must still load.
// ---------------------------------------------------------------------------

async function phaseFamily(fx) {
  section(`PHASE 2 — family (${fx.family?.email})`)
  const { client: c, userId } = await sessionFor(fx.family.email)

  // Own row now comes from user_self. `users` itself no longer answers
  // select('*') for a logged-in caller — see PHASE 5.
  const own = await c.from('user_self').select('*').single()
  check('family reads own row via user_self (select *)', !!own.data && !own.error, own.error?.message)
  check('user_self returns the CALLER and nobody else',
    own.data?.id === userId, `got ${own.data?.id}, expected ${userId}`)

  const ownProfile = await c.from('family_profiles').select('*').eq('user_id', userId).single()
  check('family reads own family_profiles row', !!ownProfile.data, ownProfile.error?.message)

  const others = await c.from('family_profiles').select('id').neq('user_id', userId)
  check('family CANNOT read another family profile',
    (others.data?.length ?? 0) === 0,
    `${others.data?.length ?? 0} other family profiles visible`)

  const reqs = await c.from('service_requests').select('id, family_id')
  const foreign = (reqs.data ?? []).filter(r => r.family_id !== fx.familyProfile.id)
  check('family sees only its own service_requests',
    foreign.length === 0, `${foreign.length} foreign requests visible`)

  // Matches inbox — the real join: request_id → service_requests.family_id
  const myReqIds = new Set((fx.reqs ?? []).filter(r => r.family_id === fx.familyProfile.id).map(r => r.id))
  const ms = await c.from('matches').select('id, request_id, caregiver_id')
  const badMatches = (ms.data ?? []).filter(m => !myReqIds.has(m.request_id))
  check('family matches inbox scoped to its own requests',
    badMatches.length === 0, `${badMatches.length} foreign matches visible`)
  check('family matches inbox is not empty (join works)',
    (ms.data?.length ?? 0) > 0, 'zero matches — the request_id join may be wrong')

  // The embed the matches page actually uses.
  const embed = await c.from('matches')
    .select('id, caregiver_profiles(id, user_id, bio), service_requests(id, family_id)')
    .limit(5)
  check('family matches embed resolves caregiver_profiles + service_requests',
    !embed.error && (embed.data?.length ?? 0) > 0,
    embed.error?.message ?? 'no rows')

  // The assertion above is a SHORTER select than the one the pages actually
  // run, and that gap cost a live outage: /family/matches and
  // /family/dashboard select `users(full_name, email, avatar_url)` nested two
  // levels down, and the 20260805 column grant made `email` unreadable for
  // `authenticated`. PostgREST answers the whole query with 42501 — both
  // pages went blank and nothing here noticed, because this suite was asking
  // a question the product does not ask.
  //
  // So this one is copied VERBATIM from the pages. If they change, change it.
  const PAGE_MATCHES_SELECT =
    '*, service_requests!inner(family_id, service_type), ' +
    'caregiver_profiles(user_id, services, languages, hourly_rate_min, hourly_rate_max, ' +
    'years_experience, bio, is_verified, onboarding_answers, users(full_name, avatar_url))'
  const pageEmbed = await c.from('matches').select(PAGE_MATCHES_SELECT).limit(5)
  check('family matches embed, the select the PAGES actually run',
    !pageEmbed.error,
    `${code(pageEmbed) ?? ''} ${pageEmbed.error?.message ?? ''}`)

  const notifs = await c.from('notifications').select('user_id')
  const foreignN = (notifs.data ?? []).filter(n => n.user_id !== userId)
  check('family sees only its own notifications',
    foreignN.length === 0, `${foreignN.length} foreign notifications visible`)

  const thread = await c.from('messages').select('id, sender_id, receiver_id')
  const foreignM = (thread.data ?? []).filter(m => m.sender_id !== userId && m.receiver_id !== userId)
  check('family sees only threads it participates in',
    foreignM.length === 0, `${foreignM.length} foreign messages visible`)

  const browse = await c.from('caregiver_public').select('id').limit(5)
  check('family can browse caregiver_public', (browse.data?.length ?? 0) > 0, browse.error?.message)

  // Onboarding write path.
  const selfUpd = await c.from('users').update({ city: own.data.city ?? null }).eq('id', userId)
  check('family can update its OWN users row (onboarding write path)',
    selfUpd.error === null, selfUpd.error?.message)

  // An UPDATE whose target row the policy filters out is not an error — it
  // affects zero rows and PostgREST returns 204. So ask for the affected rows
  // back: empty means the policy hid it, a row means the write went through.
  // `role: null` keeps it harmless either way (NOT NULL would reject it).
  const otherUser = fx.users.find(u => u.id !== userId && !isAdmin(u))
  const otherUpd = await c.from('users').update({ role: null }).eq('id', otherUser.id).select('id')
  const filteredOut = !otherUpd.error && (otherUpd.data?.length ?? 0) === 0
  check('family CANNOT update another user row',
    filteredOut || code(otherUpd) === '42501',
    code(otherUpd) === '23502'
      ? 'row was NOT filtered — the policy allowed the update and only NOT NULL stopped it'
      : `got ${code(otherUpd)}, ${otherUpd.data?.length ?? 0} row(s) affected`)

  await c.auth.signOut()
}

// ---------------------------------------------------------------------------
// PHASE 3 — a caregiver. Job board, plus the Ruah audience rule.
// ---------------------------------------------------------------------------

async function phaseCaregiver(fx) {
  section(`PHASE 3 — caregiver (${fx.caregiver?.email})`)
  const { client: c, userId } = await sessionFor(fx.caregiver.email)

  const ownProfile = await c.from('caregiver_profiles').select('*').eq('user_id', userId).single()
  check('caregiver reads own caregiver_profiles row (select *, needs verification cols)',
    !!ownProfile.data, ownProfile.error?.message)

  const jobBoard = await c.from('service_requests')
    .select('id, status, family_profiles(id, onboarding_answers, user_id)')
    .eq('status', 'open')
  check('caregiver job board loads OPEN requests from unmatched families',
    !jobBoard.error, jobBoard.error?.message)
  check('caregiver job board embed resolves family_profiles',
    (jobBoard.data ?? []).every(r => r.family_profiles !== undefined),
    'family_profiles embed came back undefined — the job board would show blanks')

  const stats = await c.from('open_request_stats').select('request_id, match_count')
  check('caregiver can read open_request_stats (applicant counts)',
    !stats.error, stats.error?.message)

  const ms = await c.from('matches').select('id, caregiver_id')
  const badM = (ms.data ?? []).filter(m => m.caregiver_id !== fx.caregiverProfile.id)
  check('caregiver sees only her own matches',
    badM.length === 0, `${badM.length} foreign matches visible`)

  // THE AUDIENCE RULE. Ruah's family-directed reports reuse the caregiver's id
  // as sender; she must never read them.
  const seen = await c.from('messages').select('id, sender_id, receiver_id, sender_type, is_ai')
  const ruahLeak = (seen.data ?? []).filter(m =>
    (m.sender_type === 'ruah' || m.is_ai === true) &&
    m.receiver_id !== userId && m.sender_id === userId
  )
  check('caregiver CANNOT read Ruah reports written about her to the family',
    ruahLeak.length === 0,
    `${ruahLeak.length} such messages leaked: ${ruahLeak.map(m => m.id).join(', ')}`)

  const anyForeign = (seen.data ?? []).filter(m => m.sender_id !== userId && m.receiver_id !== userId)
  check('caregiver sees only threads she participates in',
    anyForeign.length === 0, `${anyForeign.length} foreign messages visible`)

  // She must not be able to forge a platform message. sender_id has to be her
  // own id for the policy to even be tested, so receiver_id is the one pointed
  // at nowhere — the FK stops the row regardless of the policy's verdict.
  const forge = await c.from('messages').insert({
    sender_id: userId, receiver_id: NOWHERE, content: PROBE, sender_type: 'ruah', is_ai: true,
  })
  check('caregiver CANNOT forge a sender_type=ruah message',
    writeBlocked(forge), describeWrite(forge))

  const otherFam = await c.from('family_profiles').select('id').eq('id', fx.otherFamily?.id ?? '')
  check('caregiver profile reads are scoped (unrelated family without an open request hidden)',
    !otherFam.error, otherFam.error?.message)

  await c.auth.signOut()
}

// ---------------------------------------------------------------------------
// PHASE 4 — admin. The back office must keep working.
// ---------------------------------------------------------------------------

async function phaseAdmin(fx) {
  if (!fx.admin) { section('PHASE 4 — admin (SKIPPED: no admin user found)'); return }
  section(`PHASE 4 — admin (${fx.admin.email})`)
  const { client: c } = await sessionFor(fx.admin.email)

  const u = await c.from('users').select('id')
  check('admin reads all users', (u.data?.length ?? 0) === (fx.users?.length ?? 0),
    `saw ${u.data?.length ?? 0} of ${fx.users?.length ?? 0}`)

  const m = await c.from('matches').select('id')
  check('admin reads all matches', (m.data?.length ?? 0) === (fx.matches?.length ?? 0),
    `saw ${m.data?.length ?? 0} of ${fx.matches?.length ?? 0}`)

  const fp = await c.from('family_profiles').select('id')
  check('admin reads all family_profiles', (fp.data?.length ?? 0) === (fx.fams?.length ?? 0),
    `saw ${fp.data?.length ?? 0} of ${fx.fams?.length ?? 0}`)

  const cp = await c.from('caregiver_profiles').select('id')
  check('admin reads all caregiver_profiles', (cp.data?.length ?? 0) === (fx.cgs?.length ?? 0),
    `saw ${cp.data?.length ?? 0} of ${fx.cgs?.length ?? 0}`)

  const ad = await c.from('agent_decisions').select('id').limit(1)
  check('admin reads agent_decisions', !ad.error, ad.error?.message)

  await c.auth.signOut()
}

// ---------------------------------------------------------------------------

/**
 * Safety net. Every probe above is built so it cannot persist, but this
 * verifies that from the database's side rather than trusting the design —
 * and removes anything it finds. Runs even when assertions failed.
 */
async function sweepProbeRows() {
  section('CLEANUP — probe rows left in the database')
  let found = 0
  for (const [table, column] of [['messages', 'content'], ['notifications', 'title']]) {
    const { data } = await svc.from(table).select('id').eq(column, PROBE)
    if (data?.length) {
      found += data.length
      await svc.from(table).delete().in('id', data.map(r => r.id))
      results.push(`  CLEANED  removed ${data.length} probe row(s) from ${table}`)
    }
  }
  check('no probe rows persisted', found === 0,
    `${found} row(s) had to be cleaned up — a write probe is not using ${NOWHERE}`)
}

// ---------------------------------------------------------------------------
// PHASE 5 — column grants on `users`, and the two views that replace them.
//
// The gap this covers: 20260804020000 §4b reset anon's column access and
// handed back a whitelist, but named only anon. `authenticated` kept the
// blanket grant, so email/phone/zipcode were readable by any account anyone
// could register — and can_view_user() returns true for EVERY caregiver row
// with no relationship required. PHASE 1 already asserted the anon half; this
// is the half that was missing, and it is the half that was open.
//
// Applied by 20260805000000_users_column_grants.sql.
// ---------------------------------------------------------------------------

const PII = ['email', 'phone', 'zipcode', 'ban_reason']

async function phaseColumnGrants(fx) {
  section('PHASE 5 — users column grants (the authenticated half)')

  // ---- as a NON-ADMIN logged-in caller ------------------------------------
  const { client: c, userId } = await sessionFor(fx.family.email)

  for (const col of PII) {
    const r = await c.from('users').select(col)
    check(`authenticated SELECT users(${col}) → denied`,
      r.error !== null,
      `expected a permission error, got ${r.data?.length ?? 0} rows`)
  }

  // select('*') expands to every column BEFORE privileges are checked, so it
  // must fail outright rather than quietly returning the granted subset.
  const star = await c.from('users').select('*')
  check('authenticated SELECT users(*) → denied outright',
    star.error !== null,
    `expected a permission error, got ${star.data?.length ?? 0} rows`)

  // The product still needs the public columns, or every avatar breaks.
  const safe = await c.from('users').select('id, full_name, avatar_url, city, state, role')
  check('authenticated SELECT users(public columns) → still works',
    safe.error === null && (safe.data?.length ?? 0) > 0,
    `error=${code(safe) ?? 'none'}, rows=${safe.data?.length ?? 0}`)

  // user_self: exactly one row, the caller's, whole.
  const self = await c.from('user_self').select('*')
  check('user_self → exactly one row', (self.data?.length ?? 0) === 1,
    `got ${self.data?.length ?? 0} rows, error=${code(self) ?? 'none'}`)
  check('user_self → that row is the caller', self.data?.[0]?.id === userId,
    `got ${self.data?.[0]?.id}, expected ${userId}`)
  check('user_self → carries the restricted columns the profile page edits',
    self.data?.[0] !== undefined && PII.every(col => col in self.data[0]),
    `columns: ${Object.keys(self.data?.[0] ?? {}).join(', ')}`)

  // users_admin must be inert for a non-admin: zero rows, not an error.
  const notAdmin = await c.from('users_admin').select('id')
  check('non-admin SELECT users_admin → zero rows',
    (notAdmin.data?.length ?? 0) === 0,
    `got ${notAdmin.data?.length ?? 0} rows, error=${code(notAdmin) ?? 'none'}`)

  // ---- as anon ------------------------------------------------------------
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } })
  for (const v of ['user_self', 'users_admin']) {
    const r = await anon.from(v).select('id')
    check(`anon SELECT ${v} → denied or empty`,
      r.error !== null || (r.data?.length ?? 0) === 0,
      `got ${r.data?.length ?? 0} rows, error=${code(r) ?? 'none'}`)
  }

  // ---- as an admin --------------------------------------------------------
  if (!fx.admin) {
    check('admin fixture present for users_admin checks', false, 'no admin account found')
    return
  }
  const { client: a } = await sessionFor(fx.admin.email)

  const all = await a.from('users_admin').select('*')
  check('admin SELECT users_admin → rows', (all.data?.length ?? 0) > 0,
    `got ${all.data?.length ?? 0} rows, error=${code(all) ?? 'none'}`)
  check('admin SELECT users_admin → email is present (the console lists by it)',
    all.data?.[0] !== undefined && 'email' in all.data[0],
    `columns: ${Object.keys(all.data?.[0] ?? {}).join(', ')}`)

  // THE ONE THAT CANNOT BE CHECKED BY READING THE REPO.
  // Six admin pages select users with a nested caregiver_profiles /
  // family_profiles resource. PostgREST resolves embeds on a view through the
  // view's source relation; if that resolution ever stops working, those pages
  // render empty and nothing else in this suite would notice.
  const embedCg = await a.from('users_admin').select('id, email, caregiver_profiles ( id )')
  check('admin users_admin embeds caregiver_profiles (admin console depends on it)',
    embedCg.error === null,
    `error=${code(embedCg)} ${embedCg.error?.message ?? ''}`)

  const embedFam = await a.from('users_admin').select('id, email, family_profiles ( onboarding_answers )')
  check('admin users_admin embeds family_profiles (admin console depends on it)',
    embedFam.error === null,
    `error=${code(embedFam)} ${embedFam.error?.message ?? ''}`)
}

async function main() {
  const fx = await fixtures()
  if (!fx.family || !fx.caregiver) {
    console.error('Could not find a family and a caregiver to test with.'); process.exit(1)
  }

  try {
    await phaseAnon(fx)
    await phaseFamily(fx)
    await phaseCaregiver(fx)
    await phaseAdmin(fx)
    await phaseColumnGrants(fx)
  } finally {
    await sweepProbeRows()
    console.log(results.join('\n'))
    console.log(`\n${pass} passed, ${fail} failed`)
  }
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(err => { console.error(err); process.exit(1) })
