import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createBooking, getBooking, listBookings, setBookingStatus, updateBookingWithGuard } from './bookingsApi.js'

export function useBookingsList(params) {
  return useQuery({
    queryKey: ['bookings', params],
    queryFn: () => listBookings(params)
  })
}

export function useBooking(id) {
  return useQuery({
    queryKey: ['booking', id],
    queryFn: () => getBooking(id),
    enabled: !!id
  })
}

export function useCreateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] })
    }
  })
}

export function useUpdateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, prevUpdatedAt, patch }) => updateBookingWithGuard(id, prevUpdatedAt, patch),
    onSuccess: (row) => {
      qc.setQueryData(['booking', row.id], row)
      qc.invalidateQueries({ queryKey: ['bookings'] })
    }
  })
}

export function useSetBookingStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, prevUpdatedAt, status }) => setBookingStatus(id, prevUpdatedAt, status),
    onSuccess: (row) => {
      qc.setQueryData(['booking', row.id], row)
      qc.invalidateQueries({ queryKey: ['bookings'] })
    }
  })
}
