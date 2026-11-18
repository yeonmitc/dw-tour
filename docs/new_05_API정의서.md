# 05. 새 데이터 접근·API 계약

이 문서는 새 Supabase 프로젝트와 웹앱 사이의 목표 계약이다. 현재 API가 이미 구현되어 있다는 뜻이 아니다. 첫 구현은 Supabase Auth, RLS가 적용된 테이블/읽기 뷰, 필요한 소수의 DB 함수로 구성한다. 새 서버 프레임워크나 공개 일괄 가져오기 API는 첫 범위에 넣지 않는다.

## 1. 공통 규칙

- 일반 화면 조회와 예약 신규·수정은 관리자 Auth 세션 없이 허용한다. 예약 삭제, 엑셀 이관·검토 확정, 관리 설정 변경만 지정 관리자 세션을 요구한다. 프론트 표시와 별개로 DB RLS/권한 또는 검증된 서버 동작에서 같은 경계를 강제한다. 공개 회원가입은 제공하지 않는다.
- market은 PH, TH, JP 중 하나다. 국가별 예약 화면은 market 필터를 필수로 전달한다. 전체 검색만 여러 국가를 조회한다.
- 업무 식별자는 UUID다. original_code는 중복 가능한 이관 원문이고 reservation_code는 표시 코드다. 신규 예약은 현재 시스템 형식의 자동 추천 또는 수기 입력을 택한다. 코드 문자열로 UPDATE/DELETE 대상을 고르지 않는다.
- 날짜 범위는 from 포함, toExclusive 미포함의 현지 날짜(YYYY-MM-DD)다. 필리핀 첫 화면은 현재 달 이전 달 1일에서 다음다음 달 1일 전까지다.
- 목록은 요약 필드만 준다. 메모·원본 셀·수식·손님 명단·결제 세부는 상세 요청 때 받는다. 모든 페이지는 안정적인 정렬 키와 다음 페이지 토큰을 가진다.
- 금액은 숫자와 통화 코드를 함께 전달한다. 빈 금액은 null이며 0과 구분한다. 미확정 날짜·상태·코드 뜻은 추측해서 채우지 않는다.
- 저장 요청은 expectedVersion을 사용한다. DB가 한 행의 row_version을 비교·증가시켜 충돌을 검출한다. 저장 성공 뒤 필요한 목록/상세 캐시만 갱신한다.

구현 시 목록 함수는 security invoker 권한으로 RLS를 따르는 읽기 전용 함수로 두고, 예를 들면 list_reservations_window, search_reservations 같은 이름으로 마이그레이션에 정의한다. 상세·마스터의 단순 조회는 필요한 열만 선택하는 Supabase JS 호출로 충분하다. 다중 테이블을 함께 저장하는 동작에만 트랜잭션용 DB 함수를 둔다. 이 명칭은 새 DB 구현 때 확정하며 기존 DB에 이미 있는 함수명이 아니다.

| 오류 코드 | 의미 | 화면 동작 |
|---|---|---|
| ADMIN_REQUIRED / FORBIDDEN | 관리자 전용 동작에 세션 없음 또는 지정 관리자 아님 | 현재 화면 위 비밀번호 모달 또는 접근 오류, 입력 유지 |
| VALIDATION | 필수값·범위·국가 불일치 | 해당 입력을 표시, 입력 유지 |
| NOT_FOUND | UUID에 해당하는 레코드 없음 | 목록 복귀 안내 |
| CONFLICT | expectedVersion과 서버 버전 불일치 | 서버 값과 내 입력 비교 |
| NETWORK | 연결 실패·시간 초과 | 입력 유지와 재시도 |
| IMPORT_REVIEW_REQUIRED | 원본 연결·금액·연도 등의 해석 미확정 | 원본·검토 화면으로 이동 |

## 2. 비로그인 사용과 관리자 인증

