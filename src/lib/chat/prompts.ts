// Server-side system prompt registry for /api/chat.
//
// The client used to POST its own `systemPrompt`, which made the route an open
// LLM proxy: anyone could hand it any instructions and spend the platform's
// Anthropic budget. Now the client names a prompt and the server builds it —
// from the session user's own profile, read server-side. A caller can choose
// WHICH conversation they are in; they cannot choose what Ruah is.
//
// Server-only: imported by the route handler, never by a client component.

import type { SupabaseClient } from '@supabase/supabase-js'

export type PromptKey = 'family_chat' | 'caregiver_chat' | 'caregiver_bio' | 'family_post'

export const PROMPT_KEYS: PromptKey[] = ['family_chat', 'caregiver_chat', 'caregiver_bio', 'family_post']

export function isPromptKey(v: unknown): v is PromptKey {
  return typeof v === 'string' && (PROMPT_KEYS as string[]).includes(v)
}

// `onboarding_answers` is a free-form JSON blob written by the onboarding
// flows, so nothing about its shape is guaranteed at read time. These two
// accessors narrow a field or give up, which keeps a malformed blob from
// throwing halfway through building a prompt.
type Answers = Record<string, unknown>

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}

function list(v: unknown): string[] | null {
  return Array.isArray(v) && v.length ? v.map(String) : null
}

const EXPERIENCE_LABELS: Record<string, string> = {
  '0': 'Less than 1 year',
  '1': '1–2 years',
  '3': '3–5 years',
  '5': '5–10 years',
  '10': '10+ years',
}

/**
 * Builds the system prompt for `key` using the authenticated user's own data.
 *
 * `supabase` must be the cookie-bound server client for the CALLER — every
 * lookup below is keyed on `userId` taken from the verified session, never
 * from the request body.
 */
export async function buildSystemPrompt(
  key: PromptKey,
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  // user_self / family_self, not the base tables: full_name and
  // onboarding_answers are withheld from `authenticated`, and these are the
  // caller's OWN rows — Ruah addresses the person by their own name.
  //
  // This REQUIRES a session-bound client. The views key off auth.uid(), so a
  // service-role client would read zero rows and Ruah would greet everyone as
  // "there". /api/chat passes the session client; keep it that way.
  const { data: user } = await supabase
    .from('user_self').select('full_name').single()
  const name = user?.full_name || 'there'

  switch (key) {
    case 'family_chat': {
      const { data: profile } = await supabase
        .from('family_self').select('onboarding_answers').single()
      return familyChatPrompt(name, profile?.onboarding_answers)
    }
    case 'caregiver_chat': {
      const { data: profile } = await supabase
        .from('caregiver_profiles').select('onboarding_answers').eq('user_id', userId).single()
      return caregiverChatPrompt(name, profile?.onboarding_answers)
    }
    case 'caregiver_bio': {
      const { data: profile } = await supabase
        .from('caregiver_profiles')
        .select('services, languages, years_experience, hourly_rate_min, hourly_rate_max, onboarding_answers')
        .eq('user_id', userId).single()
      return caregiverBioPrompt(name, profile)
    }
    case 'family_post':
      return FAMILY_POST_PROMPT
  }
}

// --- family/chat ------------------------------------------------------------

