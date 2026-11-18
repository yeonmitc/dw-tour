# 05 — API 정의서

> DW Tour 프론트엔드에서 호출하는 모든 Supabase API 엔드포인트, Method, Request/Response 포맷 명세

---

## 1. 개요

DW Tour는 **Supabase PostgREST**를 통해 PostgreSQL에 직접 접근합니다.  
프론트엔드의 `*Api.js` 파일에서 `supabase.from('table').select/insert/update/delete()` 형태로 호출하며,  
Supabase JS Client가 자동으로 RESTful HTTP 요청으로 변환합니다.

### 1.1 인증

| 항목 | 값 |
|---|---|
| 엔드포인트 | `VITE_SUPABASE_URL` (환경변수) |
| 인증 키 | `VITE_SUPABASE_ANON_KEY` (환경변수) |
| 인증 방식 | Supabase Auth (email/password) |
| Authorization 헤더 | `Bearer {access_token}` (Supabase 클라이언트가 자동 첨부) |
| API 헤더 | `apikey: {anon_key}` (Supabase 클라이언트가 자동 첨부) |

### 1.2 공통 응답 포맷

Supabase PostgREST 표준 응답:

```json
// 성공 시
{
  "data": { ... },      // 또는 [ ... ] (배열)
  "error": null,
  "count": null,        // count 옵션 사용 시
  "status": 200,
  "statusText": "OK"
}

// 에러 시
{
  "data": null,
  "error": {
    "message": "error message",
    "details": "...",
    "hint": "...",
    "code": "PGRST116"
  }
}
```

### 1.3 공통 에러 코드

| HTTP 상태 | 의미 | 발생 상황 |
|---|---|---|
| 200 | 성공 | SELECT, UPDATE, DELETE |
| 201 | 생성 성공 | INSERT |
| 400 | 잘못된 요청 | 필수 필드 누락, 타입 오류 |
| 401 | 인증 실패 | 토큰 만료 또는 미인증 |
| 403 | 권한 없음 | RLS 정책 위반 |
| 404 | 없음 | .single() 시 행 미존재 |
| 409 | 충돌 | 유니크 제약 위반 |
| PGRST116 | 행 미존재 | .single() 대상 행 없음 |

---

## 2. 인증 API

### 2.1 로그인

- **호출**: `src/features/auth/authApi.js` → `signInWithEmail()`

```
POST /auth/v1/token?grant_type=password
```

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| email | string | 예 | 이메일 주소 |
| password | string | 예 | 비밀번호 |

**Response**:
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "abc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    ...
  }
}
```

### 2.2 세션 조회

- **호출**: `getSession()`

```
GET /auth/v1/token
Authorization: Bearer {access_token}
```

**Response**: 현재 세션 정보 (user + access_token)

### 2.3 로그아웃

- **호출**: `signOut()`

```
POST /auth/v1/logout
Authorization: Bearer {access_token}
```

### 2.4 Auth State Change 리스너

- `supabase.auth.onAuthStateChange(callback)`
- 이벤트: `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`

---

## 3. 예약 API (Bookings)

### 3.1 예약 목록 조회

- **호출**: `src/features/bookings/bookingsApi.js` → `listBookings()`
- **리턴**: `bookingsApi.listBookings(params)`

```
GET /rest/v1/booking_dashboard_view
  ?select=id,code,status,paid_status,branch,start_date,end_date,pax,total_amount,currency,
          deposit_date,flight_info,customer_name,partner_code,base_date,memo,hotel_note,sc,
          first_hotel_name,first_hotel_note,"1TH","2TH","3TH","4TH","5TH","6TH",trans,
          created_at,updated_at,guide_vehicle,hotel_status,hotel_voucher_number,hotel_paid,
          hotel_paid_amount,golf_status,golf_voucher_number,golf_final,
          memo_1,pay_status_1,change_tee_time_1,
          memo_2,pay_status_2,change_tee_time_2,
          memo_3,pay_status_3,change_tee_time_3,
          memo_4,pay_status_4,change_tee_time_4,
          memo_5,pay_status_5,change_tee_time_5,
          memo_6,pay_status_6,change_tee_time_6
  &order=start_date.asc
  [&branch=eq.{branch}]           // branch !== 'ALL' 일 때
  [&status=eq.{status}]           // status !== 'ALL' 일 때
  [&hotel_paid=eq.{true|false}]   // hotelPaid === 'PAID'|'UNPAID' 일 때
  [&paid_status=eq.{paidStatus}] // paidStatus !== 'ALL' 일 때
  [&or=(customer_name.ilike.*{keyword}*,code.ilike.*{keyword}*,partner_code.ilike.*{keyword}*)]
  // 또는 날짜 필터 (키워드 없을 때):
  [&start_date=gte.{from}]
  [&start_date=lte.{to}]
