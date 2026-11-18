import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Customer names, notes and settlement details stay in memory only.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
})

export function QueryProvider({ children }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
