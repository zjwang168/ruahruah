// Audience rules for platform-authored (Ruah) messages, shared by the thread
// view and the conversations list.
//
// THIS MIRRORS messages_select_audience. The policy is what actually decides;
// this only keeps a preview line from flashing before the row is filtered.
// Change one, change the other, then run `npm run rls:check`.

export const isRuahMessage = (m: any) => m?.sender_type === 'ruah' || m?.is_ai === true

/** PostgREST returns a many-to-one embed as an object; the generated type widens it to an array. */
const one = <T,>(v: T | T[] | null | undefined): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined)

/**
 * A Ruah message renders for its receiver, plus the household it was sent on
 * behalf of. Mechanically, Ruah impersonates the FAMILY's user id as sender
 * for caregiver-directed outreach — that IS on the family's behalf. Reports
 * written TO the family ABOUT a caregiver reuse the caregiver's user id as
 * sender, as an FK necessity, and are NOT on her behalf: she must never see
 * them.
 *
 * The question is therefore about the MATCH, not the person: is the viewer
 * the household on the match this message belongs to? Asked about the person
 * ("is the viewer a family?") it breaks the moment one account holds both
 * profiles — she would satisfy it even on a match where she is the caregiver,
 * and read the reports about herself. The message must carry
 * `matches ( service_requests ( family_id ) )` for this to answer; without
 * the embed the family arm is simply false, which fails closed.
 */
export function ruahMessageVisibleTo(
  m: any,
  viewer: { id?: string; familyProfileId?: string | null } | null | undefined
): boolean {
  if (!isRuahMessage(m)) return true
  if (!viewer?.id) return false
  if (m.receiver_id === viewer.id) return true
  if (m.sender_id !== viewer.id || !viewer.familyProfileId) return false
  const familyOnMatch = one(one(m.matches)?.service_requests)?.family_id
  return !!familyOnMatch && familyOnMatch === viewer.familyProfileId
}
