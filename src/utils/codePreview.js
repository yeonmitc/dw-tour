export const PRODUCT_MAPPING = {
  AGP: { type: 'PACKAGE', branch: 'CHIANGMAI', label: 'AGP - Chiang Mai Golf' },
  MGP: { type: 'PACKAGE', branch: 'PHILIPPINES', label: 'MGP - Manila Golf' },
  KGP: { type: 'PACKAGE', branch: 'PHILIPPINES', label: 'KGP - Clark Golf' },
  CGP: { type: 'PACKAGE', branch: 'PHILIPPINES', label: 'CGP - Cebu Golf' },
  FGP: { type: 'PACKAGE', branch: 'JAPAN', label: 'FGP - Fukuoka Golf' },
  CEP: { type: 'CEP', branch: 'PHILIPPINES', label: 'CEP - Cebu Package' },
  CONLY: { type: 'CONLY', branch: '', label: 'CONLY - Car Only' }, // Or TRANSFER_ONLY
  GONLY: { type: 'GONLY', branch: '', label: 'GONLY - Golf Only' },
  RONLY: { type: 'RONLY', branch: '', label: 'RONLY - Room Only' }, // Or HOTEL_ONLY
  BUSONLY: { type: 'BUSONLY', branch: '', label: 'BUSONLY - Bus Only' },
  OON: { type: 'OPTION_ONLY', branch: '', label: 'OON - Option Only' },
};

export function getBookingPrefix(bookingType, branch) {
  const bt = (bookingType || '').toUpperCase();
  const br = (branch || '').toUpperCase();

  if (bt === 'TRANSFER_ONLY' || bt === 'CONLY') return 'CON';
  if (bt === 'GOLF_VOUCHER_ONLY' || bt === 'GOLF_ONLY' || bt === 'GONLY') return 'GON';
  if (bt === 'HOTEL_ONLY' || bt === 'RONLY') return 'RON';
  if (bt === 'BUSONLY') return 'BON';
  if (bt === 'OPTION_ONLY' || bt === 'OON') return 'OON';
  if (bt === 'CEP' || bt === 'TOUR_PACKAGE' || bt === 'SIGHTSEEING') return 'CEP';

  if (bt === 'PACKAGE') {
    if (br === 'CHIANGMAI') return 'AGP';
    if (br === 'PHILIPPINES') return 'MGP';
    if (br === 'JAPAN') return 'FGP';
    return 'PKG';
  }

  return 'BK';
}

export function formatYYMMDD(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

export function makeBookingCodePreview({ bookingType, branch, baseDate }) {
  const prefix = getBookingPrefix(bookingType, branch);
  const yymmdd = formatYYMMDD(baseDate);

  if (!yymmdd) return `${prefix}-??????-???`;
  return `${prefix}-${yymmdd}-???`;
}
