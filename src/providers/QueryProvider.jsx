import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import localforage from 'localforage'

const PERSIST_KEY = 'travel_ops_rq_cache_v1'

function createPersister() {
  // localforage: 브라우저가 가능하면 IndexedDB를 사용 (느린 인터넷/오프라인에 유리)
  // query-sync-storage-persister는 localStorage 기반이지만,
  // 여기서는 localforage를 래핑하여 최소 구현으로 persistence 동작만 유지한다.
  const store = localforage.createInstance({ name: PERSIST_KEY })
  return {
    persistClient: async (client) => {
      await store.setItem('client', client)
    },
    restoreClient: async () => {
      return await store.getItem('client')
    },
    removeClient: async () => {
      await store.removeItem('client')
    }
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5분 동안은 신선
      gcTime: 1000 * 60 * 60 * 24,   // 24시간 캐시 유지
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true
    },
    mutations: {
      retry: 0
    }
  }
})

let persisted = false
async function initPersistence() {
  if (persisted) return
  persisted = true
  const persister = createPersister()
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24 // 24시간
  })
}
initPersistence()

export function QueryProvider({ children }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
