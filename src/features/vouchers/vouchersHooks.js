import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createVoucher, listVouchers, updateVoucherWithGuard } from './vouchersApi.js'

export function useVouchersList(params) {
  return useQuery({
    queryKey: ['vouchers', params],
    queryFn: () => listVouchers(params)
  })
}

export function useCreateVoucher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createVoucher,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vouchers'] })
  })
}

export function useUpdateVoucher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, prevUpdatedAt, patch }) => updateVoucherWithGuard(id, prevUpdatedAt, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vouchers'] })
  })
}
