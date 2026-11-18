# 04 — ERD (Entity Relationship Diagram)

> DW Tour 프로젝트의 데이터베이스 모델, 엔티티 스키마 및 테이블 간 관계도

---

## 1. 개요

DW Tour는 Supabase(PostgreSQL)를 백엔드로 사용합니다.  
아래 ERD는 소스 코드(`*Api.js` 파일의 select 컬럼, `README.md`, `Travel Ops System.md`)에서 분석한 테이블/뷰 구조입니다.

---

## 2. Mermaid ER Diagram

```mermaid
erDiagram

    profiles {
        uuid id PK "auth.users FK"
        text email
        text role "master_office | office"
        text branch "PHILIPPINES | CHIANG_MAI | FUKUOKA"
        text display_name
        timestamp created_at
    }

    bookings {
        uuid id PK
        text code UK "예약 코드 (자동생성)"
        text status "NEW~CLOSED/CANCLE"
        text paid_status "UNPAID|PARTIAL|PAID"
        text branch "PHILIPPINES|CHIANG_MAI|FUKUOKA"
        text product_code "상품 유형 코드"
        text partner_code "파트너 코드"
        date base_date "기준일"
        date start_date
        date end_date
        integer pax
        text currency "PHP|KRW|JPY|USD|THB"
        numeric total_amount
        text customer_name "한글명"
        text customer_name_en "영문명"
        text flight_info "항공편 정보"
        date deposit_date
        text memo
        text memo_1
        text memo_2
        text memo_3
        text memo_4
        text memo_5
        text memo_6
        text hotel_note
        text sc "SC 메모"
        text first_hotel_name
        text first_hotel_note
        text "1TH" "1일차 서비스"
        text "2TH" "2일차 서비스"
        text "3TH" "3일차 서비스"
        text "4TH" "4일차 서비스"
        text "5TH" "5일차 서비스"
        text "6TH" "6일차 서비스"
        text trans "이동수단"
        text guide_vehicle "가이드/차량"
        text hotel_status
        text hotel_voucher_number
        boolean hotel_paid
        numeric hotel_paid_amount
        text golf_status
        text golf_voucher_number
        numeric golf_final
        text pay_status_1
        text pay_status_2
        text pay_status_3
        text pay_status_4
        text pay_status_5
        text pay_status_6
        text change_tee_time_1
        text change_tee_time_2
        text change_tee_time_3
        text change_tee_time_4
        text change_tee_time_5
        text change_tee_time_6
        timestamp updated_at "낙관적 동시성 제어"
        timestamp created_at
    }

    booking_day_items_mb {
        uuid id PK
        uuid booking_id FK "bookings.id"
        date service_date
        integer slot_no "슬롯 번호"
        text service_type "GOLF|HOTEL|TRANSFER"
        text detail_name "골프장/호텔명 등"
        text detail_code
        integer pax
        numeric unit_price
        integer unit_count
        numeric total_amount
        text currency
        text memo
        timestamp created_at
        timestamp updated_at
    }

    booking_dashboard_view {
        "Supabase View: bookings + partners 조인"
    }

    vouchers {
        uuid id PK
        text status "NEW~CLOSED/CANCLE"
        text partner_name "파트너명 (직접입력)"
        text play_date "플레이 날짜"
        text tee_time "티타임"
        integer pax
        text currency "PHP"
        numeric amount
        text paid_status "UNPAID|PARTIAL|PAID"
        text voucher_no "바우처 번호"
        text request_note
        text manager
        text reserver_name
        text schedule_1 "1TH 스케줄 텍스트"
        text schedule_2
        text schedule_3
        text schedule_4
        text booking_code "예약 코드 (FK 유사)"
        text change_tee_time_1
        text branch
        timestamp updated_at
        timestamp created_at
    }

    partners {
        uuid id PK
        text code UK "파트너 코드"
        text label "파트너명"
        text region
        text branch
        timestamp created_at
    }

    product_types {
        uuid id PK
        text code UK "상품 코드 (GONLY 등)"
        text label "상품명"
        text region
        text branch
        timestamp created_at
    }

    flightinfo {
        uuid id PK
        text code UK "항공편 코드"
        text label
        text region
        text branch
        timestamp created_at
    }

    golf_courses {
        uuid id PK
        text code "골프장 코드"
        text name "골프장명"
        text country "PHILIPPINES|THAILAND 등"
        text region
        text branch
        text address
        text phone
        boolean is_contracted
        timestamp created_at
    }

    hotel_master {
        uuid id PK
        text code UK "호텔 코드"
        text label "호텔명"
        text region
        text branch
        text address
        text phone
        timestamp created_at
    }

    guide_master {
        uuid id PK
        text name "가이드명"
        text branch
        text phone
        boolean is_active
        timestamp created_at
    }

    driver_master {
        uuid id PK
        text name "기사명"
        text branch
        text phone
        text vehicle_type
        boolean is_active
        timestamp created_at
    }

    vehicle_master {
        uuid id PK
        text name "차량명"
        text branch
        text vehicle_no "차량번호"
        text vehicle_type "VAN|SEDAN|BUS"
        integer max_pax
        boolean is_active
        timestamp created_at
    }

    suppliers {
        uuid id PK
        text name "공급자명"
        text type "GOLF_COURSE|HOTEL|VILLA|TRANSFER_VENDOR"
        text branch
        text address
        text phone
        boolean is_active
        text note
        timestamp created_at
        timestamp updated_at
    }

    hotel_room_types {
        uuid id PK
        uuid supplier_id FK "suppliers.id"
        text room_type_name "객실 유형명"
        integer max_occupancy
        text beds
        text note
    }

    villa_units {
        uuid id PK
        uuid supplier_id FK "suppliers.id"
        text unit_name "유닛명 (3BR Pool Villa)"
        integer min_pax
        integer max_pax
        integer base_included_pax
        text note
    }

    vehicles {
        uuid id PK
        uuid supplier_id FK "suppliers.id"
        text vehicle_no "차량번호"
        text vehicle_type "VAN|SEDAN|BUS"
        integer max_pax
        text note
        boolean is_active
    }

    pricing_rules {
        uuid id PK
        uuid supplier_id FK "suppliers.id"
        text supplier_type
        text branch
        date from_date
        date to_date
        text day_type "WEEKDAY|WEEKEND|ANY"
        boolean is_holiday
        text season_type "PEAK|OFFPEAK|ANY"
        text currency
        numeric price
        text unit_type "PER_NIGHT|PER_ROUND|PER_PAX|PER_STAY"
        integer priority "높을수록 우선"
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    holidays {
        uuid id PK
        date date "공휴일 날짜"
        text name "공휴일명"
        text branch "null이면 전역"
        boolean is_active
        timestamp created_at
    }

    golf_report_view {
        "Supabase View: booking_day_items_mb + bookings 조인 (골프만)"
    }

    hotel_report_view {
        "Supabase View: booking_day_items_mb + bookings 조인 (호텔만)"
    }

    %% ===== 관계 =====

    profiles ||--o{ bookings : "creates"
    bookings ||--o{ booking_day_items_mb : "has"
    bookings }o--o| partners : "partner_code → code"
    bookings }o--o| product_types : "product_code → code"

    vouchers }o--o| bookings : "booking_code → code"
    vouchers }o--o| partners : "partner_name ≈ label"

    suppliers ||--o{ hotel_room_types : "has"
    suppliers ||--o{ villa_units : "has"
    suppliers ||--o{ vehicles : "has"
    suppliers ||--o{ pricing_rules : "has"
```

