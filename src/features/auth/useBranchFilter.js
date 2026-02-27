import { useAuthStore } from '../../store/authStore'

/**
 * 사용자 권한에 따라 Branch를 필터링하는 Hook
 * - master_office: 모든 지점 조회 가능 (branch=null or selectedBranch)
 * - office: 본인 지점만 조회 가능 (강제 고정)
 */
export function useBranchFilter() {
  const profile = useAuthStore(s => s.profile)

  // 사용자가 접근 가능한 지점인지 확인
  const canAccessBranch = (targetBranch) => {
    if (!profile) return false
    if (profile.role === 'master_office') return true // 마스터는 다 됨
    return profile.branch === targetBranch // 오피스는 자기 지점만
  }

  // API 요청 시 보낼 branch 파라미터 결정
  // (UI에서 선택한 branch가 있더라도, 권한이 없으면 본인 branch로 덮어씌움)
  const getEffectiveBranch = (selectedBranch) => {
    if (!profile) return null
    if (profile.role === 'master_office') {
      return selectedBranch || null // 선택 안하면 전체(null)
    }
    return profile.branch // 오피스는 무조건 자기 지점
  }

  return {
    userBranch: profile?.branch,
    userRole: profile?.role,
    canAccessBranch,
    getEffectiveBranch
  }
}
