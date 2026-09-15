'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { isRuahMessage, ruahMessageVisibleTo } from '@/lib/messages'
import { capabilitiesOf, pickSide, dashboardFor, readActiveRoleCookie } from '@/lib/roles'

export default function MessagesPage() {
  const [user, setUser] = useState<any>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userData } = await supabase
        .from('user_self').select('*').single()
      setUser(userData)

      // Get all messages where user is sender or receiver
      const { data: messages } = await supabase
        .from('messages')
        .select(`
          id, content, created_at, read_at, sender_id, receiver_id, sender_type, is_ai,
          sender:user_display!messages_sender_id_fkey ( id, display_name, avatar_url, role ),
          receiver:user_display!messages_receiver_id_fkey ( id, display_name, avatar_url, role ),
          matches ( service_requests ( family_id ) )
        `)
        .or(`sender_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`)
        .order('created_at', { ascending: false })

      // Audience filter: Ruah's reports to the other party never appear here,
      // not even as a preview line.
      const viewer = { id: authUser.id, familyProfileId: userData?.family_profile_id ?? null }
      const visible = (messages || []).filter(m => ruahMessageVisibleTo(m, viewer))

      // Group by conversation partner
      const convMap = new Map<string, any>()
      for (const msg of visible) {
        const partner: any = msg.sender_id === authUser.id ? msg.receiver : msg.sender
        if (!partner) continue
        const partnerId = partner.id
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, {
            partner,
            lastMessage: msg,
            unreadCount: 0,
          })
        }
        // Count unread
        if (msg.receiver_id === authUser.id && !msg.read_at) {
          const conv = convMap.get(partnerId)!
          conv.unreadCount++
        }
      }

      setConversations(Array.from(convMap.values()))
      setLoading(false)
    }
    load()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  const side = pickSide(capabilitiesOf(user), readActiveRoleCookie()) ?? 'family'
  const dashboardPath = dashboardFor(side)

  return (
    <div className="min-h-screen bg-[#FAFCFF]">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push(dashboardPath)}
          className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="font-semibold text-gray-900 text-sm">Messages</div>
        <div className="w-12" />
      </header>

      <div className="max-w-2xl mx-auto">
        {conversations.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1 text-gray-300">
              {side === 'family'
                ? 'Accept a match to start chatting with caregivers.'
                : 'Apply to a request to start chatting with families.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {conversations.map(conv => {
              const partner = conv.partner
              const last = conv.lastMessage
              const isUnread = conv.unreadCount > 0

              return (
                <div key={partner.id}
                  onClick={() => router.push(`/messages/${partner.id}`)}
                  className="flex items-center gap-4 px-6 py-4 bg-white hover:bg-gray-50 cursor-pointer transition">

                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {partner.avatar_url
                      ? <img src={partner.avatar_url} className="w-12 h-12 rounded-full object-cover" alt="" />
                      : <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br ${
                          partner.role === 'family' ? 'from-blue-400 to-purple-500' : 'from-emerald-400 to-teal-500'
                        }`}>
                          {partner.display_name?.[0]?.toUpperCase() || '?'}
                        </div>
                    }
                    {isUnread && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#7FB3FF] rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {partner.display_name}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {new Date(last.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate ${isUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                        {isRuahMessage(last) ? 'Ruah: ' : last.sender_id === user?.id ? 'You: ' : ''}{last.content}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="ml-2 bg-[#7FB3FF] text-white text-xs font-bold min-w-5 h-5 rounded-full flex items-center justify-center px-1 flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}