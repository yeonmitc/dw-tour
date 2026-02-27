import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { suppliersApi } from './suppliersApi'

export const useSuppliers = () => {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.getSuppliers,
    staleTime: 1000 * 60 * 60, // 1시간 (마스터 데이터는 자주 안 변함)
  })
}

export const useSupplier = (id) => {
  return useQuery({
    queryKey: ['suppliers', id],
    queryFn: () => suppliersApi.getSupplier(id),
    enabled: !!id,
  })
}

export const useCreateSupplier = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: suppliersApi.createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
  })
}

export const usePricingRules = (supplierId) => {
  return useQuery({
    queryKey: ['pricing_rules', supplierId],
    queryFn: () => suppliersApi.getPricingRules(supplierId),
    enabled: !!supplierId,
  })
}

export const useCreatePricingRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: suppliersApi.createPricingRule,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pricing_rules', variables.supplier_id] })
    },
  })
}

export const useHolidays = (branch) => {
  return useQuery({
    queryKey: ['holidays', branch],
    queryFn: () => suppliersApi.getHolidays(branch),
    staleTime: 1000 * 60 * 60 * 24, // 24시간
  })
}
