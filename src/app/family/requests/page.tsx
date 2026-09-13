'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FamilyNav from '@/components/FamilyNav'

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function formatTime(t: string) {
  const [h, m] = t.split(':')
  const hour = parseInt(h)
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

function RequestCard({ request: r, onClose, onReopen, onDelete, onViewApplications, onEdit }: {
  request: any; onClose: () => void; onReopen: () => void; onDelete: () => void; onViewApplications: () => void; onEdit: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  // Count caregiver-initiated matches (i.e. caregivers who applied to this request)
  const applicationCount = (r.matches || []).filter((m: any) => m.initiated_by === 'caregiver').length
  const isOpen = r.status === 'open'
  const scheduleDays = r.schedule_days || {}
  const sortedDays = DAY_ORDER.filter(d => scheduleDays[d])

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 transition bg-white">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="font-semibold text-gray-900 capitalize">{r.service_type}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                r.status === 'open' ? 'bg-green-100 text-green-600'
                : r.status === 'filled' ? 'bg-gray-100 text-gray-500'
                : 'bg-yellow-100 text-yellow-600'
              }`}>{r.status}</span>
              {r.schedule_type && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-500">
                  {r.schedule_type === 'recurring' ? '🔄 Recurring' : '1️⃣ One-time'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
              {(r.pay_min || r.pay_max) && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <span>💰</span>
                  <span className="font-medium">${r.pay_min}{r.pay_max ? `–$${r.pay_max}` : '+'}/hr</span>
                </div>
              )}
              {r.start_date && (
                <div className="flex items-center gap-1.5 text-gray-700">
                  <span>📅</span>
                  <span>Starts {new Date(r.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              )}
              {applicationCount > 0 && (
                <div className="flex items-center gap-1.5 text-[#7FB3FF]">
                  <span>📩</span>
                  <span className="font-medium">{applicationCount} interested</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                <span>🕐</span>
                <span>Posted {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
            {sortedDays.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-gray-400 mb-1.5">Schedule</div>
                <div className="space-y-1">
                  {sortedDays.map(day => {
                    const times = scheduleDays[day]
                    return (
                      <div key={day} className="flex justify-between text-xs">
                        <span className="text-gray-600 capitalize w-24">{day}</span>
                        <span className="text-gray-500">{formatTime(times.start)} – {formatTime(times.end)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {r.languages?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {r.languages.map((lang: string) => (
                  <span key={lang} className="text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">🗣 {lang}</span>
                ))}
              </div>
            )}
            {r.requirements?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {r.requirements.map((req: string) => (
                  <span key={req} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{req}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setExpanded(p => !p)} className="text-gray-300 text-xs flex-shrink-0 mt-1">
            {expanded ? '▲' : '▼'}
          </button>
        </div>
        {expanded && r.ai_job_post && (
          <div className="border-t border-gray-50 pt-3 mb-3">
            <div className="text-xs text-gray-400 mb-1">Job description</div>
            <p className="text-sm text-gray-600 leading-relaxed">{r.ai_job_post}</p>
          </div>
        )}
        <div className="flex gap-2 flex-wrap border-t border-gray-50 pt-3">
          {applicationCount > 0 && (
            <button onClick={onViewApplications}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white min-w-[100px]"
              style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
              📩 View Matches
            </button>
          )}
          <button onClick={onEdit}
            className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition min-w-[80px]">
            ✏️ Edit
          </button>
          {isOpen ? (
            <button onClick={onClose}
              className="flex-1 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-300 transition min-w-[80px]">
              ✓ Mark Filled
            </button>
          ) : (
            <button onClick={onReopen}
              className="flex-1 py-2 rounded-xl text-xs font-medium border border-[#7FB3FF] text-[#7FB3FF] hover:bg-blue-50 transition min-w-[80px]">
              ↺ Reopen
            </button>
          )}
          <button onClick={onDelete}
            className="px-3 py-2 rounded-xl text-xs font-medium border border-gray-100 text-gray-300 hover:border-red-200 hover:text-red-400 transition">
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FamilyRequestsPage() {
  const [user, setUser] = useState<any>(null)
  const [familyProfile, setFamilyProfile] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userData } = await supabase.from('user_self').select('*').single()
      const { data: familyData } = await supabase.from('family_self').select('*').single()
      const { data: notifData } = await supabase.from('notifications').select('id, read').eq('user_id', authUser.id).neq('type', 'admin_escalation')

      let requestsData: any[] = []
      if (familyData?.id) {
        const { data } = await supabase
          .from('service_requests')
          .select('*, matches(id, status, initiated_by)')
          .eq('family_id', familyData.id)
          .order('created_at', { ascending: false })
        requestsData = data || []
      }

      setUser(userData)
      setFamilyProfile(familyData)
      setRequests(requestsData)
      setUnreadCount((notifData || []).filter((n: any) => !n.read).length)
      setLoading(false)
    }
    load()
  }, [])

  const closeRequest = async (requestId: string) => {
    await supabase.from('service_requests').update({ status: 'filled' }).eq('id', requestId)
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'filled' } : r))
  }

  const reopenRequest = async (requestId: string) => {
    await supabase.from('service_requests').update({ status: 'open' }).eq('id', requestId)
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'open' } : r))
  }

  const deleteRequest = async (requestId: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return
    await supabase.from('service_requests').delete().eq('id', requestId)
    setRequests(prev => prev.filter(r => r.id !== requestId))
  }

  const hasOpenRequest = requests.some(r => r.status === 'open')

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <FamilyNav userName={user?.full_name} unreadCount={unreadCount} />

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/family/dashboard')}
              className="text-gray-400 hover:text-gray-600 text-sm">
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">My Requests</h1>
          </div>
          {!hasOpenRequest && (
            <button
              onClick={() => router.push('/family/post')}
              className="text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
              style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
              + New Request
            </button>
          )}
        </div>

        {requests.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm mb-4">No requests yet.</p>
            <button
              onClick={() => router.push('/family/post')}
              className="text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition"
              style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}>
              Post My First Request
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(r => (
              <RequestCard
                key={r.id}
                request={r}
                onClose={() => closeRequest(r.id)}
                onReopen={() => reopenRequest(r.id)}
                onDelete={() => deleteRequest(r.id)}
                onViewApplications={() => router.push('/family/matches')}
                onEdit={() => router.push(`/family/post?edit=${r.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}