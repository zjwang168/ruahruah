'use client'

import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n/provider'
import { writeActiveRoleCookie, dashboardFor, type Side, type Capabilities } from '@/lib/roles'

/**
 * The two sides of one account, as a segmented control in the dashboard
 * header. Renders NOTHING unless both profiles exist — every account that
 * exists today has one, and for them this change is invisible.
 *
 * Switching is a navigation, not a mutation. The proxy records the side you
 * land on in the cookie, so nothing here has to remember it.
 */
export default function RoleSwitcher({ current, caps }: { current: Side; caps: Capabilities }) {
  const router = useRouter()
  const t = useT()
  if (!caps.family || !caps.caregiver) return null

  const go = (side: Side) => {
    if (side === current) return
    writeActiveRoleCookie(side)
    router.push(dashboardFor(side))
  }

  return (
    <div
      role="group"
      aria-label={t('common.role.switch')}
      className="inline-flex shrink-0 items-center rounded-full border border-gray-200 bg-white/70 p-0.5"
    >
      {(['family', 'caregiver'] as const).map(side => {
        const active = side === current
        return (
          <button
            key={side}
            type="button"
            onClick={() => go(side)}
            aria-pressed={active}
            className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap transition ${
              active ? 'bg-[#7FB3FF] text-white' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t(side === 'family' ? 'common.role.family' : 'common.role.caregiver')}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The entry into the OTHER side, for an account that has only one. Goes into
 * the existing onboarding funnel; /onboarding/register sees the session and
 * writes only the missing profile row.
 */
export function BecomeOtherSide({ current, caps }: { current: Side; caps: Capabilities }) {
  const router = useRouter()
  const t = useT()
  const other: Side = current === 'family' ? 'caregiver' : 'family'
  if (caps[other]) return null
  return (
    <button
      type="button"
      onClick={() => router.push(`/onboarding/${other}`)}
      className="text-sm text-gray-400 hover:text-gray-600"
    >
      {t(other === 'caregiver' ? 'common.role.becomeCaregiver' : 'common.role.becomeFamily')}
    </button>
  )
}
