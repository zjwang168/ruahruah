'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import RoleSwitcher, { BecomeOtherSide } from '@/components/RoleSwitcher'
import type { Capabilities } from '@/lib/roles'

interface FamilyNavProps {
  userName?: string
  unreadCount?: number
  /** From user_self. Omitted by pages that have not loaded it; the switcher then stays hidden. */
  caps?: Capabilities
}

export default function FamilyNav({ userName, unreadCount = 0, caps }: FamilyNavProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/family/dashboard')}>
        <img src="/ruah-logo.png" alt="Ruah" className="w-8 h-8" />
        <span className="text-lg font-bold text-[#7FB3FF]">Ruah!</span>
      </div>
      <div className="flex items-center gap-4">
        {caps && <RoleSwitcher current="family" caps={caps} />}
        {caps && <BecomeOtherSide current="family" caps={caps} />}
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
            {unreadCount} new
          </span>
        )}
        <button
          onClick={() => router.push('/family/profile')}
          className="text-sm text-gray-600 hover:text-[#7FB3FF] transition"
        >
          👋 {userName}
        </button>
        <button
          onClick={() => router.push('/messages')}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          💬 Messages
        </button>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}