| 동작 | Supabase 호출/결과 | 화면 |
|---|---|---|
| 일반 진입 | 관리자 세션 없이 일반 조회·예약 추가·수정 계약 사용 | 바로 필리핀 예약 화면 |
| 관리자 권한 요청 | 삭제 등 관리자 동작 시 Auth signInWithPassword에 사전 구성한 관리자 계정 식별자와 입력한 비밀번호 전달 | 현재 화면 위 비밀번호 모달, 성공 후 원래 동작 계속 |
| 관리자 세션 확인 | 보호 동작 직전 Auth getUser 또는 검증된 Auth 상태로 지정 관리자 UID 확인 | 관리자 동작에서만 잠시 확인 표시 |
| 관리자 로그아웃 | Auth signOut, 관리자 전용 캐시 제거 | 일반 예약 화면 유지 |

사전 구성된 계정 식별자는 비밀키가 아니다. 비밀번호·service_role 키를 브라우저 코드/환경변수에 넣지 않는다. 비밀번호 모달 취소/실패는 원래 입력을 유지하고 보호 동작을 실행하지 않는다. 일반 화면은 관리자 프로필 조회를 기다리지 않는다.

## 3. 예약 목록·상세

| 작업 | 입력 | 결과 | 데이터 소스/제약 |
|---|---|---|---|
| listReservationsWindow | market, from, toExclusive, status?, agencyId?, keyword?, cursor?, limit | 요약 예약 배열, nextCursor, hasMore | RLS를 따르는 읽기 전용 DB 함수 또는 같은 의미의 뷰. limit 기본 50, 상한 100 |
| getReservation | market, reservationId | 예약 기본값, 일정 요약, version | reservations + 필요한 관계만 |
| getReservationSection | reservationId, section=people/itinerary/vouchers/payments/events/sources | 선택 구역 데이터 | 선택한 탭에서만 호출 |
| searchReservations | keyword, market? | 국가·코드·손님·거래처가 붙은 제한된 결과, nextCursor | 전체 검색. 날짜 범위 없이도 서버에서 페이지 제한 |
| listUndatedReview | market, cursor? | 날짜가 없거나 모호한 예약/원본 후보 | 기본 3개월 밖의 검토 전용 |

listReservationsWindow는 예약 시작일 또는 연결된 서비스일이 범위에 있는 예약을 **UUID 기준 한 번씩** 반환한다. 서비스일 여러 개가 범위에 있어도 예약 수와 금액을 여러 번 합산하지 않는다. displayDate는 범위에 속한 첫 일정일 또는 시작일 중 화면에 쓸 근거를 반환한다. 날짜를 확정할 수 없는 건은 listUndatedReview에서 찾는다. 3개월 데이터를 여러 페이지로 나눠도 hasMore가 false가 될 때까지 이어서 읽을 수 있어야 한다. 기간의 일부를 50건에서 잘라 종료하지 않는다.

예시 논리 응답:

