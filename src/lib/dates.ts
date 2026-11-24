// Calendar-day maths in the owner's timezone. "Today" must never be derived from
// UTC, or habits and appointments flip days at the wrong hour.

export const DEFAULT_TIMEZONE = 'America/New_York';

type DateParts = { year: number; month: number; day: number };

function partsInZone(
  date: Date,
  timeZone: string
): DateParts & { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second')
  };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD for the given instant as seen in `timeZone`. */
export function dayKey(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function todayKey(timeZone: string, now: Date = new Date()): string {
  return dayKey(now, timeZone);
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant at which local midnight of `key` occurs in `timeZone`. */
export function startOfDayInZone(key: string, timeZone: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  const first = new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
  // Second pass corrects days where the offset changes (DST transitions).
  return new Date(guess.getTime() - zoneOffsetMs(first, timeZone));
}

/** The UTC instant of a wall-clock time (`key` at h:m:s) in `timeZone`. */
export function zonedTimeToUtc(
  key: string,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const [y, m, d] = key.split('-').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hour, minute, second));
  const first = new Date(guess.getTime() - zoneOffsetMs(guess, timeZone));
  return new Date(guess.getTime() - zoneOffsetMs(first, timeZone));
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Monday-start week containing `key`. */
export function startOfWeek(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(key, -((weekday + 6) % 7));
}

export function startOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function daysBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  for (let k = fromKey; k <= toKey; k = addDays(k, 1)) out.push(k);
  return out;
}

export function greetingFor(now: Date, timeZone: string): string {
  const hour = partsInZone(now, timeZone).hour;
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatTime(date: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(
    new Date(date)
  );
}

export function formatDayLong(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDayShort(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

export function relativeDayLabel(key: string, today: string): string {
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  if (key < today) return 'Overdue';
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric'
  }).format(new Date(Date.UTC(y, m - 1, d)));
}
