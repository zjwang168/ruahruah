/* Single source of truth for service categories.

   Two lists, deliberately separate:

   - SELECTABLE_SERVICES is what a person can choose today. Ruah launches as a
     childcare marketplace, so this is childcare only. Every caregiver on the
     platform lists childcare and nothing else, so offering the other
     categories produced requests that nobody could fill.

   - The label maps below cover every value that has ever been written to
     service_type, so historical requests and admin-created matches still
     render as words instead of raw enum strings.

   Nothing here removes a capability. The database enum is untouched and the
   onboarding branches for the other categories are still in the code. To
   re-open a category, move one entry from LEGACY_SERVICE_IDS into
   SELECTABLE_SERVICES — that is the entire change. */

export type ServiceOption = {
  id: string
  label: string
  emoji: string
  desc: string
}

export const SELECTABLE_SERVICES: ServiceOption[] = [
  {
    id: 'childcare',
    label: 'Childcare',
    emoji: '👶',
    desc: 'Nannies, babysitters, after-school and newborn care',
  },
]

export const SELECTABLE_SERVICE_IDS: string[] = SELECTABLE_SERVICES.map(s => s.id)

/** Written to the database in the past, or by admin tools. Not choosable. */
export const LEGACY_SERVICE_IDS = [
  'babysitter',
  'elder_care',
  'housekeeping',
  'chef',
  'pet_care',
  'tutoring',
  'postpartum',
  'manual',
]

const LABELS: Record<string, string> = {
  childcare: 'Childcare',
  babysitter: 'Babysitter',
  elder_care: 'Senior Care',
  housekeeping: 'Housekeeping',
  chef: 'Personal Chef',
  pet_care: 'Pet Care',
  tutoring: 'Tutoring',
  postpartum: 'Postpartum Care',
  manual: 'General',
}

const EMOJI: Record<string, string> = {
  childcare: '👶',
  babysitter: '🍼',
  elder_care: '🏥',
  housekeeping: '🏠',
  chef: '👨‍🍳',
  pet_care: '🐾',
  tutoring: '📚',
  postpartum: '🌸',
  manual: '📋',
}

/** Falls back to the raw value so an unknown enum never renders as blank. */
export function serviceLabel(value: string | null | undefined): string {
  if (!value) return ''
  return LABELS[value] || value
}

export function serviceLabelWithEmoji(value: string | null | undefined): string {
  if (!value) return ''
  const emoji = EMOJI[value]
  return emoji ? `${emoji} ${serviceLabel(value)}` : serviceLabel(value)
}

/** Shown under a single-option picker so the one card reads as intentional. */
export const SERVICE_FOCUS_NOTE =
  'Ruah is focused on childcare right now. We will open more categories as we grow.'