~~~json
{
  "items": [
    {
      "id": "uuid",
      "market": "PH",
      "displayDate": "2026-11-21",
      "originalCode": "GONLY1121-KDS2MMS",
      "leadName": "원문 이름",
      "pax": 2,
      "agencyName": "KDS",
      "summary": "11/21 MMS 10:10",
      "status": null,
      "needsReview": true,
      "rowVersion": 1
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
~~~

실제 값과 상태는 원본/검토 결과를 따른다. 위 예시는 계약 형식을 설명할 뿐 업무 코드의 의미를 확정하지 않는다.

### 3.1 예약 상세 응답

getReservation은 기본 정보와 일정의 짧은 요약만 반환한다. 손님 명단·결제·원본 셀은 getReservationSection으로 나누어 받는다.

~~~json
{
  "id": "uuid",
  "market": "JP",
  "originalCode": "원본 코드",
  "leadNameRaw": "원본 손님",
  "pax": 4,
  "startDate": null,
  "endDate": null,
  "agency": null,
  "status": null,
  "reviewState": "candidate",
  "rowVersion": 3,
  "itinerarySummary": [
    {"id": "item-uuid", "kind": "hotel", "date": null, "detailRaw": "원본 호텔 문구"}
  ]
}
~~~

응답의 null은 미확정 또는 원본 공백을 뜻한다. 상세의 section 값은 people, itinerary, vouchers, payments, events, sources 중 하나로 검증한다. 요청한 section 밖의 긴 메모·원본 데이터를 함께 반환하지 않는다.

## 4. 예약·일정 저장

| 작업 | 필수 입력 | 결과 |
|---|---|---|
| suggestReservationCode | 신규 form의 productCode, baseDate, partnerCode, pax, firstHotelName? | 현재 시스템 형식 추천 문자열. 저장 확정 아님 |
| createReservation | market, 입력값, reservationCode, codeEntryMode=suggested/manual, requestId | 새 UUID·저장된 코드·version. 비로그인 사용 가능 |
| updateReservation | reservationId, expectedVersion, 변경 필드만 담은 patch | 새 version과 변경된 필드 |
| deleteReservation | reservationId, expectedVersion, 확인한 코드·손님, deleteReason | 관리자 UID 확인 뒤 논리 삭제·사건 ID |
| create/updateItineraryItem | reservationId, itemId?, expectedVersion?, 서비스 종류·날짜·시간·원문 | 항목 ID와 version |
| addConfirmation | itineraryItemId 또는 supplierVoucherItemId, 번호 원문, 종류/출처 | 확인번호 ID |
| addReservationEvent | reservationId nullable, 취소·변경 종류, 전후 값·메모 | 사건 ID |
| addCostLine / addPaymentTransaction | 대상 ID, 유형, 금액·통화·날짜·원문 | 비용/지급 ID |

수정 가능한 필드를 DB 함수 또는 데이터 접근 계층에서 명시한다. 클라이언트가 임의의 source_cells, import_batches, market_id를 patch로 바꾸지 못하게 한다. 상태 변경은 명시적 사용자 조작과 이력 기록으로 처리한다. 날짜가 지났거나 금액이 있다는 이유로 저장 시 자동 CLOSED/PAID로 바꾸지 않는다. 여러 테이블을 한 동작으로 바꾸는 경우 DB 트랜잭션 안에서 처리한다.

신규 코드 추천은 현행 BookingDetailPage의 prefix + MMDD + '-' + partnerCode + pax + 호텔 접미어(POOL 또는 호텔 코드 앞 세 글자)를 기준으로 한다. 자동 추천을 [사용]해도 수기 수정할 수 있고, 수기값은 다른 필드 변경으로 덮지 않는다. 이관 original_code는 보존하고 재생성하지 않는다. 현행 추천에는 연도·순번이 없어 충돌 가능하므로 신규 저장 시 서버에서 국가별 기존 코드 충돌을 검증하고 동시 생성도 막는다. 자동 숫자 덧붙임은 하지 않는다. 충돌 시 VALIDATION을 돌려주어 사용자가 수기 코드를 고르게 한다.

deleteReservation은 일반 updateReservation patch의 deleted_at 지정이나 직접 DELETE로 우회할 수 없게 한다. 지정 관리자 세션에서만 실행하고, 원본 source_rows/source_cells는 유지하며 예약 행에는 deleted_at/deleted_by와 reservation_events를 기록한다. 기본 목록은 삭제된 예약을 제외하고 관리자 검토 화면에서는 복구 근거를 볼 수 있게 한다. 일반 사용자의 조회·추가·수정은 공개 범위를 제한한 서버 계약으로 노출하고 입력 검증·요청 제한·변경 이력을 적용한다.

충돌 응답은 CONFLICT, 실제 서버의 새 version, 다시 읽을 대상 ID를 제공한다. 프론트는 사용자의 입력값을 잃지 않고 비교/재시도를 제공한다. 같은 저장 요청 재전송으로 중복 지급이 생기지 않도록 지급·비용 생성에는 요청 ID 또는 중복 방지 키를 사용한다.

### 4.1 예약 수정 예

~~~json
{
  "reservationId": "uuid",
  "expectedVersion": 3,
  "patch": {
    "pax": 5,
    "leadNameRaw": "수정한 이름"
  },
  "changeNote": "인원 변경 확인"
}
~~~

성공 시 변경된 값과 rowVersion 4, 기록된 변경 사건 ID를 돌려준다. version이 이미 바뀌었으면 CONFLICT를 돌려주며 기존 요청의 patch를 자동 재적용하지 않는다. source_cells나 원본색은 이 요청으로 수정할 수 없다.

## 5. 클락 거래처별 바우처

| 작업 | 입력 | 결과 |
|---|---|---|
| listVoucherEntries | sourceSheetKey, serviceFrom?, serviceToExclusive?, keyword?, supplierId?, cursor?, limit | 원본 거래처 탭의 업무 행 요약, 다음 페이지 |
| getVoucherEntry | entryId | 원본 업무 행, 여러 수배/바우처 항목, 메모·색·출처 |
| updateVoucherEntryLink | entryId, expectedVersion, reservationId/agencyId 확인값 | 새 연결과 version, 검토 이력 |
| updateSupplierVoucherItem | itemId, expectedVersion, 확인된 공급처·날짜·상태 | 새 version |
| listVoucherDuplicates | entryId 또는 duplicateGroupId | 다른 탭의 복사 행 후보와 근거 |

sourceSheetKey는 KDS·Monkey·THE CLARK TOUR·CLARK GOGO·GOLDEN RIVER 원본 시트 탭 중 하나다. 탭은 출처로 고르므로 agencyId가 미확정인 행도 빠지지 않는다. agencyId는 확인된 **거래처** 연결값이고 supplierId는 골프장·호텔 **협력업체**다. 목록의 모든 행이 발급 완료 바우처는 아니다. 바우처 번호가 없거나 예약 ID가 미확정이어도 목록에서 보인다. 동일 원본 내용의 복사 행은 두 탭에서 조회할 수 있으나 집계에서는 검토 확정 전 제외하거나 중복 그룹으로 한 번만 센다. 상세의 숫자 메모를 확인번호로 확정할 때는 원문과 좌표를 유지한다.

### 5.1 바우처 목록·상세 응답 예

~~~json
{
  "items": [
    {
      "entryId": "uuid",
      "sourceSheet": "GOLDEN RIVER",
      "sourceRow": 8,
      "originalCode": "원본 코드",
      "nameRaw": "원본 손님",
      "paxRaw": "7",
      "firstServiceRaw": "원본 서비스 문구",
      "supplierName": null,
      "paymentRaw": null,
      "hasComment": true,
      "hasDuplicateCandidate": false,
      "reservationId": null,
      "rowVersion": 1
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
~~~

getVoucherEntry는 이 행의 모든 supplier_voucher_items, 각 확인번호/메모의 출처 좌표, 직접색/조건부 색, 복사 행 후보와 예약 연결 근거를 반환한다. 목록에서는 긴 메모 본문과 모든 날짜별 서비스를 보내지 않는다.

## 6. 필리핀 시제·일본 수배·원본

| 작업 | 입력 | 결과 |
|---|---|---|
| listCashTransactions | market=PH, currency=PHP/KRW, from, toExclusive, cursor | 날짜·적요·입출금·원본 잔액, 다음 페이지 |
| getJapanArrangement | JP reservationId | 손님 명단, 객실·박수, 항공, 호텔, 골프, 차량·기사 |
| listImportBatches | cursor | 파일명, 시트 수, 셀/메모/색 검증 수, 상태 |
| getSourceSheet/Rows/Cells | batchId, sheetId, 좌표/행 범위 | 원문·수식·저장 계산값·메모·직접색·조건부 서식 |
| listReviewIssues | market?, issueType?, state?, cursor | 원본 좌표·후보 해석·검토 상태 |
| resolveReviewIssue | issueId, expectedVersion, 결정·근거 | 새 상태와 이력 |
| listCodeGlossary / updateCodeGlossary | 국가·코드 계열, 뜻·유효성·적용 기간 | 관찰 문자열과 사용자 입력 |
| listColorGlossary / updateColorGlossary | 시트·색·적용 범위, 사용자 의미 | 원본 색과 해석 분리 |

원본 조회는 범위를 요구한다. 파일 전체의 source_cells와 55,000개 이상의 색칠된 빈 셀을 한 요청으로 브라우저에 보내지 않는다. 원본 배치는 불변이며, 검토 해결은 review_issues와 운영층 연결·해석에 기록한다. Excel 파일의 최초 파싱·적재는 인증된 브라우저의 공개 일괄 API가 아니라 관리용 가져오기 절차에서 실행한다.

### 6.1 원본 셀 응답 예

~~~json
{
  "batchId": "uuid",
  "sheetName": "2025 MAR",
  "coordinate": "K11",
  "rawValue": "원본 셀 값",
  "formula": null,
  "cachedValue": null,
  "commentText": "원본 메모 전체",
  "fill": {
    "pattern": "solid",
    "colorType": "theme",
    "theme": 5,
    "tint": 0
  },
  "mergedRange": null,
  "hiddenRow": false,
  "interpretations": []
}
~~~

색의 theme/rgb/tint, 수식 원문, 저장 계산값, 메모 작성자는 실제 파일에 있는 만큼 전달한다. 예시의 색 번호나 셀 내용은 실제 K11의 해석값을 뜻하지 않는다.

## 7. 정산서 목록·예약 모달

| 작업 | 입력 | 결과 | 제약 |
|---|---|---|---|
| listSettlementsWindow | market, from, toExclusive, keyword?, reviewState?, cursor?, limit? | 예약 ID별 정산 요약 행, nextCursor, hasMore | 기본 50·상한 100. AD:AQ 전체 원문·메모·수식은 포함하지 않음 |
| getSettlement | market, reservationId | 선택 예약의 정산 열 AD:AQ 원본 값/수식/캐시·셀 좌표, 확인된 비용/입금 연결, 검토 상태 | 행 버튼 모달과 정산 메뉴의 상세가 함께 사용 |
| updateSettlementReview | reservationId, expectedVersion, reviewState, noteRaw? | 변경된 검토 상태·version·변경 사건 | 원본 셀이나 운영 금액을 암묵 수정하지 않음 |

listSettlementsWindow는 예약 목록과 같은 국가·3개월 기본값을 사용하되 정산 메뉴에서 기간을 바꿀 수 있다. 표시일 또는 일정일이 범위에 들어오는 예약을 UUID별 한 번만 반환한다. 원본 복사 행이나 여러 일정으로 금액을 두 번 세지 않는다. 원본 정산 행이 없는 예약도 누락하지 않고 '원본 없음'으로 반환한다. 일본·태국은 같은 조회 틀을 쓰지만 필리핀 AD:AQ 열을 임의로 채우지 않는다.

요약 응답에는 reservationId, market, displayDate, originalCode, leadName, sourceSheet/row, 총투어피·페소·호텔·1TH~4TH·현지행사비·그 외 지출·옵션·원본 수익의 값과 통화/미확정 표시, hasSourceSettlement, reviewState만 넣는다. 무제목 AP/AQ는 목록에서 보일 수 있으나 의미를 명명하지 않으며 상세에서 원본 수식과 좌표를 확인한다. 통화가 다른 합계나 확인되지 않은 환산은 숫자로 계산하지 않는다.

getSettlement는 선택한 예약 ID의 원본 정산 행을 reservation_sources로 찾아 AD:AQ 좌표별로 반환한다. 각 셀은 rawValue, formula, cachedValue, currencyIfConfirmed, commentText, fill, sourceRef를 구분한다. AO의 관찰 수식과 행마다 다른 AF 환산식, AP/AQ의 미확정 뜻을 그대로 전달한다. NULL은 공백/미확정이며 0으로 치환하지 않는다. 연결된 cost_lines/payment_transactions는 별도 operational 섹션으로 반환해 원본값과 비교할 수 있게 한다. 예약 코드 문자열만으로 원본 행을 결합하지 않는다.

정산 원본 메모·수식은 모달을 열 때에만 전송한다. 목록과 상세는 일반 조회 계약을 따르고, 검토 상태의 확정 변경은 관리자 세션을 요구한다. 검토 수정은 충돌 시 CONFLICT와 서버 version을 돌려준다.

## 8. 공통 헤더 환율

| 작업 | 입력 | 결과 | 접근 |
|---|---|---|---|
| getHeaderFxRates | 없음 | USD·PHP·JPY 각각 KRW 값, 단위, 네이버 고시 시각, 앱 확인 시각, 출처 URL, stale/오류 상태 | 로그인 없이 조회 |
| refreshHeaderFxRates | 수동 새로고침 요청 ID | 서버가 네이버 세 통화를 재확인한 결과와 통화별 성공/실패 | 일반 화면에서 요청 가능, 서버 중복 클릭·호출량 제한 |

매일 06:00 Asia/Seoul 예정 작업과 일반 화면의 새로고침 버튼은 **동일한 서버 수집 절차**를 호출한다. 실행 시간대를 명시해 서버/DB가 UTC라도 한국시간 6시에 실행되도록 검증한다. 브라우저는 네이버 페이지를 직접 요청하지 않는다. 환율 공급 페이지가 바뀌거나 일시 실패하면 마지막 정상 스냅샷을 반환하고 고시 시각·마지막 성공 시각·오류를 함께 표시한다. 새로고침은 네이버의 새 고시를 강제로 만드는 기능이 아니므로 같은 고시가 반환될 수 있다.

네이버 원화 표시 단위에 맞춰 USD/PHP는 1단위, JPY는 100단위로 저장·응답한다. 각 통화의 sourceQuotedAt과 fetchedAt은 다를 수 있다. 응답의 stale은 조회 성공 여부와 원본 고시의 최신성을 구분한다. 비정상 문자열, 0 이하 값, 통화/단위 불일치를 정상 스냅샷으로 저장하지 않는다. 이 API는 정보 표시용이며 예약 비용·원본 엑셀 환산식·정산서 계산을 수정하지 않는다.

실제 구현 전 네이버의 안정적인 서버 조회 경로와 이용 조건을 확인한다. 공식 제공 경로가 없는 경우 임의 비공개 API를 안정 계약으로 가정하지 않는다. 출처 페이지는 [USD](https://m.stock.naver.com/marketindex/exchange/FX_USDKRW), [PHP](https://m.stock.naver.com/marketindex/exchange/FX_PHPKRW), [JPY 100](https://m.stock.naver.com/marketindex/exchange/FX_JPYKRW)이다.

## 9. 마스터 데이터

처음 필요한 마스터는 국가, 거래처, 골프장·호텔 협력업체다. 국가별 필요한 항목만 조회한다. 검색 결과에는 이름과 원본 별칭을 함께 보여주되 원본 이름을 표준명으로 덮지 않는다. 가이드·기사·차량은 일본·필리핀 상세에서 실제 사용될 만큼만 추가한다. 복잡한 공급처 가격 규칙, 자동 공휴일 계산, 다중 역할 계정 API는 첫 범위에서 제외한다.

## 10. 속도와 보안 확인

- 첫 3개월 목록은 요약 응답으로 시작한다. 페이지 크기 제한은 네트워크 비용을 줄이기 위한 것이며 전체 3개월 예약 누락을 허용하는 제한이 아니다.
- 국가·날짜·코드·거래처 검색용 인덱스를 데이터량에 맞춰 둔다. 검색 입력은 잠시 멈춘 뒤 요청하며 이전 결과를 로딩 중 유지한다.
- 손님 명단·메모·정산·원본 셀은 브라우저에 24시간 영구 캐시하지 않는다. 로그아웃 시 관련 캐시를 비운다.
- 비로그인 일반 조회·예약 추가/수정은 허용하되 삭제·이관·관리 설정 변경은 관리자 UID가 없으면 서버에서 거부해야 한다. 조회 뷰가 의도한 접근 경계를 우회하지 않아야 한다.
- 목록, 상세, 저장은 통신 실패와 권한 오류를 구분해 표시한다. 저장 실패를 성공으로 보이지 않는다.

## 11. 첫 구현에서 만들지 않을 계약

기존 bookings.code 전역 UNIQUE를 전제로 한 조회, vouchers.booking_code 문자열 조인, 1TH~6TH·memo_1~6 고정 열의 일괄 전송, 날짜 경과에 따른 자동 상태 변경, 엑셀 이관 코드의 재생성, 전체 DB를 다운로드하는 오프라인 동기화, 별도 골프/호텔 리포트 API. 신규 예약의 기존 시스템 형식 코드 추천·수기 입력은 포함한다.
