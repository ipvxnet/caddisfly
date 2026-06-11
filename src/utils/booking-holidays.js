// Major-holiday presets for the booking engine's date overrides — pure date
// math, no DB. Countries match the i18n audience (US first, then BR/MX/ES/PT).
// "Major" deliberately means days a local SMB almost certainly closes; owners
// delete any they keep open (overrides are individually deletable).

/** Easter Sunday (Gregorian) — Meeus/Jones/Butcher algorithm. */
export function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** Date shifted by N days (UTC-noon arithmetic, DST-proof). */
function shift(y, m, d, days) {
  const t = new Date(Date.UTC(y, m - 1, d, 12));
  t.setUTCDate(t.getUTCDate() + days);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Nth (1-based) weekday (0=Sun…6=Sat) of a month, e.g. 4th Thursday of Nov. */
export function nthWeekday(year, month, n, weekday) {
  const first = new Date(Date.UTC(year, month - 1, 1, 12)).getUTCDay();
  const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return ymd(year, month, day);
}

/** Last weekday (0=Sun…6=Sat) of a month, e.g. last Monday of May. */
export function lastWeekday(year, month, weekday) {
  const lastDay = new Date(Date.UTC(year, month, 0, 12)); // day 0 of next month
  const back = (lastDay.getUTCDay() - weekday + 7) % 7;
  return shift(year, month, lastDay.getUTCDate(), -back);
}

function easterOffset(year, days) {
  const e = easterDate(year);
  return shift(year, e.month, e.day, days);
}

export const HOLIDAY_COUNTRIES = ['US', 'BR', 'MX', 'ES', 'PT'];

/** [{date:'YYYY-MM-DD', label}] for one country + year. */
export function holidaysFor(country, year) {
  const y = year;
  switch (String(country || '').toUpperCase()) {
    case 'US':
      return [
        { date: ymd(y, 1, 1), label: "New Year's Day" },
        { date: lastWeekday(y, 5, 1), label: 'Memorial Day' },
        { date: ymd(y, 7, 4), label: 'Independence Day' },
        { date: nthWeekday(y, 9, 1, 1), label: 'Labor Day' },
        { date: nthWeekday(y, 11, 4, 4), label: 'Thanksgiving' },
        { date: ymd(y, 12, 25), label: 'Christmas Day' },
      ];
    case 'BR':
      return [
        { date: ymd(y, 1, 1), label: 'Confraternização Universal' },
        { date: easterOffset(y, -48), label: 'Carnaval (segunda)' },
        { date: easterOffset(y, -47), label: 'Carnaval (terça)' },
        { date: easterOffset(y, -2), label: 'Sexta-feira Santa' },
        { date: ymd(y, 4, 21), label: 'Tiradentes' },
        { date: ymd(y, 5, 1), label: 'Dia do Trabalho' },
        { date: ymd(y, 9, 7), label: 'Independência' },
        { date: ymd(y, 10, 12), label: 'Nossa Senhora Aparecida' },
        { date: ymd(y, 11, 2), label: 'Finados' },
        { date: ymd(y, 11, 15), label: 'Proclamação da República' },
        { date: ymd(y, 12, 25), label: 'Natal' },
      ];
    case 'MX':
      return [
        { date: ymd(y, 1, 1), label: 'Año Nuevo' },
        { date: nthWeekday(y, 2, 1, 1), label: 'Día de la Constitución' },
        { date: nthWeekday(y, 3, 3, 1), label: 'Natalicio de Benito Juárez' },
        { date: ymd(y, 5, 1), label: 'Día del Trabajo' },
        { date: ymd(y, 9, 16), label: 'Día de la Independencia' },
        { date: nthWeekday(y, 11, 3, 1), label: 'Revolución Mexicana' },
        { date: ymd(y, 12, 25), label: 'Navidad' },
      ];
    case 'ES':
      return [
        { date: ymd(y, 1, 1), label: 'Año Nuevo' },
        { date: ymd(y, 1, 6), label: 'Epifanía (Reyes)' },
        { date: easterOffset(y, -2), label: 'Viernes Santo' },
        { date: ymd(y, 5, 1), label: 'Día del Trabajador' },
        { date: ymd(y, 8, 15), label: 'Asunción de la Virgen' },
        { date: ymd(y, 10, 12), label: 'Fiesta Nacional' },
        { date: ymd(y, 11, 1), label: 'Todos los Santos' },
        { date: ymd(y, 12, 6), label: 'Día de la Constitución' },
        { date: ymd(y, 12, 8), label: 'Inmaculada Concepción' },
        { date: ymd(y, 12, 25), label: 'Navidad' },
      ];
    case 'PT':
      return [
        { date: ymd(y, 1, 1), label: 'Ano Novo' },
        { date: easterOffset(y, -2), label: 'Sexta-feira Santa' },
        { date: ymd(y, 4, 25), label: 'Dia da Liberdade' },
        { date: ymd(y, 5, 1), label: 'Dia do Trabalhador' },
        { date: easterOffset(y, 60), label: 'Corpo de Deus' },
        { date: ymd(y, 6, 10), label: 'Dia de Portugal' },
        { date: ymd(y, 8, 15), label: 'Assunção de Nossa Senhora' },
        { date: ymd(y, 10, 5), label: 'Implantação da República' },
        { date: ymd(y, 11, 1), label: 'Todos os Santos' },
        { date: ymd(y, 12, 1), label: 'Restauração da Independência' },
        { date: ymd(y, 12, 8), label: 'Imaculada Conceição' },
        { date: ymd(y, 12, 25), label: 'Natal' },
      ];
    default:
      return [];
  }
}

/** Upcoming holidays from a given date through the END OF NEXT YEAR. */
export function upcomingHolidays(country, fromDate) {
  const year = parseInt(String(fromDate).slice(0, 4), 10);
  return [...holidaysFor(country, year), ...holidaysFor(country, year + 1)]
    .filter((h) => h.date >= fromDate)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
