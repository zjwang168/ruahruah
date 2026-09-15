// Account creation, in one place.
//
// Two flows land here: the password form on /onboarding/register, and the
// confirmation page an OAuth caller reaches at /auth/complete. They write the
// SAME two rows, and before this module they wrote them twice, in two files,
// with the rate-parsing copied between them. A second copy is how the two
// halves of a signup drift apart.

import type { SupabaseClient } from '@supabase/supabase-js'
import { fullName as joinName } from './names'

export type SignupRole = 'family' | 'caregiver'
export type Answers = Record<string, unknown>

// Where the onboarding funnel's context waits out an OAuth round trip.
// sessionStorage, not a query param: the redirect to Google and back drops
// everything we put in the URL, and the answers are the reader's own intake,
// which has no business sitting in a third party's referrer log.
export const PENDING_SIGNUP_KEY = 'ruah_pending_signup'

export function stashPendingSignup(role: string, answers: Answers): void {
  try {
    sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({ role, answers }))
  } catch {
    // Private browsing, or storage disabled. The confirmation page asks for
    // the role instead of guessing; the intake answers are the loss.
  }
}

export function readPendingSignup(): { role: SignupRole | null; answers: Answers } {
  try {
    const raw = sessionStorage.getItem(PENDING_SIGNUP_KEY)
    if (!raw) return { role: null, answers: {} }
    const parsed = JSON.parse(raw)
    const role = parsed?.role === 'family' || parsed?.role === 'caregiver' ? parsed.role : null
    return { role, answers: (parsed?.answers ?? {}) as Answers }
  } catch {
    return { role: null, answers: {} }
  }
}

export function clearPendingSignup(): void {
  try { sessionStorage.removeItem(PENDING_SIGNUP_KEY) } catch { /* nothing to clear */ }
}

/** "$25–$35" -> [25, 35]. The funnel writes an en dash. */
function parseRate(raw: unknown): [number | null, number | null] {
  const parts = String(raw ?? '').replace(/\$/g, '').split('–')
  return [
    parts[0] ? Number(parts[0].trim()) || null : null,
    parts[1] ? Number(parts[1].trim()) || null : null,
  ]
}

/**
 * Writes ONLY the profile row for one side. Used on its own when an existing
 * account adds its second side — the users row is already there, and the
 * onboarding funnel ends here instead of at signUp.
 */
export async function createProfileRow(
  supabase: SupabaseClient,
  opts: { userId: string; role: SignupRole; answers: Answers }
): Promise<{ errorKey: 'auth.err.saveFailed' | null }> {
  const { userId, role, answers } = opts
  const a = answers as Record<string, any>

  if (role === 'family') {
    const { error } = await supabase.from('family_profiles').insert({
      user_id: userId,
      languages: a.languages || [],
      onboarding_answers: answers,
    })
    if (error) {
      console.error('signup: family_profiles insert failed —', error.message)
      return { errorKey: 'auth.err.saveFailed' }
    }
    return { errorKey: null }
  }

  const [rateMin, rateMax] = parseRate(a.rate)
  const { error } = await supabase.from('caregiver_profiles').insert({
    user_id: userId,
    services: a.services || [],
    languages: a.languages || [],
    years_experience: Number(a.experience) || 0,
    hourly_rate_min: rateMin,
    hourly_rate_max: rateMax,
    onboarding_answers: answers,
  })
  if (error) {
    console.error('signup: caregiver_profiles insert failed —', error.message)
    return { errorKey: 'auth.err.saveFailed' }
  }
  return { errorKey: null }
}

/**
 * Writes users + the matching profile row. Returns a MESSAGE KEY on failure,
 * never the database's own words: a CHECK violation on users_latin_name_ck
 * reads as `violates check constraint "users_latin_name_ck"`, which tells a
 * person nothing they can act on. Callers validate the name with
 * nameError() first, so this path should not be reachable — it is the net.
 */
export async function createAccountRows(
  supabase: SupabaseClient,
  opts: {
    userId: string
    email: string
    role: SignupRole
    firstName: string
    lastName: string
    answers: Answers
  }
): Promise<{ errorKey: 'auth.err.saveFailed' | null }> {
  const { userId, email, role, firstName, lastName, answers } = opts
  const a = answers as Record<string, any>

  const { error: userError } = await supabase.from('users').insert({
    id: userId,
    email,
    role,
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    full_name: joinName(firstName, lastName),
    zipcode: a.zipcode || null,
    city: a.city || null,
    state: a.state || null,
  })
  if (userError) {
    console.error('signup: users insert failed —', userError.message)
    return { errorKey: 'auth.err.saveFailed' }
  }

  return createProfileRow(supabase, { userId, role, answers })
}