---

## 3. 테이블 상세 설명

### 3.1 핵심 트랜잭션 테이블

| 테이블 | 용도 | 비고 |
|---|---|---|
| `bookings` | 패키지 예약 마스터 | 가장 많은 컬럼 보유. updated_at으로 낙관적 동시성 제어 |
| `booking_day_items_mb` | 날짜별 서비스 항목 | 복합 키 `(booking_id, service_date, slot_no)` |
| `vouchers` | 골프 바우처 단품 예약 | GONLY 상품 전용, booking_code로 bookings와 연결 |

### 3.2 마스터 데이터 테이블

| 테이블 | 용도 | 정렬 기준 |
|---|---|---|
| `product_types` | 상품 유형 (GONLY, PKG 등) | code ASC |
| `partners` | 파트너 (여행사) | code ASC |
| `flightinfo` | 항공편 정보 | code ASC |
| `golf_courses` | 골프장 마스터 | name ASC |
| `hotel_master` | 호텔 마스터 | code ASC |
| `guide_master` | 가이드 마스터 | name ASC |
| `driver_master` | 기사 마스터 | name ASC |
| `vehicle_master` | 차량 마스터 | name ASC |

### 3.3 공급자 관련 테이블

| 테이블 | 용도 | 비고 |
|---|---|---|
| `suppliers` | 공급자 마스터 | GOLF_COURSE/HOTEL/VILLA/TRANSFER_VENDOR 유형 |
| `hotel_room_types` | 호텔 객실 유형 | supplier_id FK |
| `villa_units` | 풀빌라 유닛 | supplier_id FK, min/max_pax |
| `vehicles` | 차량 상세 | supplier_id FK, max_pax |
| `pricing_rules` | 요금 규칙 | supplier_id FK, 시즌/요일/휴일 조건 기반 |

