import { useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuthStore } from '../../store/authStore.js'
import { getSession } from './authApi.js'

// 앱 시작 시 세션 연결 + 세션 변경 감지
export function useAuthBootstrap() {
  const setSession = useAuthStore(s => s.setSession)
  const clear = useAuthStore(s => s.clear)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      try {
        const session = await getSession()
        if (mounted) setSession(session)
      } catch (e) {
        console.warn(e)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSession(session)
      else clear()
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [setSession, clear])
}