```

**Request Parameters**:

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| branch | string | 'ALL' | 브랜치 필터 |
| keyword | string | '' | 검색어 (customer_name/code/partner_code) |
| status | string | 'ALL' | 예약 상태 필터 |
| hotelPaid | string | 'ALL' | 호텔 결제 필터 ('PAID'/'UNPAID'/'ALL') |
| paidStatus | string | 'ALL' | 결제 상태 필터 |
| from | string | - | 시작 날짜 (ISO, 키워드 없을 때만) |
| to | string | - | 종료 날짜 (ISO, 키워드 없을 때만) |

**Response**: `Array<BookingRow>` + 수동 조인으로 `partner_name` 추가

```json
[
  {
    "id": "uuid",
    "code": "PKG251113-MK01",
    "status": "NEW",
    "paid_status": "UNPAID",
    "branch": "PHILIPPINES",
    "start_date": "2025-11-13",
    "end_date": "2025-11-15",
    "pax": 4,
    "total_amount": 120000,
    "currency": "PHP",
    "customer_name": "김철수",
    "partner_code": "MK",
    "partner_name": "Monkey Travel",
    ...
  }
]
```

**수동 조인 로직**:
1. `booking_dashboard_view`에서 예약 목록 조회
2. 고유 `partner_code` 추출
3. `partners` 테이블에서 `code.in.(partnerCodes)` 조회
4. `partner_name` 매핑하여 반환

---

### 3.2 예약 단건 조회

- **호출**: `getBooking(id)`

```
GET /rest/v1/bookings?id=eq.{id}&select=*
```

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | uuid | 예 | 예약 ID |

**Response**: 단일 `bookings` 행 전체 컬럼

---

### 3.3 예약 생성

- **호출**: `createBooking(payload)`

```
POST /rest/v1/bookings
Content-Type: application/json

{
  "code": "PKG251113-MK01",
  "status": "NEW",
  "paid_status": "UNPAID",
  "branch": "PHILIPPINES",
  "product_code": "PKG",
  "partner_code": "MK",
  "base_date": "2025-11-13",
  "start_date": "2025-11-13",
  "end_date": "2025-11-15",
  "pax": 4,
  "currency": "PHP",
  "total_amount": 120000,
  "customer_name": "김철수",
  "customer_name_en": "Chulsoo Kim",
  ...
}
```

**Response**: 생성된 행 전체 (`select=*`)

---

### 3.4 예약 수정 (단순)

- **호출**: `updateBooking(id, patch)` — 인라인 편집용

```
PATCH /rest/v1/bookings?id=eq.{id}
Content-Type: application/json

{
  "status": "CONFIRMED",
  "memo": "수정된 메모"
}
```

**Response**: 수정된 행 전체

---

### 3.5 예약 수정 (낙관적 동시성 가드)

- **호출**: `updateBookingWithGuard(id, prevUpdatedAt, patch)`

```
PATCH /rest/v1/bookings?id=eq.{id}&updated_at=eq.{prevUpdatedAt}
Content-Type: application/json

{
  "status": "CONFIRMED",
  ...
}
```

**비즈니스 로직**:
1. `id`와 `updated_at`을 동시에 조건으로 UPDATE 실행
2. 행이 1건 업데이트되면 성공 → 업데이트된 행 반환
3. 행이 0건이면 충돌 → `CONFLICT` 에러 throw

**에러 응답 (프론트엔드 throw)**:
```json
{
  "message": "CONFLICT: someone updated this booking. Please refresh and retry.",
  "code": "CONFLICT"
}
```

---

### 3.6 예약 상태 변경

- **호출**: `setBookingStatus(id, prevUpdatedAt, status)`

```
PATCH /rest/v1/bookings?id=eq.{id}&updated_at=eq.{prevUpdatedAt}
{ "status": "CONFIRMED" }
```

`updateBookingWithGuard` 내부 호출

---

### 3.7 날짜별 서비스 항목 Upsert

- **호출**: `upsertBookingDayItem(payload)`

```
POST /rest/v1/booking_day_items_mb
  ?onConflict=booking_id,service_date,slot_no
Content-Type: application/json
Prefer: resolution=merge-duplicates,return=representation

