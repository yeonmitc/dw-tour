# DW Tour 새 운영 화면

React/Vite 프론트엔드와 Supabase 새 데이터 구조를 사용합니다. 구현 기준은 `docs/new_01_메뉴구조도_IA.md`부터 `docs/new_05_API정의서.md`까지입니다.

## 실행

```bash
npm ci
npm run dev
```

프로젝트 루트의 `.env`에 다음 값을 둡니다. 이 파일은 Git에서 제외됩니다.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
VITE_SUPABASE_ADMIN_EMAIL=admin@example.com
```

관리자 이메일은 삭제·설정 변경·검토 확정 시 비밀번호 모달에서 사용합니다. Supabase Auth에서 해당 계정을 만든 뒤 `private.app_settings.admin_uid`에 그 사용자의 UID를 지정해야 RLS가 관리자 변경을 허용합니다. 비밀번호, `service_role`, secret 키를 `VITE_` 환경변수나 저장소에 넣지 마세요.

## 데이터베이스

새 스키마 SQL은 `supabase/migrations/20261116105558_new_system_initial.sql`에 있습니다. 초기 SQL을 이미 실행했다면 같은 마이그레이션을 다시 실행하지 마세요. 이어서 `supabase/migrations/20261116111443_fix_new_system_triggers_and_fx.sql`을 한 번 실행해야 익명 예약 수정의 변경 이력 기록과 환율 조회 테이블이 동작합니다. 현재 앱은 `markets`, `reservations`, `reservation_list`, 원본 보존 테이블 등의 새 스키마를 기대합니다. 기존 `bookings` 테이블을 조회하지 않습니다.

`seed-data/NEW 2026.xlsx`와 `seed-data/일본 수배.xlsx`의 2026년 1월 1일 이후 구간은 `scripts/import_2026_workbooks.py`로 적재했습니다. 원본 행·셀 값·수식·저장 계산값·메모·직접색은 별도 테이블에 보존합니다. 예약 날짜는 월 구획과 원본 코드의 월일을 이용한 **검토 후보**이고, 중복 코드 행도 독립 원본으로 남습니다. 취소/변경 시트의 문구 및 금액·색상의 업무 의미는 자동 확정하지 않습니다. 파일 해시와 고정 UUID를 사용해 완료된 동일 파일은 재실행 시 건너뜁니다. 재적재가 필요할 때는 관리 환경에서 `SUPABASE_URL` 및 `SUPABASE_SECRET_KEY`를 프로세스 환경 변수로 주고 스크립트를 실행하세요. 키를 브라우저용 `VITE_` 변수나 저장소 파일에 넣지 마세요. `scripts/verify_2026_import.py`로 저장 건수를 읽기 전용 확인할 수 있습니다.

환율 헤더는 `fx_rate_snapshots`와 서버의 `refresh-fx-rates` 함수가 준비되면 값을 표시합니다. 그 전에는 연결 대기로 표시됩니다. 네이버 환율을 브라우저에서 직접 가져오지 않습니다.

## 수정 위치

- `src/config/newSystem.js`: 국가 메뉴, 클락 탭, 예약/정산 열, 신규 코드 추천 규칙
- `src/features/new/api.js`: 새 스키마의 조회·저장 호출
- `src/pages/new/`: 예약, 바우처, 시제, 정산, 검색, 원본, 설정 화면
- `src/index.css`: 공통 화면과 모바일 스타일

## 빌드

```bash
npm run build
```

Vercel 같은 정적 호스팅에는 `dist/`를 배포하고 위의 환경변수 중 URL·publishable 키·관리자 이메일을 설정합니다. SPA 경로 새로고침 규칙은 `vercel.json`에 있습니다.
