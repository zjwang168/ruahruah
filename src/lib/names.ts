// The shape of a person's name, in one place.
//
// This MUST stay in step with users_latin_name_ck in
// supabase/migrations/20260913000000_names_and_views.sql. The constraint is
// what actually decides; this only moves the rejection off the round trip and
// into the field, so a reader finds out while they are still typing.
//
// Latin letters plus the punctuation real names carry — O'Brien, Anne-Marie,
// Jr. Han characters, Cyrillic and digits fall outside it deliberately: each
// side of the marketplace sees the other as "First L.", and an initial is only
// meaningful for a script that has them.

export const NAME_RE = /^[A-Za-z][A-Za-z'’ .-]*$/

export function isValidName(value: string): boolean {
  return NAME_RE.test(value.trim())
}

/**
 * The first thing wrong with the pair, as a MESSAGE KEY, or null when both are
 * fine. A key rather than a sentence because these surface in three languages
 * and the caller is the one holding the dictionary — and because the thing a
 * form must never show is the raw constraint violation from Postgres.
 */
export type NameErrorKey = 'auth.err.nameBoth' | 'auth.err.nameLatin'

export function nameError(first: string, last: string): NameErrorKey | null {
  const f = first.trim()
  const l = last.trim()
  if (!f || !l) return 'auth.err.nameBoth'
  if (!isValidName(f) || !isValidName(l)) return 'auth.err.nameLatin'
  return null
}

/**
 * Mirrors public.display_name() so a form can show what the other side will
 * see. Postgres remains the authority: every view computes this server-side
 * and no page is trusted to abbreviate for itself.
 */
export function displayName(first: string, last: string): string {
  const f = first.trim()
  const l = last.trim()
  if (!f) return ''
  return l ? `${f} ${l[0].toUpperCase()}.` : f
}

/** What goes in users.full_name, which the admin views and *_self still read. */
export function fullName(first: string, last: string): string {
  return `${first.trim()} ${last.trim()}`.trim()
}