{
  "booking_id": "uuid",
  "service_date": "2025-11-13",
  "slot_no": 1,
  "service_type": "GOLF",
  "detail_name": "KCC",
  "pax": 4,
  "unit_price": 3500,
  "unit_count": 1,
  "total_amount": 14000,
  "currency": "PHP"
}
```

**Response**: Upsert된 행

---

## 4. 바우처 API (Vouchers)

### 4.1 바우처 목록 조회

- **호출**: `src/features/vouchers/vouchersApi.js` → `listVouchers()`

```
GET /rest/v1/vouchers
  ?select=id,status,partner_name,play_date,tee_time,pax,currency,amount,paid_status,
          updated_at,created_at,voucher_no,request_note,manager,reserver_name,
          schedule_1,schedule_2,schedule_3,schedule_4,booking_code,change_tee_time_1
  &order=play_date.asc
  [&branch=eq.{branch}]
  [&status=eq.{status}]
  [&play_date=gte.{from}]
  [&play_date=lte.{to}]
  [&partner_name.ilike.*{keyword}*]
```

**Response**: `Array<VoucherRow>` + 수동 조인으로 customer_name/customer_name_en 추가

**수동 조인 로직**:
1. `vouchers` 테이블에서 목록 조회
2. 고유 `booking_code` 추출
3. `bookings` 테이블에서 `code.in.(bookingCodes)` → customer_name 조회
4. 매핑하여 반환

---

### 4.2 바우처 생성

- **호출**: `createVoucher(payload)`

```
POST /rest/v1/vouchers
Content-Type: application/json

{
  "status": "NEW",
  "partner_name": "Monkey Travel",
  "play_date": "2025-11-15",
  "tee_time": "10:00",
  "pax": 4,
  "currency": "PHP",
  "amount": 14000,
  "paid_status": "UNPAID",
  "booking_code": "GONLY1115-MK4KCC",
  "schedule_1": "11/15 KCC 10:00",
  "manager": "홍길동",
  "reserver_name": "김철수",
  "request_note": "",
  "branch": "PHILIPPINES"
}
```

**Response**: 생성된 행

---

### 4.3 바우처 수정 (낙관적 동시성 가드)

- **호출**: `updateVoucherWithGuard(id, prevUpdatedAt, patch)`

```
PATCH /rest/v1/vouchers?id=eq.{id}&updated_at=eq.{prevUpdatedAt}
Content-Type: application/json

{
  "status": "CONFIRMED",
  "paid_status": "PAID"
}
```

**에러 응답 (프론트엔드 throw)**:
```json
{
  "message": "CONFLICT: someone updated this voucher. Please refresh and retry.",
  "code": "CONFLICT"
}
```

---

## 5. 리포트 API (Reports)

### 5.1 골프 리포트

- **호출**: `src/features/reports/reportsApi.js` → `listGolfReport()`

```
GET /rest/v1/golf_report_view
  ?select=id,booking_id,booking_code,service_date,golf_name,tee_time,
          customer_name,currency,unit_price,unit_count,total_amount,pax,
          partner_code,branch
  &order=service_date.asc
  [&service_date=gte.{from}]
  [&service_date=lte.{to}]
  [&branch=eq.{branch}]
  [&golf_name=in.({course1},{course2},...)]
  [&partner_code=in.({partner1},{partner2},...)]
```

**Request Parameters**:

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| from | string | - | 시작 날짜 (ISO) |
| to | string | - | 종료 날짜 (ISO) |
| courses | string[] | [] | 골프장 필터 (golf_name IN) |
| partners | string[] | [] | 파트너 필터 (partner_code IN) |
| branch | string | 'ALL' | 브랜치 필터 |

**Response**:
```json
[
  {
    "id": "uuid",
    "booking_id": "uuid",
    "booking_code": "PKG251113-MK01",
    "service_date": "2025-11-14",
    "golf_name": "KCC",
    "tee_time": "10:00",
    "customer_name": "김철수",
    "currency": "PHP",
    "unit_price": 3500,
    "unit_count": 1,
    "total_amount": 14000,
    "pax": 4,
    "partner_code": "MK",
    "branch": "PHILIPPINES"
  }
]
```

---

### 5.2 호텔 리포트

- **호출**: `listHotelReport()`

```
GET /rest/v1/hotel_report_view
  ?select=id,booking_id,booking_code,check_in,hotel_name,customer_name,
          currency,unit_price,unit_count,total_amount,pax,partner_code,branch
  &order=check_in.asc
  [&check_in=gte.{from}]
  [&check_in=lte.{to}]
  [&branch=eq.{branch}]
  [&hotel_name=in.({hotel1},{hotel2},...)]
  [&partner_code=in.({partner1},{partner2},...)]
