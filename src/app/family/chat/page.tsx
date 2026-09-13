'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ReactMarkdown from 'react-markdown'

type CaregiverCard = {
  id: string
  user_id: string
  bio: string | null
  services: string[]
  languages: string[]
  years_experience: number
  hourly_rate_min: number | null
  hourly_rate_max: number | null
  is_verified: boolean
  users: {
    // caregiver_public serves an abbreviated name — "Sarah C." — computed by
    // public.display_name(). The surname never leaves Postgres.
    display_name: string
    avatar_url: string | null
    city: string | null
  }
}

type Message = {
  role: 'user' | 'assistant'
  content: string
  caregivers?: CaregiverCard[]
}

const SUGGESTIONS = [
  "Find me a caregiver based on my needs",
  "Help me write a job post based on my needs",
  "What questions should I ask in a caregiver interview?",
  "Compare full-time nanny vs au pair options",
]

// The system prompt now lives server-side in src/lib/chat/prompts.ts under
// the key 'family_chat'. /api/chat rebuilds it from this family's own profile,
// read through their session — the client no longer supplies it.

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm Ruah! 👋 I'm here to help you find the perfect care for your family. Ask me anything — I'm ready to help!"
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [familyProfile, setFamilyProfile] = useState<any>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [contacting, setContacting] = useState<string | null>(null)
  // Holds a caregiver passed via URL (?caregiver=...&name=...) so we can
  // auto-start a focused conversation about that specific caregiver.
  const [focusCaregiver, setFocusCaregiver] = useState<{ id: string; name: string } | null>(null)
  const [autoStarted, setAutoStarted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Read caregiver context from the URL once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const sp = new URLSearchParams(window.location.search)
    const cgId = sp.get('caregiver')
    const cgName = sp.get('name')
    if (cgId) {
      setFocusCaregiver({ id: cgId, name: cgName || 'this caregiver' })
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: userData } = await supabase.from('user_self').select('*').single()
      const { data: profileData } = await supabase.from('family_self').select('*').single()
      setUser(userData)
      setFamilyProfile(profileData)
      setProfileLoaded(true)
    }
    load()
  }, [])

  // Once the profile is loaded, if we arrived with a caregiver in the URL,
  // auto-send a focused opening message about that caregiver.
  useEffect(() => {
    if (profileLoaded && focusCaregiver && !autoStarted) {
      setAutoStarted(true)
      sendMessage(
        `Tell me about ${focusCaregiver.name} and help me decide if they're a good fit. If they seem like a match, you can offer to reach out to them for me.`,
        focusCaregiver.id
      )
    }
  }, [profileLoaded, focusCaregiver, autoStarted])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const findCaregivers = async () => {
    const answers = familyProfile?.onboarding_answers || {}
    const response = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        services: answers.services || [],
        languages: answers.languages || [],
        budget: answers.childcare_budget,
        familyUserId: user?.id
      })
    })
    const data = await response.json()
    return data.caregivers || []
  }

  // Fetch a single caregiver card by user id (for the focused-caregiver flow)
  const fetchCaregiverCard = async (caregiverUserId: string): Promise<CaregiverCard[]> => {
    const { data } = await supabase
      .from('caregiver_public')
      .select(`
        id, user_id, bio, services, languages, years_experience,
        hourly_rate_min, hourly_rate_max, is_verified, users
      `)
      .eq('user_id', caregiverUserId)
      .single()
    return data ? [data as any] : []
  }

  const contactCaregiver = async (cg: CaregiverCard) => {
    setContacting(cg.user_id)

    // Only the caregiver is named. Who the family is, what they need, and the
    // names on the message all come from the session server-side — the client
    // no longer gets to assert any of it.
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caregiverUserId: cg.user_id })
      })
      const data = await res.json()
      if (data.success) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `✅ I've reached out to **${cg.users?.display_name || 'this caregiver'}** on your behalf!\n\nHere's the message I sent:\n\n*"${data.message}"*\n\nI'll let you know when they respond! 🐻`
        }])
      } else {
        // Most often the contact guardrails spacing things out (429).
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.error || "Sorry, I couldn't reach out just now. Please try again! 🐻"
        }])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, something went wrong. Please try again! 🐻"
      }])
    } finally {
      setContacting(null)
    }
  }

  // focusCaregiverId: when set, show this specific caregiver's card with the reply
  // instead of running a full match search.
  const sendMessage = async (text?: string, focusCaregiverId?: string) => {
    const userMessage = text || input.trim()
    if (!userMessage || loading || !profileLoaded) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.concat({ role: 'user', content: userMessage }).map(m => ({
            role: m.role,
            content: m.content
          })),
          promptKey: 'family_chat'
        })
      })

      const data = await response.json()
      const assistantMessage = data.content[0].text

      // Focused caregiver flow: attach that one caregiver's card to the reply
      if (focusCaregiverId) {
        const cards = await fetchCaregiverCard(focusCaregiverId)
        const cleanMessage = assistantMessage.replace('[FIND_CAREGIVERS]', '').trim()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: cleanMessage,
          caregivers: cards
        }])
      } else if (assistantMessage.includes('[FIND_CAREGIVERS]')) {
        const caregivers = await findCaregivers()
        const cleanMessage = assistantMessage.replace('[FIND_CAREGIVERS]', '').trim()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: cleanMessage || "Here are some caregivers that match your needs! 🎉",
          caregivers
        }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting right now. Please try again! 🐻"
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFCFF] flex flex-col">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/family/dashboard')} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex items-center gap-2">
          <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">Ruah! AI Assistant</div>
            <div className="text-xs text-green-500">● Online</div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}>
            {msg.role === 'assistant' && (
              <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8 mr-2 flex-shrink-0 mt-1" />
            )}
            <div className="max-w-[85%]">
              {msg.content && (
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'text-white rounded-br-sm'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm'
                }`}
                  style={msg.role === 'user' ? {
                    background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)'
                  } : {}}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className="text-sm">{children}</li>,
                        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                        em: ({ children }) => <em className="italic text-gray-600">{children}</em>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : msg.content}
                </div>
              )}

              {/* Caregiver Cards */}
              {msg.caregivers && msg.caregivers.length > 0 && (
                <div className="mt-3 space-y-3">
                  {msg.caregivers.map(cg => (
                    <div key={cg.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {cg.users?.avatar_url ? (
                            <img src={cg.users.avatar_url} alt={cg.users.display_name} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#EAF4FF] to-[#FFF6F2] flex items-center justify-center text-lg font-bold text-[#7FB3FF]">
                              {cg.users?.display_name?.[0] || '?'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 text-sm">{cg.users?.display_name || 'Caregiver'}</span>
                            {cg.is_verified && (
                              <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">✓ Verified</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {cg.languages?.slice(0, 3).map(lang => (
                              <span key={lang} className="text-xs bg-[#EAF4FF] text-[#4A90D9] px-2 py-0.5 rounded-full">{lang}</span>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            {cg.years_experience > 0 && <span>⭐ {cg.years_experience}+ yrs</span>}
                            {cg.hourly_rate_min && (
                              <span>💰 ${cg.hourly_rate_min}{cg.hourly_rate_max ? `–$${cg.hourly_rate_max}` : '+'}/hr</span>
                            )}
                            {cg.users?.city && <span>📍 {cg.users.city}</span>}
                          </div>
                          {cg.bio && (
                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{cg.bio}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          disabled={contacting === cg.user_id}
                          onClick={() => contactCaregiver(cg)}
                          className="flex-1 text-white py-2 rounded-xl text-xs font-semibold transition disabled:opacity-60"
                          style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
                        >
                          {contacting === cg.user_id ? '⏳ Contacting...' : '🤝 Let Ruah Contact'}
                        </button>
                        <button
                          className="px-4 py-2 rounded-xl text-xs font-medium border-2 border-[#7FB3FF] text-[#7FB3FF] hover:bg-blue-50 transition"
                          onClick={() => router.push(`/caregiver/${cg.user_id}`)}
                        >
                          View Profile
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {msg.caregivers && msg.caregivers.length === 0 && (
                <div className="mt-3 bg-white border border-gray-100 rounded-2xl p-4 text-center text-sm text-gray-400">
                  No caregivers found yet. We're growing our community! 🐻
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="mb-4 flex justify-start">
            <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8 mr-2 flex-shrink-0 mt-1" />
            <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#7FB3FF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#7FB3FF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#7FB3FF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {messages.length === 1 && !focusCaregiver && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-gray-400 text-center mb-3">Quick questions to get started</p>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => sendMessage(s)}
                className="w-full text-left text-sm bg-white border border-gray-100 rounded-2xl px-4 py-3 text-gray-600 hover:border-[#7FB3FF] hover:text-[#7FB3FF] transition shadow-sm">
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="bg-white border-t border-gray-100 px-4 py-4">
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
            placeholder="Ask Ruah anything about finding care..."
            rows={1}
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FB3FF] resize-none"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading || !profileLoaded}
            className="text-white w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition"
            style={{ background: 'linear-gradient(135deg, #7FB3FF 0%, #A78BFA 100%)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}