// Which side of the marketplace a person is looking at right now.
//
// One account can hold a family profile and a caregiver profile. What a
// person CAN do comes from which profiles exist — user_self carries both ids,
// and RLS keys on them. What a person is currently LOOKING AT is a cookie,
// exactly like the locale: the proxy can read it, switching costs no round
// trip, and it is per device, which is the honest model for someone who is a
// family on their phone and a caregiver on their laptop.
//
// The proxy WRITES it as a side effect of where you go — land on /family/*
// and the cookie says family — so nothing has to remember to set it. It is
// only READ where a generic entry point has to choose a side: /auth/complete,
// /login, and the dashboard link on /messages.
//
// Shared by the edge proxy and client components, so no React in here.

export type Side = 'family' | 'caregiver'

export const ACTIVE_ROLE_COOKIE = 'ruah_role'
export const ACTIVE_ROLE_MAX_AGE = 60 * 60 * 24 * 365

export type Capabilities = {
  family: boolean
  caregiver: boolean
}

export function isSide(value: unknown): value is Side {
  return value === 'family' || value === 'caregiver'
}

export function capabilitiesOf(row: {
  family_profile_id?: string | null
  caregiver_profile_id?: string | null
} | null | undefined): Capabilities {
  return { family: !!row?.family_profile_id, caregiver: !!row?.caregiver_profile_id }
}

/**
 * The side to show, given what the person can do and what the cookie last
 * recorded. A cookie naming a side the person cannot hold is ignored — it
 * may predate a profile being removed, or be someone else's on a shared
 * machine. With one profile there is no choice; with none, null, and the
 * caller sends them to /auth/complete.
 */
export function pickSide(caps: Capabilities, remembered: unknown): Side | null {
  if (isSide(remembered) && caps[remembered]) return remembered
  if (caps.family && !caps.caregiver) return 'family'
  if (caps.caregiver && !caps.family) return 'caregiver'
  if (caps.family && caps.caregiver) return 'family'
  return null
}

export function dashboardFor(side: Side): string {
  return `/${side}/dashboard`
}

// ---- browser-only helpers (document.cookie) --------------------------------

export function readActiveRoleCookie(): Side | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${ACTIVE_ROLE_COOKIE}=([^;]*)`))
  const v = m ? decodeURIComponent(m[1]) : null
  return isSide(v) ? v : null
}

export function writeActiveRoleCookie(side: Side): void {
  if (typeof document === 'undefined') return
  document.cookie =
    `${ACTIVE_ROLE_COOKIE}=${side}; path=/; max-age=${ACTIVE_ROLE_MAX_AGE}; samesite=lax`
}