```

**Request Parameters**:

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| from | string | - | 시작 날짜 (ISO) |
| to | string | - | 종료 날짜 (ISO) |
| hotels | string[] | [] | 호텔 필터 (hotel_name IN) |
| partners | string[] | [] | 파트너 필터 (partner_code IN) |
| branch | string | 'ALL' | 브랜치 필터 |

**Response**:
```json
[
  {
    "id": "uuid",
    "booking_id": "uuid",
    "booking_code": "PKG251113-MK01",
    "check_in": "2025-11-13",
    "hotel_name": "Shangri-La",
    "customer_name": "김철수",
    "currency": "PHP",
    "unit_price": 8000,
    "unit_count": 2,
    "total_amount": 16000,
    "pax": 4,
    "partner_code": "MK",
    "branch": "PHILIPPINES"
  }
]
```

---

## 6. 설정 API (마스터 데이터 CRUD)

- **호출**: `src/features/settings/settingsApi.js`

### 6.1 마스터 데이터 조회

```
GET /rest/v1/{table}
  ?select=*
  [&order=code.asc]    // product_types, partners, flightinfo, hotel_master
  [&order=name.asc]    // golf_courses, guide_master, vehicle_master, driver_master
```

**적용 가능 테이블**: `product_types`, `partners`, `flightinfo`, `golf_courses`, `hotel_master`, `guide_master`, `driver_master`, `vehicle_master`

**정렬 규칙**:

| 테이블 | 정렬 |
|---|---|
| product_types | code ASC |
| partners | code ASC |
| flightinfo | code ASC |
| hotel_master | code ASC |
| golf_courses | name ASC |
| guide_master | name ASC |
| vehicle_master | name ASC |
| driver_master | name ASC |

---

### 6.2 마스터 데이터 생성

```
POST /rest/v1/{table}
Content-Type: application/json

{
  "code": "NEW_CODE",
  "label": "새 항목",
  ...
}
```

**Response**: 생성된 행

---

### 6.3 마스터 데이터 수정

```
PATCH /rest/v1/{table}?id=eq.{id}
Content-Type: application/json

{
  "label": "수정된 항목",
  ...
}
```

**Response**: 수정된 행

---

### 6.4 마스터 데이터 삭제

```
DELETE /rest/v1/{table}?id=eq.{id}
```

**Response**: 204 No Content

---

## 7. 공급자 API (Suppliers)

- **호출**: `src/features/suppliers/suppliersApi.js`

### 7.1 공급자 목록 조회

```
GET /rest/v1/suppliers?select=*&order=name.asc
```

**Response**: `Array<Supplier>`

---

### 7.2 공급자 상세 조회 (자식 포함)

```
GET /rest/v1/suppliers?id=eq.{id}
  &select=*,
    golf_courses(*),
    hotel_room_types(*),
    villa_units(*),
    vehicles(*)
```

**Response**: 단일 행 + 중첩된 자식 테이블 배열

```json
{
  "id": "uuid",
  "name": "Shangri-La Resort",
  "type": "HOTEL",
  "golf_courses": [],
  "hotel_room_types": [
    { "id": "uuid", "room_type_name": "Deluxe Twin", "max_occupancy": 2 }
  ],
  "villa_units": [],
  "vehicles": []
}
```

---

### 7.3 공급자 생성

```
POST /rest/v1/suppliers
{
  "name": "새 공급자",
  "type": "GOLF_COURSE",
  "branch": "PHILIPPINES",
  ...
}
```

---

### 7.4 공급자 수정

```
PATCH /rest/v1/suppliers?id=eq.{id}
{
  "name": "수정된 공급자",
  ...
}
```

---

## 8. 가격 규칙 API (Pricing Rules)

### 8.1 가격 규칙 목록 조회

```
GET /rest/v1/pricing_rules
  ?supplier_id=eq.{supplierId}
  &select=*
  &order=priority.desc
```

**Response**: `Array<PricingRule>` (높은 우선순위 먼저)

---

### 8.2 가격 규칙 생성

```
POST /rest/v1/pricing_rules
{
  "supplier_id": "uuid",
  "supplier_type": "GOLF_COURSE",
  "branch": "PHILIPPINES",
  "from_date": "2025-11-01",
  "to_date": "2026-03-31",
  "day_type": "WEEKDAY",
  "is_holiday": false,
  "season_type": "OFFPEAK",
  "currency": "PHP",
  "price": 3500,
  "unit_type": "PER_ROUND",
  "priority": 10,
  "is_active": true
}
```

---

### 8.3 가격 규칙 수정

```
PATCH /rest/v1/pricing_rules?id=eq.{id}
{
  "price": 4000,
  "priority": 20,
  ...
}
```

---

### 8.4 가격 규칙 삭제

```
DELETE /rest/v1/pricing_rules?id=eq.{id}
```

---

## 9. 공휴일 API (Holidays)

- **호출**: `suppliersApi.getHolidays(branch?)`

```
GET /rest/v1/holidays
  ?is_active=eq.true
  &select=*
  &order=date.asc
  [&or=(branch.is.null,branch.eq.{branch})]
