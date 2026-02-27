export function koreanToEnglishName(input) {
  if (!input) return '';
  const text = input.trim();
  if (!text) return '';

  const base = 0xac00;
  const cho = [
    'g',
    'kk',
    'n',
    'd',
    'tt',
    'r',
    'm',
    'b',
    'pp',
    's',
    'ss',
    '',
    'j',
    'jj',
    'ch',
    'k',
    't',
    'p',
    'h',
  ];
  const jung = [
    'a',
    'ae',
    'ya',
    'yae',
    'eo',
    'e',
    'yeo',
    'ye',
    'o',
    'wa',
    'wae',
    'oe',
    'yo',
    'u',
    'weo',
    'we',
    'wi',
    'yu',
    'eu',
    'yi',
    'i',
  ];
  const jong = [
    '',
    'k',
    'k',
    'ks',
    'n',
    'nj',
    'nh',
    't',
    'l',
    'lk',
    'lm',
    'lb',
    'ls',
    'lt',
    'lp',
    'lh',
    'm',
    'p',
    'ps',
    't',
    't',
    'ng',
    't',
    't',
    'k',
    't',
    'p',
    't',
  ];

  const doubleFamilyNames = ['남궁', '황보', '제갈', '선우', '독고', '서문', '사공'];

  const romanizeBlock = (block) => {
    let result = '';
    for (let i = 0; i < block.length; i += 1) {
      const code = block.charCodeAt(i);
      if (code < 0xac00 || code > 0xd7a3) {
        result += block[i];
        continue;
      }
      const offset = code - base;
      const choIdx = Math.floor(offset / 588);
      const jungIdx = Math.floor((offset % 588) / 28);
      const jongIdx = offset % 28;
      result += cho[choIdx] + jung[jungIdx] + jong[jongIdx];
    }
    return result;
  };

  const isHangulOnly = [...text].every((ch) => {
    const code = ch.charCodeAt(0);
    return code >= 0xac00 && code <= 0xd7a3;
  });

  if (!isHangulOnly) {
    const raw = romanizeBlock(text).trim();
    if (!raw) return '';
    const s = raw.charAt(0).toUpperCase() + raw.slice(1);
    if (s === 'Gim') return 'Kim';
    if (s === 'Bak') return 'Park';
    return s;
  }

  let familyLen = 1;
  if (text.length >= 2 && doubleFamilyNames.includes(text.slice(0, 2))) {
    familyLen = 2;
  }

  const familyHangul = text.slice(0, familyLen);
  const givenHangul = text.slice(familyLen);

  const familyEnRaw = romanizeBlock(familyHangul).trim();
  const givenEnRaw = romanizeBlock(givenHangul).trim();

  const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

  let familyEn = capitalize(familyEnRaw);
  const givenEn = capitalize(givenEnRaw);

  if (familyEn === 'Gim') familyEn = 'Kim';
  if (familyEn === 'Bak') familyEn = 'Park';

  if (!familyEn && !givenEn) return '';
  if (!givenEn) return familyEn;
  return `${familyEn} ${givenEn}`;
}

