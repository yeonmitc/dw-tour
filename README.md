# DW Tour Frontend (Vite + React + Supabase)

필리핀처럼 인터넷이 느린 환경을 전제로, **가볍고 빠르게 로딩 + 강한 캐시(오프라인/저대역폭 대응)** 를 목표로 만든 기본 프론트엔드 템플릿입니다.

## 핵심 포인트
- React 19 + Vite
- Supabase Auth / DB 연결 기본
- TanStack React Query v5 캐시 + **Persist(IndexedDB급 localforage 기반)**
- 다중 사용자 동시 수정 대비: `updated_at` 기반의 **낙관적 동시성(optimistic concurrency)** 패턴(예시)
- 간단한 레이아웃/페이지 구조 (Dashboard / Bookings / Vouchers / Settings)

## 실행
```bash
pnpm i
pnpm dev
```

또는 npm:
```bash
npm i
npm run dev
```

## 환경변수
`.env` 파일 생성:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

샘플은 `.env.example` 참고.

## Supabase 테이블(최소 예시)
이 템플릿은 아래 컬럼이 있다고 가정하고 동작합니다(필요하면 바꿔도 됩니다).
- `bookings`: `id (uuid)`, `type`, `status`, `title`, `branch`, `start_date`, `end_date`, `pax`, `currency`, `total_amount`, `paid_status`, `updated_at`, `created_at`
- `vouchers`: `id (uuid)`, `status`, `partner`, `course`, `play_date`, `tee_time`, `pax`, `currency`, `amount`, `paid_status`, `updated_at`, `created_at`

> 실제 운영 스키마는 더 디테일하게 가져가면 되고, 프론트는 API 파일(`src/features/*/*Api.js`)에서 필드만 맞추면 됩니다.

## 배포
Vite 정적 배포:
```bash
npm run build
```
생성물은 `dist/` 입니다.
