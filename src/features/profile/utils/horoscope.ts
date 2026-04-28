export interface Zodiac {
  name: string;
  symbol: string;
}

export function zodiacFor(month: number, day: number): Zodiac {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
    return { name: 'Aries', symbol: '♈' };
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
    return { name: 'Taurus', symbol: '♉' };
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
    return { name: 'Gemini', symbol: '♊' };
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
    return { name: 'Cancer', symbol: '♋' };
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
    return { name: 'Leo', symbol: '♌' };
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
    return { name: 'Virgo', symbol: '♍' };
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
    return { name: 'Libra', symbol: '♎' };
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
    return { name: 'Scorpio', symbol: '♏' };
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
    return { name: 'Sagittarius', symbol: '♐' };
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
    return { name: 'Capricorn', symbol: '♑' };
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
    return { name: 'Aquarius', symbol: '♒' };
  return { name: 'Pisces', symbol: '♓' };
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatBirthday(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${day} ${MONTH_SHORT[month - 1]}`;
}

export function zodiacFromIso(iso: string | null): Zodiac | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return zodiacFor(parseInt(m[2], 10), parseInt(m[3], 10));
}
