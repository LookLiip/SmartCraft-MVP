import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'worker' | 'admin' | 'owner';

interface UserState {
  voiceConsentGiven: boolean
  role: UserRole
  setVoiceConsentGiven: (given: boolean) => void
  setRole: (role: UserRole) => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      voiceConsentGiven: false,
      role: 'worker', // Default to worker for the mobile app
      setVoiceConsentGiven: (given) => set({ voiceConsentGiven: given }),
      setRole: (role) => set({ role }),
    }),
    { name: 'smartcraft-user-storage' }
  )
)
