# DW Tour System — Program Requirements (v1 Spec Update: Supplier Details + Pricing Dimensions)

(Travel Agency Office Management System / B2B 중심)

## 0) 목적

- 예약/바우처/결제/취소를 일/주/월 단위로 즉시 조회
- 지점(치앙마이, 세부/클락/마닐라, 후쿠오카) 운영을 단일 시스템에서 관리
- 계약 공급처(골프장/호텔/풀빌라/차량 등)를 마스터로 관리하고, **시즌/요일/휴일/특정일** 기반 요금 규칙을 저장/적용
- 느린 인터넷 환경에서도 빠르게: **목록 최소 컬럼 + 캐시 Persist + 마스터데이터 장기 캐시**
- 다중 사용자 동시 수정 안정성: **updated_at 가드 + 무결성 제약 (속도 중심 설계)**

---

## 1) 핵심 엔티티(큰 구조)

- Users / Profiles (role, branch)
- Bookings (패키지/공통)
- Vouchers (골프 바우처 단품)
- Suppliers (공급처 마스터, 타입별 상세 포함)
- Supplier Pricing Rules (날짜/요일/휴일/인원/룸타입 등 조건 기반)
- Holidays (국가/지점별 휴일 캘린더)
- Payments / Refunds (다통화, 부분결제/환불)
- Audit Log (선택)

---

## 2) 공급처(Suppliers) 관리 — 타입별 상세 요구사항

공급처는 공통 기본정보 + 타입별 상세정보를 가진다.

- 공통 CRUD: 추가/수정/비활성/삭제(기본 soft delete 권장)
- 선택 시 예약/견적에 연결 가능
- 공급처별 요금룰(pricing rules)을 다수 등록 가능

### 2.1 공급처 공통 필드(필수)

- supplier_id (uuid)
- type: GOLF_COURSE | HOTEL | VILLA | TRANSFER_VENDOR | OPTION_VENDOR
- branch 또는 country/city(운영방식에 따라 둘 중 하나 이상)
- name
- address
- phone
- is_active
- note
- created_by / updated_by / created_at / updated_at

---

## 3) HOTEL / VILLA 상세 요구사항

## 3.1 호텔(HOTEL) 정보

### 3.1.1 호텔 상세 필드

- address, phone (공통에 포함)
- room_types (여러 개 관리 가능)
  - room_type_id
  - room_type_name (예: Deluxe Twin)
  - max_occupancy (선택)
  - beds / view / breakfast_included (선택)
  - note

### 3.1.2 호텔 요금 저장 요구(룸타입 기반)

- 룸타입별 요금 규칙 등록 가능
- 시즌/요일/휴일/특정일 조건 적용 가능
- 기본 단위: PER_NIGHT (1박)

---

## 3.2 풀빌라(VILLA) 정보

### 3.2.1 풀빌라 상세 필드

- address, phone (공통)
- villa_units 또는 room_types(운영 방식 택1)
  - unit_id (또는 room_type_id)
  - unit_name (예: 3BR Pool Villa)
  - min_pax (최소 인원)
  - max_pax (최대 인원)
  - base_included_pax (선택: 기본 포함 인원)
  - note

### 3.2.2 풀빌라 요금 저장 요구(인원별 요금)

- 인원별 요금을 저장해야 한다.
- 요구 방식(권장):
  1. **PAX_TIER 테이블/룰**: min_pax~max_pax 구간별 가격
  2. 또는 **pax별 정확 가격**(3명/4명/5명...)을 룰로 저장
- 시즌/요일/휴일/특정일 조건 적용 가능
- 단위: PER_NIGHT (1박) 또는 PER_STAY(선택)

---

## 4) GOLF_COURSE(골프장) 상세 요구사항

골프장은 “시즌(성/비수기) + 요일(주중/주말) + 휴일/특정일 + 추가비용(카트/캐디/보험/컨슘머블)”이 동시에 필요하다.

## 4.1 골프장 상세 필드

- address, phone (공통)
- course_name (name과 동일하게 쓰거나 별도)
- 계약 여부: is_contracted (또는 contract_level)
- 메모/정산 규칙(선택)

## 4.2 시즌 구분(골프장별)

골프장마다 성/비수기 기간이 있으므로 골프장 상세에 기본 시즌 기간을 저장할 수 있어야 한다.

- offpeak_start_date / offpeak_end_date
- peak_start_date / peak_end_date
  > 이 값은 “기본 시즌 템플릿”이고, 실제 요금은 pricing rules로 저장한다.

## 4.3 골프 요금 규칙(필수 차원)

- 시즌: PEAK / OFFPEAK
- 요일 타입: WEEKDAY / WEEKEND
- 휴일/특정일: HOLIDAY 또는 특정 날짜 범위(프로모션/연휴/대회기간)
- 플레이 단위: PER_ROUND (기본)

### 4.3.1 골프 “기본 라운드 요금”

- base_green_fee (통화 포함)
- 조건: 시즌/요일/휴일/특정기간

### 4.3.2 골프 추가 비용(필수 항목)

아래 항목은 “포함/미포함 + 금액(또는 0)” 형태로 룰에 저장 가능해야 한다.

- consumable_fee (컨슘머블)
- caddie_fee (캐디피)
- cart_fee (카트비)
- insurance_fee (보험료)

