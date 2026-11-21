/**
 * Настройки календаря. Даты рассчитываются по московскому времени (UTC+3).
 * Для нового года достаточно поменять START_YEAR, START_MONTH, START_DAY.
 */
export const CONFIG = {
  startYear: 2026,
  startMonth: 12,
  startDay: 1,
  unlockHourMoscow: 10,
  totalDays: 24,
  // Для проверки интерфейса при локальной работе можно использовать ?preview=all.
  // Это лишь визуальный предпросмотр; опубликованный сайт без параметра следует календарю.
};

/** Номер дня 1..24 или 0, если выпуск ещё не стартовал. */
export function availableDays(now = new Date()) {
  const base = Date.UTC(CONFIG.startYear, CONFIG.startMonth - 1, CONFIG.startDay, CONFIG.unlockHourMoscow - 3, 0, 0);
  const day = Math.floor((now.getTime() - base) / 86_400_000) + 1;
  return Math.max(0, Math.min(CONFIG.totalDays, day));
}

export function openingTime(day) {
  const base = Date.UTC(CONFIG.startYear, CONFIG.startMonth - 1, CONFIG.startDay, CONFIG.unlockHourMoscow - 3, 0, 0);
  return new Date(base + (day - 1) * 86_400_000);
}

export function russianDate(day) {
  const when = openingTime(day);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }).format(when);
}

export function shortDate(day) {
  const date = openingTime(day);
  const result = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' }).format(date);
  return result.replace('.', '').toUpperCase();
}