### 3.4 캘린더/_REFERENCE 테이블

| 테이블 | 용도 | 비고 |
|---|---|---|
| `holidays` | 공휴일 캘린더 | branch=null이면 전역, is_active 필터 |
| `profiles` | 사용자 프로필 | auth.users FK, role/branch |

### 3.5 뷰 (View)

| 뷰 | 소스 | 용도 |
|---|---|---|
| `booking_dashboard_view` | bookings + partners 조인 | 예약 목록 조회용 (partner_name 포함) |
| `golf_report_view` | booking_day_items_mb + bookings 조인 | 골프 리포트용 (골프 서비스만) |
| `hotel_report_view` | booking_day_items_mb + bookings 조인 | 호텔 리포트용 (호텔 서비스만) |

---

## 4. 관계 설명

### 4.1 핵심 관계

```
profiles (1) ──── (N) bookings          사용자 → 예약
bookings (1) ──── (N) booking_day_items  예약 → 날짜별 서비스 항목
bookings (N) ──── (1) partners           예약 → 파트너 (partner_code)
bookings (N) ──── (1) product_types      예약 → 상품 유형 (product_code)
vouchers  (N) ──── (1) bookings          바우처 → 예약 (booking_code)
```

### 4.2 공급자 관계

```
suppliers (1) ──── (N) hotel_room_types  공급자 → 호텔 객실 유형
suppliers (1) ──── (N) villa_units       공급자 → 풀빌라 유닛
suppliers (1) ──── (N) vehicles          공급자 → 차량
suppliers (1) ──── (N) pricing_rules     공급자 → 요금 규칙
```

### 4.3 참조 관계 (논리적 FK)

```
bookings.partner_code  → partners.code
bookings.product_code  → product_types.code
vouchers.booking_code  → bookings.code
```

---

## 5. Enum/상수 값

### 5.1 예약 상태 (bookings.status, vouchers.status)

| 값 | 설명 |
|---|---|
| `NEW` | 신규 |
| `REQUESTED` | 요청됨 (변경 요청 등) |
| `CONFIRMED` | 확정 |
| `DEPOSIT` | 입금 확인 |
| `INPROGRESS` | 진행 중 |
| `GUID_PAY` | 가이드 지급 |
| `CLOSED` | 마감 |
| `CANCLE` | 취소 |
| `CHANGE_INFO` | 정보 변경 |

### 5.2 결제 상태 (paid_status)

| 값 | 설명 |
|---|---|
| `UNPAID` | 미결제 |
| `PARTIAL` | 부분 결제 |
| `PAID` | 결제 완료 |

### 5.3 사용자 역할 (profiles.role)

| 값 | 설명 |
|---|---|
| `master_office` | 전체 관리자 (모든 브랜치 접근) |
| `office` | 지점 사용자 (본인 브랜치만) |

### 5.4 지점 (branch)

| 값 | 설명 |
|---|---|
| `PHILIPPINES` | 필리핀 (마닐라/세부/클락) |
| `CHIANG_MAI` | 치앙마이 |
| `FUKUOKA` | 후쿠오카 |

---

## 6. 보안 (RLS)

- `README_RLS.md`에 따르면, 속도와 단순성을 최우선으로 하여 복잡한 RLS 정책은 배제
- RLS는 켜두되 정책은 `TO true` (모든 인증 사용자 허용) 또는 최소한의 로그인 체크만 수행
- 지점(Branch) 구분은 UI 레벨에서 필터링 편의기능으로 제공 (강제 차단 아님)

---

## 7. 캐시 전략

| 데이터 유형 | staleTime | 비고 |
|---|---|---|
| 예약/바우처 목록 | 5분 | 자주 변경되는 트랜잭션 데이터 |
| 마스터 데이터 | 1시간~24시간 | 변경 빈도 낮음 |
| 공휴일 | 24시간 | 거의 변경 없음 |
| Query Persist | 24시간 maxAge | localforage (IndexedDB) 기반 |`(