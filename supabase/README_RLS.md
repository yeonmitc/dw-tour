# Supabase RLS(권한/안정성) 빠른 가이드

프론트에서 아무리 잘 만들어도, 다중 사용자 동시 수정/권한/데이터 안전은 **RLS**가 핵심입니다.

## 권장 패턴
1) `profiles` 테이블: user_id, role(admin/office/guide), branch(CEBU/CLARK/...) 등 저장
2) bookings/vouchers에 `created_by`, `updated_by` 컬럼(트리거로 자동)
3) RLS 정책:
- SELECT: 같은 branch 또는 admin 허용
- INSERT: office/admin만
- UPDATE: office/admin + 같은 branch + (optional) created_by만
- DELETE: admin만 (또는 soft delete)

## 동시 수정
프론트는 `updated_at` 가드로 충돌을 줄이고,
DB는 트랜잭션/제약조건/unique 등을 통해 무결성을 유지합니다.
