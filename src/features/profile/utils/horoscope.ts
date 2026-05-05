import i18n from '@lib/i18n';

export interface Zodiac {
  name: string;
  symbol: string;
}

export function zodiacFor(month: number, day: number): Zodiac {
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
    return { name: i18n.t('profile.horoscope.aries'), symbol: '♈' };
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
    return { name: i18n.t('profile.horoscope.taurus'), symbol: '♉' };
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
    return { name: i18n.t('profile.horoscope.gemini'), symbol: '♊' };
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
    return { name: i18n.t('profile.horoscope.cancer'), symbol: '♋' };
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
    return { name: i18n.t('profile.horoscope.leo'), symbol: '♌' };
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
    return { name: i18n.t('profile.horoscope.virgo'), symbol: '♍' };
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
    return { name: i18n.t('profile.horoscope.libra'), symbol: '♎' };
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
    return { name: i18n.t('profile.horoscope.scorpio'), symbol: '♏' };
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
    return { name: i18n.t('profile.horoscope.sagittarius'), symbol: '♐' };
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
    return { name: i18n.t('profile.horoscope.capricorn'), symbol: '♑' };
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
    return { name: i18n.t('profile.horoscope.aquarius'), symbol: '♒' };
  return { name: i18n.t('profile.horoscope.pisces'), symbol: '♓' };
}

export function formatBirthday(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${day} ${i18n.t(`profile.monthShort.${month}`)}`;
}

export function zodiacFromIso(iso: string | null): Zodiac | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return zodiacFor(parseInt(m[2], 10), parseInt(m[3], 10));
}
