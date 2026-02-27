import { addDays, differenceInDays, format } from 'date-fns';

export const formatDate = (date, formatStr = 'yyyy-MM-dd') => {
  if (!date) return '';
  return format(new Date(date), formatStr);
};

export const fmtDate = (date) => formatDate(date, 'yyyy-MM-dd');

export const getDurationText = (startStr, endStr) => {
  if (!startStr || !endStr) return '';

  const start = new Date(startStr);
  const end = new Date(endStr);

  const nights = differenceInDays(end, start);
  if (nights < 0) return '날짜 오류';

  return `${nights}박 ${nights + 1}일`;
};

export const todayISO = () => format(new Date(), 'yyyy-MM-dd');

export const addDaysISO = (dateStr, days) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return format(addDays(date, days), 'yyyy-MM-dd');
};