function familyChatPrompt(name: string, answers: Answers | null | undefined): string {
  let context = ''
  if (answers) {
    const parts: string[] = []
    const add = (label: string, v: string | null, suffix = '') => { if (v) parts.push(`${label}: ${v}${suffix}`) }
    const addList = (label: string, v: unknown) => { const l = list(v); if (l) parts.push(`${label}: ${l.join(', ')}`) }

    addList('Services needed', answers.services)
    add('Childcare type', str(answers.childcare_type))
    add('Start date', str(answers.childcare_when))
    add('Schedule', str(answers.childcare_schedule))
    add('Number of children', str(answers.childcare_kids))
    addList('Children ages', answers.childcare_ages)
    addList('Extra needs', answers.childcare_extras)
    add('Childcare budget', str(answers.childcare_budget), '/hr')
    add('Chef service', str(answers.chef_type))
    add('Cuisine preference', str(answers.chef_cuisine))
    add('Chef budget', str(answers.chef_budget), '/hr')
    add('Housekeeping type', str(answers.house_type))
    add('Home size', str(answers.house_size))
    add('Cleaning frequency', str(answers.house_frequency))
    add('Housekeeping budget', str(answers.house_budget), '/session')
    addList('Elder care needs', answers.elder_needs)
    add('Elder care arrangement', str(answers.elder_living))
    add('Elder care budget', str(answers.elder_budget), '/hr')
    add('Pet type', str(answers.pet_type))
    add('Pet service', str(answers.pet_service))
    add('Pet care budget', str(answers.pet_budget))
    addList('Tutoring needs', answers.tutor_needs)
    addList('Subjects', answers.tutor_subject)
    add('Child grade level', str(answers.tutor_age))
    add('Tutoring budget', str(answers.tutor_budget), '/hr')

    if (parts.length > 0) {
      context = `\n\nIMPORTANT - This family has already shared their needs during onboarding. Use this directly without asking again:\n${parts.join('\n')}\n\nDo NOT re-ask questions they've already answered. Be specific and personalized.`
    }
  }

  return `You are Ruah!, a warm AI assistant for a family care platform.
You help families find caregivers: nannies, chefs, housekeepers, elder care, pet care, tutors.
The user's name is ${name}.

RESPONSE STYLE:
- Keep replies SHORT and warm. Max 100 words unless writing a full document.
- Use simple formatting. Max 3-4 bullet points.
- Never list everything at once. Be conversational.
- If writing a job post, go ahead and write it fully.
- End with ONE short follow-up question max.

IMPORTANT: When the family asks to find or search for caregivers, respond with exactly this tag on its own line: [FIND_CAREGIVERS]
This will trigger the system to show matching caregiver profiles.
${context}`
}

// --- caregiver/chat ---------------------------------------------------------

function caregiverChatPrompt(name: string, answers: Answers | null | undefined): string {
  let context = ''
  if (answers) {
    const parts: string[] = []
    const services = list(answers.services)
    const languages = list(answers.languages)
    if (services) parts.push(`Services offered: ${services.join(', ')}`)
    if (str(answers.experience)) parts.push(`Years of experience: ${str(answers.experience)}`)
    if (languages) parts.push(`Languages: ${languages.join(', ')}`)
    if (str(answers.availability)) parts.push(`Availability: ${str(answers.availability)}`)
    if (str(answers.living)) parts.push(`Live-in: ${str(answers.living)}`)
    if (str(answers.rate)) parts.push(`Hourly rate: ${str(answers.rate)}`)

    if (parts.length > 0) {
      context = `\n\nThis caregiver's profile info:\n${parts.join('\n')}\n\nUse this to give personalized advice.`
    }
  }

  return `You are Ruah!, a warm AI assistant helping caregivers on the Ruah platform.
You help caregivers write great bios, improve their profiles, understand pricing, and connect with families.
You speak in a friendly, encouraging tone. Keep replies SHORT — max 100 words unless writing a full bio.
The caregiver's name is ${name}.${context}`
}

// --- caregiver/profile bio writer -------------------------------------------

type CaregiverProfile = {
  services?: unknown
  languages?: unknown
  years_experience?: unknown
  hourly_rate_min?: unknown
  hourly_rate_max?: unknown
  onboarding_answers?: Answers | null
}

function caregiverBioPrompt(name: string, profile: CaregiverProfile | null | undefined): string {
  const answers = profile?.onboarding_answers || {}
  const experience =
    EXPERIENCE_LABELS[String(profile?.years_experience)] || `${profile?.years_experience} years`

  return `You are Ruah!, a warm AI assistant helping caregivers write professional bios.
The caregiver's name is ${name}.
Their info: services: ${list(profile?.services)?.join(', ')}, languages: ${list(profile?.languages)?.join(', ')}, experience: ${experience}, rate: $${profile?.hourly_rate_min}–$${profile?.hourly_rate_max}/hr, availability: ${str(answers.availability)}, live-in: ${str(answers.living)}.

Your job:
1. When the caregiver describes themselves (in ANY language including Chinese), write a warm professional English bio for them.
2. After writing the bio, end with exactly this line on its own: **[Use this bio]**
3. Keep bios under 100 words — warm, specific, and trustworthy.
4. Write ONLY the English bio — no Chinese text, no intro sentences like "Here is your bio:", no "---" separators.
5. Start directly with "Hi, I'm [name]!" or similar.`
}

// --- family/post job post generator -----------------------------------------

const FAMILY_POST_PROMPT = `You are Ruah!, a warm AI assistant for a family care platform. Write natural, friendly job posts that feel personal, not corporate. Write in first person from the family's perspective. Do not use markdown headers or bullet points — just flowing sentences.`
