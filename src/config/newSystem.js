// Editable display and suggestion rules. Imported codes and source values are never rewritten.
export const MARKETS = {
  PH: { label: '필리핀', currency: 'PHP', path: '/ph/reservations' },
  TH: { label: '태국', currency: 'THB', path: '/th/reservations' },
  JP: { label: '일본', currency: 'JPY', path: '/jp/reservations' },
}

export const CLARK_SHEETS = ['KDS', 'MONKEY', 'THE CLARK TOUR', 'CLARK GOGO', 'GOLDEN RIVER']

export const RESERVATION_COLUMNS = [
  { key: 'display_date', label: '일자' },
  { key: 'reservation_code', label: 'CODE' },
  { key: 'lead_name_raw', label: '대표자' },
  { key: 'pax', label: 'PAX' },
  { key: 'agency_name', label: '거래처' },
  { key: 'status', label: '상태' },
]

// Original worksheet headings and widths, indexed by Excel column. Keep these editable
// here when the source workbook changes; reservation data itself is never rewritten.
export const SOURCE_RESERVATION_COLUMNS = {
  PH: [
    ['A','',9],['B','총투어피',19],['C','입금\n일자',9],['D','no',20],['E','내용 / 비고 / 거래처',23],
    ['F','CODE',25],['G','PAX',7],['H','HOTEL\nR/T',18],['I','SC',7],['J','INT-F\nETA/ETD',15],
    ['K','FIRST HOTEL\nH/T',37],['L','',5],['M','',6],['N','GUIDE',43],
    ['O','1TH',44],['P','',5],['Q','',5],['R','2TH',44],['S','',5],['T','',5],
    ['U','3TH',44],['V','',5],['W','',5],['X','4TH',46],['Y','',5],['Z','',5],
    ['AA','TRANS',43],['AB','TRANS\nAGENT',34],['AC','CFM',26],
  ],
  JP: [
    ['A','',12],['B','엔화',12],['C','한화',12],['D','입금\n일자',12],['E','행사비\n최종정산금액',17],
    ['F','내용 / 비고 / 거래처',22],['G','CODE',16],['H','인원\nPAX',7],['I','호텔\n룸타입 TYPE',17],
    ['J','박/NIGHT',8],['K','항공스케쥴\nETA/ETD',17],['L','',24],['M','호텔이름',25],['N','',26],
    ['O','',31],['P','1일',45],['Q','2일',40],['R','3일',56],['S','4일',59],
    ['T','차량',47],['U','차량\nAGENT',25],['V','CFM',19],['W','REMARK',33],
  ],
}

export const SETTLEMENT_COLUMNS = [
  ['AD', 'CODE'], ['AE', '총 투어피'], ['AF', '페소'], ['AG', 'Hotel'],
  ['AH', '1TH'], ['AI', '2TH'], ['AJ', '3TH'], ['AK', '4TH'],
  ['AL', '현지행사비'], ['AM', '그 외 지출'], ['AN', '옵션'], ['AO', '수익'],
  ['AP', '원본 AP'], ['AQ', '원본 AQ'],
]

export const CODE_RULE = {
  separator: '-',
  poolSuffix: 'POOL',
  hotelPrefixLength: 3,
}

export function suggestCode({ productCode, baseDate, partnerCode, pax, firstHotelName }) {
  const mmdd = /^\d{4}-\d{2}-\d{2}$/.test(baseDate || '')
    ? `${baseDate.slice(5, 7)}${baseDate.slice(8, 10)}` : ''
  const hotel = (firstHotelName || '').trim().toUpperCase()
  const suffix = hotel === 'POOL' ? CODE_RULE.poolSuffix : hotel.slice(0, CODE_RULE.hotelPrefixLength)
  return [String(productCode || '').trim().toUpperCase() + mmdd,
    [String(partnerCode || '').trim().toUpperCase(), pax || '', suffix].join('')]
    .filter(Boolean).join(CODE_RULE.separator)
}

export function monthWindow(offset = 0, now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth() + offset - 1, 1)
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 2, 1)
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(from), toExclusive: iso(to), label: `${from.getFullYear()}년 ${from.getMonth() + 1}월 — ${new Date(to.getFullYear(), to.getMonth() - 1, 1).getMonth() + 1}월` }
}
