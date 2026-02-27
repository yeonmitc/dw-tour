import { create } from 'zustand'

export const useUiStore = create((set) => ({
  branch: 'ALL',
  keyword: '',
  setBranch: (branch) => set({ branch }),
  setKeyword: (keyword) => set({ keyword })
}))