```

**Request Parameters**:

| 파라미터 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| branch | string | null | 브랜치 필터 (null이면 전역만) |

**필터 로직**: `branch.is.null` (전역 공휴일) OR `branch.eq.{branch}` (해당 브랜치 공휴일)

**Response**:
```json
[
  {
    "id": "uuid",
    "date": "2025-12-25",
    "name": "Christmas Day",
    "branch": null,
    "is_active": true,
    "created_at": "2025-01-01T00:00:00Z"
  }
]
```

---

## 10. React Query 훅 요약

### 10.1 예약 훅 (`bookingsHooks.js`)

| 훅 | 타입 | Query Key | 설명 |
|---|---|---|---|
| `useBookingsList(params)` | useQuery | `['bookings', params]` | 예약 목록 |
| `useBooking(id)` | useQuery | `['booking', id]` | 예약 단건 (enabled: !!id) |
| `useCreateBooking()` | useMutation | - | 예약 생성 (invalidates `['bookings']`) |
| `useUpdateBooking()` | useMutation | - | 예약 수정 (optimistic update: `['booking', id]`) |
| `useSetBookingStatus()` | useMutation | - | 상태 변경 (optimistic update) |

### 10.2 바우처 훅 (`vouchersHooks.js`)

| 훅 | 타입 | Query Key | 설명 |
|---|---|---|---|
| `useVouchersList(params)` | useQuery | `['vouchers', params]` | 바우처 목록 |
| `useCreateVoucher()` | useMutation | - | 바우처 생성 (invalidates `['vouchers']`) |
| `useUpdateVoucher()` | useMutation | - | 바우처 수정 (invalidates `['vouchers']`) |

### 10.3 공급자 훅 (`suppliers/hooks.js`)

| 훅 | 타입 | Query Key | staleTime | 설명 |
|---|---|---|---|---|
| `useSuppliers()` | useQuery | `['suppliers']` | 1시간 | 공급자 목록 (name ASC) |
| `useSupplier(id)` | useQuery | `['suppliers', id]` | 기본 | 공급자 상세 (자식 포함) |
| `useCreateSupplier()` | useMutation | - | - | 공급자 생성 |
| `usePricingRules(supplierId)` | useQuery | `['pricing_rules', supplierId]` | 기본 | 가격 규칙 목록 |
| `useCreatePricingRule()` | useMutation | - | - | 가격 규칙 생성 |
| `useHolidays(branch)` | useQuery | `['holidays', branch]` | 24시간 | 공휴일 목록 |

### 10.4 전역 설정 (`QueryProvider.jsx`)

| 설정 | 값 | 설명 |
|---|---|---|
| staleTime | 5분 | 기본 캐시 유효 시간 |
| gcTime | 24시간 | 가비지 컬렉션 시간 |
| maxAge | 24시간 | localforage persist 최대 보관 시간 |
| persister | localforage | IndexedDB 기반 캐시 영속화 |

---

## 11. Supabase 뷰 (View) 정의

프론트엔드에서 직접 참조하는 3개의 Supabase 뷰:

| 뷰 | 소스 | 주요 컬럼 | 용도 |
|---|---|---|---|
| `booking_dashboard_view` | bookings LEFT JOIN partners | bookings.* + partners.label AS partner_name | 예약 목록 |
| `golf_report_view` | booking_day_items_mb JOIN bookings | service_date, golf_name, tee_time, customer_name, amount | 골프 리포트 |
| `hotel_report_view` | booking_day_items_mb JOIN bookings | check_in, hotel_name, customer_name, amount | 호텔 리포트 |

> 뷰의 정확한 SQL 정의는 Supabase 대시보드에서 확인 가능하며, 소스 코드에는 포함되어 있지 않습니다.

---

## 12. Supabase 클라이언트 설정

- **위치**: `src/lib/supabase.js`

```javascript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
```

| 옵션 | 값 | 설명 |
|---|---|---|
| autoRefreshToken | true | 토큰 자동 갱신 |
| persistSession | true | localStorage에 세션 보존 |
| detectSessionInUrl | true | OAuth 리다이렉트 시 URL에서 세션 감지 |