각 항목에 대해:

- apply_mode: INCLUDED | EXCLUDED | REQUIRED(필수추가) (운영 규칙에 따라)
- amount + currency
- 단위: PER_PAX 또는 PER_ROUND (선택/필수)
- 옵션: caddie_count_rule(예: 1캐디/1팀, 1캐디/2인 등) (후순위 확장)

## 4.4 “특정 요금가” 지원(계약 골프장)

- 특정 기간/특정 날짜에 계약 특가가 적용되는 케이스를 저장해야 한다.
- 구현 방식:
  - pricing_rules에 `rule_type = SPECIAL_CONTRACT_RATE` + priority 높게
  - 또는 `special_rates` 테이블로 분리(선택)

---

## 5) 차량(TRANSFER_VENDOR) 상세 요구사항

차량/이동 수배를 위해 차량 정보와 인원 제한이 필요하다.

## 5.1 차량(또는 차량 타입) 필드

- vehicle_id
- vendor/supplier_id 연결
- vehicle_no (차량번호)
- vehicle_type (예: VAN, SEDAN, BUS)
- max_pax
- note
- is_active

## 5.2 차량 요금(선택)

- 구간별(공항→호텔 등) 요금, 시간별, 일일 대절 등
- 시즌/요일/휴일 룰 확장 가능(후순위)

---

## 6) 요금 규칙(Pricing Rules) — 공통 저장 규격(업데이트)

요금은 “공급처 타입별 조건”이 다르므로, 공통 룰 테이블 + 타입별 세부 테이블(또는 JSON) 중 하나로 구현한다.
권장: **공통 + 타입별 세부 테이블** (검색/검증/성능 유리)

### 6.1 공통 룰 필드(필수)

- rule_id (uuid)
- supplier_id (FK)
- supplier_type
- branch (또는 ALL)
- from_date / to_date (기간)
- day_type: WEEKDAY | WEEKEND | ANY
- is_holiday: true/false/any
- season_type: PEAK | OFFPEAK | ANY
- currency
- price
- unit_type: PER_NIGHT | PER_ROUND | PER_PAX | PER_STAY 등
- priority (정수; 높을수록 우선)
- is_active
- created_by / updated_by / created_at / updated_at

### 6.2 타입별 확장 필드(필수)

- HOTEL: room_type_id 필수
- VILLA: unit_id(room_type_id) + pax 조건(min_pax/max_pax 또는 pax_exact)
- GOLF: (옵션) tee_time_bucket, pax/flight 규칙(후순위), + extra fees(컨슘머블/캐디/카트/보험)
- TRANSFER: (선택) route_id 또는 vehicle_type_id

---

## 7) 예약 입력 시 선택 요구사항(현장 UX)

- 호텔/풀빌라 선택 → 룸타입 선택 가능
- 풀빌라 선택 시 **인원(min/max) 제약**이 표시되어야 함
- 골프장 선택 시:
  - 시즌/요일/휴일 기준의 추천 요금 + 추가비용(컨슘머블/캐디/카트/보험)을 함께 표시
  - 최종 확정 요금은 오피스가 override 가능(override 이유 메모 가능)
- 차량 선택 시:
  - 차량 max 인원 정보가 보여서 배정 오류 방지

---

## 8) 조회/리포트(추가 필터)

- 공급처(골프장/호텔/풀빌라) 기준 조회
- 시즌/휴일 적용 여부(선택)
- 추가비용 포함/미포함 상태(선택)

---

## 9) 비기능(속도/안정성/권한)

### 9.1 성능

- 마스터데이터(suppliers/room_types/vehicles/pricing_rules/holidays)는 장기 캐시(24h~7d)
- 목록 화면은 최소 컬럼만 조회
- 캐시 Persist(IndexedDB)로 재접속 체감 개선

### 9.2 동시 수정

- updated_at 가드로 충돌 감지 + 재시도 UX
- DB 제약/트랜잭션으로 무결성 유지

### 9.3 보안/권한(Minimal Security)

- **속도와 단순성 최우선**: 복잡한 RLS 정책 배제
- Supabase RLS는 켜두되, 정책은 `TO true` (모든 사용자 허용) 또는 최소한의 로그인 체크만 수행
- 지점(Branch) 구분은 UI 레벨에서 필터링 편의기능으로 제공 (강제 차단 X)
- 불필요한 인증 체크 로직 제거로 API 응답 속도 확보

---

## 10) 수용 기준(Acceptance Criteria) — 이번 업데이트 포함

- 호텔/풀빌라: 주소/전화/룸타입(또는 유닛) 등록 및 선택 가능
- 풀빌라: min/max 인원 제약 + 인원별 요금 룰 저장 가능
- 골프장: 성/비수기 기간 템플릿 저장 가능 + 시즌/주중/주말/휴일/특정기간 요금 룰 저장 가능
- 골프장: 컨슘머블/캐디/카트/보험료 항목을 룰로 저장하고 예약에서 적용/표시 가능
- 차량: 차량번호 + max 인원 저장 및 배정 시 확인 가능
- 느린 인터넷에서 캐시로 재접속 로딩이 체감 개선됨
- 다중 사용자 수정 시 덮어쓰기 없이 충돌을 감지하고 안전하게 처리됨
