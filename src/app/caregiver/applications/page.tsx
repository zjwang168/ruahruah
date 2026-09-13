'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/provider'
import { HTML_LANG } from '@/lib/i18n/config'
import { serviceLabel } from '@/lib/i18n/labels'

export default function CaregiverApplicationsPage() {
  const [user, setUser] = useState<any>(null)
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { t, locale } = useI18n()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userData } = await supabase
        .from('user_self').select('*').single()
      const { data: caregiverData } = await supabase
        .from('caregiver_profiles').select('id').eq('user_id', authUser.id).single()

      let appsData: any[] = []
      if (caregiverData?.id) {
        // "My applications" = caregiver-initiated matches by this caregiver
        const { data: rawApps } = await supabase
          .from('matches')
          .select(`*, service_requests(id, service_type, status, pay_min, pay_max, ai_job_post, created_at, family_profiles(user_id))`)
          .eq('caregiver_id', caregiverData.id)
          .eq('initiated_by', 'caregiver')
          .order('created_at', { ascending: false })

        const familyUserIds = [...new Set(
          (rawApps || []).map((a: any) => a.service_requests?.family_profiles?.user_id).filter(Boolean)
        )]

        let familyUsersMap: Record<string, any> = {}
        if (familyUserIds.length > 0) {
          // family_public, not `users`: full_name is no longer granted to
          // `authenticated`, and the view serves the abbreviation the card
          // renders anyway. Keyed by user_id — the view carries both ids.
          const { data: familyUsersData } = await supabase
            .from('family_public').select('user_id, display_name, avatar_url').in('user_id', familyUserIds)
          familyUsersData?.forEach((u: any) => { familyUsersMap[u.user_id] = u })
        }

        appsData = (rawApps || []).map((a: any) => ({
          ...a,
          familyUser: familyUsersMap[a.service_requests?.family_profiles?.user_id] || null
        }))
      }

      setUser(userData)
      setApplications(appsData)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">{t('common.loading')}</div>
    </div>
  )

  // Derive a display status from the unified match fields
  const displayStatus = (a: any) => {
    if (a.status === 'accepted') return 'accepted'
    if (a.status === 'declined' || a.family_interested === false) return 'declined'
    return 'pending'
  }

  const counts = {
    all: applications.length,
    pending: applications.filter(a => displayStatus(a) === 'pending').length,
    accepted: applications.filter(a => displayStatus(a) === 'accepted').length,
    declined: applications.filter(a => displayStatus(a) === 'declined').length,
  }

  const filtered = statusFilter === 'all'
    ? applications
    : applications.filter(a => displayStatus(a) === statusFilter)

  const FILTERS = [
    { key: 'all', label: t('cg.apps.filter.all') },
    { key: 'pending', label: t('cg.apps.filter.pending') },
    { key: 'accepted', label: t('cg.apps.filter.accepted') },
    { key: 'declined', label: t('cg.apps.filter.declined') },
  ] as const

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/caregiver/dashboard')}
          className="text-gray-400 hover:text-gray-600 text-sm">← {t('common.back')}</button>
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-sm">{t('cg.apps.title')}</div>
          <div className="text-xs text-gray-400">{t('cg.apps.total', { count: applications.length })}</div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-6">
        {/* Filter pills */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition border ${
                statusFilter === f.key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              {f.label} {counts[f.key as keyof typeof counts] > 0 && `(${counts[f.key as keyof typeof counts]})`}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📩</div>
            <p className="text-sm">
              {statusFilter === 'all' ? t('cg.apps.empty') : t('cg.apps.emptyFiltered')}
            </p>
            <button onClick={() => router.push('/caregiver/requests')}
              className="mt-2 text-xs text-[#7FB3FF] hover:underline">
              {t('cg.apps.browse')}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(app => {
              const req = app.service_requests
              const familyUser = app.familyUser
              const familyUserId = req?.family_profiles?.user_id
              const status = displayStatus(app)
              // Abbreviated by public.display_name() before it left Postgres.
              const displayName = familyUser?.display_name || t('cg.apps.family')

              return (
                <div key={app.id} className={`bg-white rounded-2xl border p-4 ${
                  status === 'accepted' ? 'border-green-200 bg-green-50/20'
                  : status === 'declined' ? 'border-red-100 opacity-70'
                  : 'border-gray-100'
                }`}>
                  <div className="flex items-center gap-3">
                    {familyUser?.avatar_url
                      ? <img src={familyUser.avatar_url} className="w-11 h-11 rounded-full object-cover flex-shrink-0" alt="" />
                      : <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {familyUser?.display_name?.[0]?.toUpperCase() || '?'}
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{displayName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          status === 'accepted' ? 'bg-green-100 text-green-600'
                          : status === 'declined' ? 'bg-red-100 text-red-400'
                          : 'bg-yellow-100 text-yellow-600'
                        }`}>{t(`cg.apps.status.${status}` as 'cg.apps.status.pending')}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                        <span>{serviceLabel(t, req?.service_type)}</span>
                        {(req?.pay_min || req?.pay_max) && (
                          <span>· ${req.pay_min}{req.pay_max ? `–$${req.pay_max}` : '+'}{t('common.perHour')}</span>
                        )}
                        <span>· {t('cg.apps.applied', {
                          date: new Date(app.created_at).toLocaleDateString(
                            HTML_LANG[locale], { month: 'short', day: 'numeric' }
                          ),
                        })}</span>
                      </div>
                    </div>
                    {status === 'accepted' && familyUserId && (
                      <button onClick={() => router.push(`/messages/${familyUserId}`)}
                        className="text-xs px-3 py-1.5 rounded-lg text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
                        💬 {t('cg.apps.message')}
                      </button>
                    )}
                  </div>

                  {app.initiator_message && (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <div className="text-xs text-gray-400 mb-1">{t('cg.apps.yourMessage')}</div>
                      <p className="text-sm text-gray-600 leading-relaxed">{app.initiator_message}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}