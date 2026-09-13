'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import RequestSummaryCard from '@/components/RequestSummaryCard'
import { isRuahMessage, ruahMessageVisibleTo } from '@/lib/messages'
import { notifyUser } from '@/lib/notifications'

export default function ChatPage() {
  const [user, setUser] = useState<any>(null)
  const [partner, setPartner] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  // match_id -> { request, childrenAges, city } for structured request cards
  const [requestByMatch, setRequestByMatch] = useState<Record<string, any>>({})
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const params = useParams()
  const partnerId = params.partnerId as string
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userData } = await supabase
        .from('user_self').select('*').single()
      setUser(userData)

      // Get partner info. user_display, not `users`: the partner may be a
      // household or a caregiver, so neither browse view fits, and full_name
      // is no longer granted to `authenticated`. The view's gate is
      // can_view_user() — the same predicate the users policy already uses,
      // so this widens nothing; it only returns the abbreviated name.
      const { data: partnerData } = await supabase
        .from('user_display').select('id, display_name, avatar_url, role').eq('id', partnerId).single()
      setPartner(partnerData)

      // Get messages between the two users
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${authUser.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${authUser.id})`
        )
        .order('created_at', { ascending: true })

      setMessages(msgs || [])

      // Load the service request behind each match referenced in this thread,
      // so outreach shows as a structured card instead of prose alone.
      const matchIds = [...new Set((msgs || []).map(m => m.match_id).filter(Boolean))]
      if (matchIds.length > 0) {
        const { data: matchRows } = await supabase
          .from('matches')
          .select('id, service_requests(*, family_profiles(children_ages, users(city)))')
          .in('id', matchIds)
        const map: Record<string, any> = {}
        for (const row of matchRows || []) {
          const req = (row as any).service_requests
          if (!req) continue
          map[(row as any).id] = {
            request: req,
            childrenAges: req.family_profiles?.children_ages || null,
            city: req.family_profiles?.users?.city || null,
          }
        }
        setRequestByMatch(map)
      }

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('receiver_id', authUser.id)
        .eq('sender_id', partnerId)
        .is('read_at', null)

      setLoading(false)
    }
    load()

    // Realtime subscription
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, payload => {
        const msg = payload.new as any
        if (
          (msg.sender_id === partnerId) ||
          (msg.receiver_id === partnerId)
        ) {
          setMessages(prev => [...prev, msg])
          // Mark as read immediately if we're in the chat
          supabase.from('messages').update({ read_at: new Date().toISOString() })
            .eq('id', msg.id).eq('receiver_id', msg.receiver_id)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [partnerId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || sending || !user) return
    setSending(true)
    const content = input.trim()
    setInput('')

    const { data } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: partnerId,
      content,
      is_ai: false,
    }).select().single()

    if (data) {
      setMessages(prev => [...prev, data])
      // Send notification to partner (cross-user — goes through /api/notify)
      await notifyUser({
        recipientUserId: partnerId,
        type: 'message',
        title: `New message from ${user.full_name}`,
        body: content.slice(0, 100),
        data: { senderName: user.full_name }
      })
    }

    setSending(false)
  }

  const groupMessages = (msgs: any[]) => {
    const groups: { date: string; messages: any[] }[] = []
    let currentDate = ''
    for (const msg of msgs) {
      const date = new Date(msg.created_at).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
      })
      if (date !== currentDate) {
        groups.push({ date, messages: [msg] })
        currentDate = date
      } else {
        groups[groups.length - 1].messages.push(msg)
      }
    }
    return groups
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFCFF]">
      <div className="text-gray-400">Loading...</div>
    </div>
  )

  // Audience filter: Ruah's reports to one party never render for the other.
  const visibleMessages = messages.filter(m => ruahMessageVisibleTo(m, user))
  const messageGroups = groupMessages(visibleMessages)

  // Attach each match's request card to the FIRST Ruah message that carries it.
  const isRuahMsg = isRuahMessage
  const firstRuahForMatch: Record<string, string> = {}
  for (const m of visibleMessages) {
    if (isRuahMsg(m) && m.match_id && !firstRuahForMatch[m.match_id]) {
      firstRuahForMatch[m.match_id] = m.id
    }
  }

  const ruahLabel = (msg: any) => {
    if (msg.receiver_id === user?.id) return 'Ruah'
    if (user?.role === 'family') return 'Ruah · sent on your behalf'
    return `Ruah · on behalf of ${partner?.display_name?.split(' ')[0] || 'the family'}`
  }

  return (
    <div className="min-h-screen bg-[#FAFCFF] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push('/messages')}
          className="text-gray-400 hover:text-gray-600 text-sm flex-shrink-0">←</button>

        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={() => router.push(`/caregiver/${partnerId}`)}>
          {partner?.avatar_url
            ? <img src={partner.avatar_url} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
            : <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-gradient-to-br ${
                partner?.role === 'family' ? 'from-blue-400 to-purple-500' : 'from-emerald-400 to-teal-500'
              }`}>
                {partner?.display_name?.[0]?.toUpperCase() || '?'}
              </div>
          }
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 text-sm truncate">{partner?.display_name}</div>
            <div className="text-xs text-gray-400 capitalize">{partner?.role}</div>
          </div>
        </div>

        <button onClick={() => router.push(`/caregiver/${partnerId}`)}
          className="text-xs text-[#7FB3FF] flex-shrink-0">
          View Profile
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {visibleMessages.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-3xl mb-2">👋</div>
            <p className="text-sm">Start the conversation!</p>
            <p className="text-xs mt-1 text-gray-300">Say hello to {partner?.display_name}</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {messageGroups.map(group => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 flex-shrink-0">{group.date}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {group.messages.map((msg, i) => {
                  const isMine = msg.sender_id === user?.id
                  const prevMsg = group.messages[i - 1]
                  const showTime = !prevMsg ||
                    new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000

                  // Ruah speaks as itself — never as either party's bubble.
                  if (isRuahMsg(msg)) {
                    const card = msg.match_id && firstRuahForMatch[msg.match_id] === msg.id
                      ? requestByMatch[msg.match_id]
                      : null
                    return (
                      <div key={msg.id} className="flex justify-center my-3">
                        <div className="w-full max-w-[88%] space-y-2">
                          {showTime && (
                            <div className="text-xs text-gray-400 text-center">
                              {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-[#EAF4FF] to-[#FFF6F2] px-4 py-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <img src="/ruah-logo.png" alt="" className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#4A90D9]">
                                {ruahLabel(msg)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          </div>
                          {card && (
                            <RequestSummaryCard
                              request={card.request}
                              childrenAges={card.childrenAges}
                              city={card.city}
                            />
                          )}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                        {showTime && (
                          <span className={`text-xs text-gray-400 mb-1 ${isMine ? 'text-right' : 'text-left'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMine
                            ? 'text-white rounded-br-sm'
                            : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
                        }`}
                          style={isMine ? { background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' } : {}}>
                          {msg.content}
                        </div>
                        {/* Read receipt */}
                        {isMine && msg.read_at && i === group.messages.length - 1 && (
                          <span className="text-xs text-gray-300 mt-0.5">Read</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-3 sticky bottom-0">
        <div className="max-w-2xl mx-auto flex gap-3 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder={`Message ${partner?.display_name?.split(' ')[0] || ''}...`}
            rows={1}
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] resize-none"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="text-white w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition"
            style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}