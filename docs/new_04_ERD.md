# 04. 새 Supabase ERD

이 문서는 새 Supabase 프로젝트의 목표 데이터 구조다. 현재 운영 DB의 테이블을 복제하지 않는다. 실제 SQL, 제약조건, RLS는 마이그레이션으로 만들며, 엑셀 원본의 불확실한 뜻은 확정 규칙으로 저장하지 않는다.

## 1. 모델 원칙

1. 예약 ID는 UUID다. 이관 코드 원문은 중복 가능한 검색값이며 전역 UNIQUE를 걸지 않는다. 신규 예약 코드는 현재 시스템의 자동 추천 또는 수기 입력을 받아 별도로 기록한다.
2. 원본 파일·시트·행·셀·서식은 불변으로 보존한다. 구조화한 예약이 바뀌어도 원본을 재현할 수 있어야 한다.
3. 거래처(의뢰하는 쪽)와 호텔·골프장 협력업체(서비스 제공자)는 별도 엔티티다.
4. 예약 한 건에 여러 손님, 일정, 바우처 번호, 비용, 지급, 변경 이력을 허용한다.
5. 필리핀·태국·일본은 같은 공통 테이블을 쓰되 필수 market_id로 분리한다. 국가별 규칙은 확정 뒤 적용한다.
6. 원본에 없는 날짜·통화·금액·상태는 NULL과 검토 상태로 둔다. 0이나 오늘 날짜로 채우지 않는다.

## 2. 핵심 관계도

