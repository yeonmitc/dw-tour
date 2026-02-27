import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      session: null,
      user: null,
      profile: null, // role, branch, display_name
      
      setSession: (session) => set({ session, user: session?.user ?? null }),
      setProfile: (profile) => set({ profile }),
      
      // 로그아웃 시 초기화
      clear: () => set({ session: null, user: null, profile: null }),
    }),
    {
      name: 'travel-ops-auth-storage', // localStorage key
      storage: createJSONStorage(() => localStorage), // 기본값 (생략 가능하지만 명시)
    }
  )
)