~~~mermaid
erDiagram
  markets ||--o{ reservations : owns
  markets ||--o{ agencies : scopes
  markets ||--o{ suppliers : scopes
  agencies |o--o{ reservations : requests
  reservations ||--o{ reservation_people : includes
  reservations ||--o{ itinerary_items : schedules
  itinerary_items |o--o{ service_confirmations : has
  supplier_voucher_items |o--o{ service_confirmations : has
  suppliers |o--o{ itinerary_items : provides
  reservations ||--o{ cost_lines : costs
  reservations ||--o{ payment_transactions : payments
  reservations ||--o| settlement_reviews : reviews
  reservations ||--o{ reservation_events : changes
  import_batches ||--o{ source_sheets : contains
  source_sheets ||--o{ source_rows : contains
  source_rows ||--o{ source_cells : contains
  source_sheets ||--o{ source_style_regions : styles
  source_rows ||--o{ reservation_sources : evidences
  reservations ||--o{ reservation_sources : evidenced_by
  source_rows ||--o| voucher_sheet_entries : maps
  agencies |o--o{ voucher_sheet_entries : groups
  voucher_sheet_entries ||--o{ supplier_voucher_items : contains
  suppliers |o--o{ supplier_voucher_items : provides
  itinerary_items |o--o{ supplier_voucher_items : links
  import_batches ||--o{ review_issues : raises
~~~

관계도의 |o는 검토 전 연결이 NULL일 수 있음을 뜻한다. 바우처 시트의 한 원본 행은 하나의 voucher_sheet_entries를 만들지만 여러 날짜·서비스는 여러 supplier_voucher_items가 된다. 같은 원장 예약과 연결된 복사 행은 출처가 둘이어도 예약을 두 개 만들지 않는다.

## 3. 원본 보존층

| 테이블 | 주요 필드 | 제약·의미 |
|---|---|---|
| import_batches | id, source_file_name, file_hash, parser_version, imported_at, state, counts_json | 파일별 실행·재실행·검증 단위. 파일 해시는 중복 탐지에 사용 |
| source_sheets | id, batch_id, sheet_index, sheet_name, dimensions, merges_json, hidden_rows_json, hidden_cols_json, conditional_formats_json, theme_json | 시트 순서와 표시 구조. 이름이 같아도 파일별로 구분 |
| source_rows | id, sheet_id, row_no, row_kind, original_json, row_hash | 시트 내 좌표 유일. 월 구획·헤더·데이터·템플릿 수식도 구분 |
| source_cells | id, row_id, coordinate, value_type, raw_value, formula, cached_value, comment_text, comment_author, style_ref | 값·수식·메모가 있는 셀. 빈 값에 메모가 있어도 저장 |
| source_style_regions | id, sheet_id, range_ref, fill_pattern, color_type, rgb, theme, indexed, tint, source_order | 값 없는 색칠 셀까지 정확히 재현. 겹친 영역은 원본 순서·좌표로 해석 |
| reservation_sources | reservation_id, source_row_id, link_state, evidence_json, reviewed_at | 예약과 여러 원본 행의 연결. 후보와 확정을 구분 |
| review_issues | id, batch_id, source_ref, issue_type, raw_text, candidate_json, resolution_json, state, row_version | 연도·중복·결제 주체·색·코드·공급처 등 검토 목록 |

source_cells는 좌표·원문 타입을 유지한다. 숫자·날짜로 변환된 값만 저장하지 않는다. 수식의 저장 계산값이 없으면 NULL이다. source_style_regions는 동일 스타일의 연속 범위를 압축해도 각 셀의 결과 색을 복원할 수 있어야 한다. 직접 채우기와 조건부 서식은 별도 근거로 보존한다. 원본층은 사용자가 화면에서 직접 수정하지 않는다.

## 4. 운영층

| 테이블 | 주요 필드 | 관계·주의 |
|---|---|---|
| markets | id, code(PH/TH/JP), name, timezone, default_currency | 코드만 유일. 통화는 거래별로 다시 저장 |
| fx_rate_snapshots | id, source, quote_currency, unit_amount, rate_krw, source_quoted_at nullable, fetched_at, source_url, fetch_kind, fetch_state | 네이버 KRW 환율 확인 이력. USD/PHP는 1, JPY는 100 단위를 보존. 원본 고시 시각과 앱 조회 시각 분리 |
| agencies | id, market_id, name, aliases_json, active | KDS·Monkey·THE CLARK TOUR·CLARK GOGO·GOLDEN RIVER 등 거래처. 원본 표기는 별도 보존 |
| suppliers | id, market_id, type, name, aliases_json, active | 호텔·골프장·차량 등 실제 서비스 제공자 |
| reservations | id, market_id, agency_id nullable, reservation_code nullable, original_code nullable, code_entry_mode(imported/suggested/manual), lead_name_raw nullable, pax nullable, start_date nullable, end_date nullable, status nullable, review_state, row_version, deleted_at nullable, deleted_by nullable, delete_reason nullable, created_at, updated_at | 국가 필수. 이관 original_code 중복 허용. 신규 코드는 추천/수기 출처 보존. 삭제는 논리 삭제, 원본 보존 |
| reservation_people | id, reservation_id, name_raw, name_en nullable, role, room_note nullable, source_cell_id nullable | 일본 손님 명단을 포함한 여러 인원. 원문 보존 |
| itinerary_items | id, reservation_id, item_type, service_date nullable, service_time nullable, supplier_id nullable, location_raw, detail_raw, pax nullable, status nullable, source_cell_id nullable, sort_order, row_version | 호텔·골프·차량·투어를 날짜별로 여러 개. 일본 객실/박수/차량 특성은 필요한 세부 필드 또는 JSON 원문 보조값으로 시작 |
| service_confirmations | id, itinerary_item_id nullable, supplier_voucher_item_id nullable, number_raw, kind, confirmed_at nullable, source_cell_id nullable | 일정 또는 아직 예약에 연결되지 않은 바우처 항목에도 번호 여러 개. 종류 미상이면 unknown. 두 연결 중 하나 이상 필요 |
| voucher_sheet_entries | id, source_row_id, agency_id nullable, reservation_id nullable, original_code nullable, name_raw nullable, pax_raw nullable, payment_raw nullable, review_state, duplicate_group_id nullable, row_version | 클락 5개 탭의 행. 원본 시트는 source_row를 통해 알 수 있음. 복사 행도 각각 보존 |
| supplier_voucher_items | id, entry_id, itinerary_item_id nullable, supplier_id nullable, service_kind nullable, service_date nullable, service_time nullable, detail_raw, status nullable, source_cell_id nullable, row_version | 한 행의 여러 날짜/골프장/호텔. 바우처 번호는 service_confirmations 또는 출처 후보로 연결 |
| cost_lines | id, reservation_id, itinerary_item_id nullable, supplier_id nullable, kind, currency nullable, unit_price nullable, quantity nullable, unit_name nullable, calculated_amount nullable, actual_amount nullable, formula_raw nullable, source_cell_id nullable, review_state | 객실×박수와 PAX×단가 등 서로 다른 산식 보존 |
| payment_transactions | id, reservation_id nullable, itinerary_item_id nullable, supplier_voucher_item_id nullable, cost_line_id nullable, direction, counterparty_kind nullable, counterparty_id nullable, amount nullable, currency nullable, effective_date nullable, note_raw, source_cell_id nullable, review_state | 고객 입금·공급처 지급·환불·이체를 구분. 예약 연결 전의 클락 바우처 지급 후보도 유지. PAID 문구만으로 confirmed로 만들지 않음 |
| cash_transactions | id, market_id, currency, source_row_id nullable, transacted_on nullable, description_raw, inflow nullable, outflow nullable, balance_raw nullable, sort_order, linked_payment_id nullable | 필리핀 PHP·KRW 시제. 예약 결제와 자동 병합하지 않음 |
| reservation_events | id, reservation_id nullable, event_kind, before_json, after_json, happened_on nullable, note_raw, source_row_id nullable, created_at | 취소·변경·복원. 대상 예약 미확정이면 NULL로 원문 보존 |
| settlement_reviews | id, reservation_id unique, review_state, note_raw nullable, reviewed_at nullable, row_version | 예약별 정산 검토 결과만 저장. 금액을 다시 복사하지 않음 |

운영층의 해석값에는 출처 셀 또는 원본 행 연결을 유지한다. 하나의 source_row를 예약과 바우처 행 양쪽 근거로 참조할 수 있다. 운영자가 새로 만든 항목에는 source_cell_id가 없을 수 있으므로 생성 이력과 작성 시각을 남긴다. 일반 수정은 row_version을 증가시켜 충돌을 감지한다.

헤더 환율은 예약 국가와 무관한 공통 참조 데이터다. fx_rate_snapshots에서 통화별 마지막 정상 기록을 읽는다. 예정 조회가 실패하거나 네이버의 새 고시가 없으면 값을 덮지 않고 기존 정상 기록의 고시·조회 시각을 보여준다. 성공적으로 확인한 중복 고시는 새 금액으로 오인하지 않는다. 이 스냅샷은 화면 표시용이며 cost_lines, payment_transactions, 원본 정산 셀의 환산 근거로 자동 연결하지 않는다. 업무 정산에 환율을 적용할 때는 별도의 확정된 날짜·통화·규칙 근거가 필요하다.

### 4.1 정산서의 원본과 운영 데이터

필리핀 원장 2025 MAR의 AD:AQ는 예약 행 옆에 붙은 정산 표다. AD는 코드, AE는 총투어피, AF는 페소, AG는 Hotel, AH~AK는 1TH~4TH, AL은 현지행사비, AM은 그 외 지출, AN은 옵션, AO는 수익이다. AP/AQ에는 제목이 없으므로 원본 좌표·값·수식을 보존하고 의미를 확정하지 않는다. AE2의 22.5와 행별 AF 환산식도 원본으로 보존하며 공통 환율로 단정하지 않는다.

정산 메뉴와 예약 모달은 동일한 예약 ID로 읽는 정산 조회 투영을 쓴다. 원본 AD:AQ 값/수식/캐시는 source_cells에서, 출처 행 연결은 reservation_sources에서, 확인된 운영 비용·입금은 cost_lines/payment_transactions에서 읽는다. settlement_reviews는 검토 상태만 저장한다. 같은 금액을 정산 전용 테이블에 다시 저장해 두 화면에서 어긋나게 하지 않는다. 수기 조정이 필요해지면 근거와 통화를 가진 cost_lines 또는 payment_transactions의 별도 종류로 기록하고 변경 사건을 남긴다. 원본값과 확인된 운영값이 다르면 둘 다 표시한다.

정산 조회는 예약 한 건당 한 행을 반환하고, 여러 서비스·복사 시트 출처로 인한 곱셈 조인을 금지한다. 통화가 다르거나 환율 근거가 미확정이면 원본 수익과 운영 수익을 같은 계산 결과로 표시하지 않는다. 필리핀 서식을 일본·태국에 강제하지 않으며 해당 국가의 원본 정산 근거가 없으면 '원본 없음/규칙 미확정'으로 표시한다.

## 5. 코드·색 뜻 입력

| 테이블 | 주요 필드 | 목적 |
|---|---|---|
| code_glossary | id, market_id nullable, code_family, observed_text, meaning nullable, validity, effective_from/to nullable, note, confirmed_at nullable | 관찰된 코드 앞쪽/뒤쪽 계열의 뜻을 사용자가 옆칸에 입력. 입력 전 원문 그대로 |
| color_glossary | id, source_sheet_id nullable, market_id nullable, color_signature, scope_json, meaning nullable, effective_from/to nullable, confirmed_at nullable | 시트/기간/열/행 범위별 색 뜻. 원본 색 자체와 분리 |

코드 뜻과 색 뜻은 원본 행의 값을 덮어쓰지 않는다. 사전 항목이 확인되더라도 이전 행에 자동 소급 적용할지 별도 검토한다. 중복 코드·오타·과거 표기는 삭제하지 않고 별칭/유효 기간으로 관리한다.

## 6. 키·인덱스·무결성

- PK는 UUID. source_rows는 (sheet_id,row_no), source_cells는 (row_id,coordinate) 유일. voucher_sheet_entries는 source_row_id 유일.
- reservations.original_code에는 전역 유일 제약을 걸지 않는다. 신규 reservation_code는 저장 시 같은 국가의 기존 코드와 충돌을 검사하고 동시 신규 저장의 중복도 DB 수준에서 막는다. 이관 행의 동일 코드는 허용하므로 신규 코드 할당과 원본 중복 검토를 분리한다. (market_id,start_date,id), (market_id,reservation_code), (market_id,original_code), 손님 검색용 인덱스를 고려한다.
- itinerary_items는 (reservation_id,service_date,id), supplier_voucher_items는 (entry_id,service_date,id) 순으로 탐색 가능해야 한다.
- settlement_reviews는 reservation_id 유일. 정산 목록 투영은 (market_id, 표시일, reservation_id)로 안정 정렬하고 예약 UUID 기준 한 번만 집계한다.
- 금액은 정밀 numeric, 통화는 ISO 코드. 다른 통화는 환율 근거 없이 합산하지 않는다. NULL 금액과 0원은 다르다.
- fx_rate_snapshots는 (source,quote_currency,source_quoted_at,unit_amount) 기준으로 중복 고시를 식별한다. 네이버 고시 시각이 없을 때는 조회 시각을 별도로 기록하고 검토 상태를 유지한다. 최신 정상값 조회에 (quote_currency,fetched_at desc) 인덱스를 고려한다.
- 데이터 삭제는 원본층에 허용하지 않는다. 운영 예약 삭제는 관리자만 deleted_at/deleted_by/delete_reason을 기록하는 논리 삭제로 처리하고 조회 기본값에서 제외한다. 취소·변경은 reservation_events로 남긴다. 중복 후보는 duplicate_group_id와 검토 결정으로 처리한다.

### 6.1 주요 연결

| 부모 | 자식 | 연결 기준 | 유의점 |
|---|---|---|---|
| markets | reservations | reservations.market_id | 국가 필수. 지점/지역과 구분 |
| agencies | reservations | reservations.agency_id | 거래처 미확정이면 NULL |
| reservations | itinerary_items | itinerary_items.reservation_id | 한 날짜에 호텔·골프 여러 건 가능 |
| itinerary_items 또는 supplier_voucher_items | service_confirmations | 각각의 UUID | 바우처가 예약에 아직 연결되지 않아도 번호 보존 |
| source_rows | reservation_sources | source_row_id | 같은 예약의 여러 원본 근거 |
| source_rows | voucher_sheet_entries | source_row_id | 다섯 거래처 시트의 각 업무 행 |
| voucher_sheet_entries | supplier_voucher_items | entry_id | 한 행의 여러 날짜·공급처 |
| reservations 또는 supplier_voucher_items | payment_transactions | 해당 UUID | 결제 주체·대상 미확정은 출처로 검토 |

### 6.2 상태와 유형

| 항목 | 저장 원칙 |
|---|---|
| review_state | 미검토, 후보, 확인, 보류를 구분. 원본 상태 문구와 별도 |
| 예약·바우처 status | 사용자에게 뜻을 확인한 값만 운영 상태로 저장. 원본의 PAID/FULL/REQ/CANCLE은 raw_text에 유지 |
| item_type | hotel, golf, transport, tour, other 등의 서비스 종류. 원문이 모호하면 other 또는 NULL |
| payment direction | customer_receipt, supplier_payment, refund, transfer, unknown을 구분 |
| confirmation kind | hotel_confirmation, golf_voucher, transport_rfn, unknown. 숫자 형태만으로 종류 결정 금지 |

이 값들은 UI/API에서 공통 용어를 쓰기 위한 초안이다. 사용자에게 아직 받지 않은 국가별 업무 상태 전이와 코드 번호 의미를 DB ENUM으로 고정하지 않는다.

## 7. 시트별 연결

| 원본 | 우선 연결 대상 | 연결 주의 |
|---|---|---|
| NEW 2026.xlsx > 9월 1일 | cash_transactions | PHP와 KRW 장부를 분리, 빈 날짜 행도 보존 |
| NEW 2026.xlsx > 2025 MAR | reservations, itinerary_items, cost_lines, payment_transactions, 정산 조회 투영 | 월 제목·수식 템플릿 제외, 중복 코드 허용. AD:AQ 원본 정산 열과 무제목 AP/AQ 보존 |
| NEW 2026.xlsx > KDS/Monkey/THE CLARK TOUR/CLARK GOGO/GOLDEN RIVER | voucher_sheet_entries, supplier_voucher_items | 거래처 탭이며 골프장·호텔은 공급처. 복사 행은 중복 그룹 |
| NEW 2026.xlsx > 취소 | reservation_events | 날짜 변경과 취소 문구를 구분 |
| 일본 수배.xlsx > 2025 0820 시작 | JP reservations, reservation_people, itinerary_items | 객실·박수·골프·차량과 원본 메모 연결 |
| 일본 수배.xlsx > cancle | reservation_events | 대상 예약이 미확정이어도 원문 사건 보존 |

태국 원본은 아직 없다. TH market과 공통 테이블만 준비하며 데이터 행이나 업무 규칙을 만들지 않는다.

## 8. 새 Supabase 접근

고정 관리자 Auth 계정 한 개를 만든다. 공개 회원가입은 끄되 비로그인 일반 화면의 조회·예약 추가·수정은 허용한다. 공개 조회 범위와 일반 쓰기 가능 열을 명시하고, 원본 보존층 수정·예약 삭제·이관·관리 설정 변경은 지정 관리자 UID만 허용한다. 단순히 프론트에서 [삭제]를 숨기는 것으로 끝내지 않고 DB 권한/RLS 또는 검증된 서버 동작에서 강제한다. 비로그인 쓰기는 누구든 접근할 수 있으므로 요청 제한, 입력 검증, 변경 이력과 복구 수단을 둔다. 뷰가 기반 테이블 정책을 우회하지 않도록 설정하고 service_role 키와 비밀번호는 브라우저에 넣지 않는다.

스키마는 SQL 마이그레이션으로 생성한다. 아직 없는 태국 자료와 미확정 코드·색·정산 규칙을 가짜 데이터나 강제 제약조건으로 만들지 않는다. 기존 DB의 bookings.code UNIQUE, 1TH~6TH, memo_1~6, vouchers.booking_code 문자열 연결은 새 구조의 기준이 아니다.

## 9. 이관 검증

첫 기준: NEW 2026.xlsx 8개 시트 32,783개 값/수식 셀·2,828개 메모, 일본 수배.xlsx 2개 시트 6,359개 값/수식 셀·608개 메모. 합계 10개 시트 39,142개 셀·3,436개 메모. 빈 셀의 메모·색, 숨김 행, 병합, 조건부 서식도 별도로 대조한다. Monkey/THE CLARK TOUR 복사 행과 일본/통합 원장 중복 후보를 임의 합치거나 이중 집계하지 않는다. 수치는 파일 변경 때 다시 측정한다.
