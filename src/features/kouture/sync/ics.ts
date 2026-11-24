import { zonedTimeToUtc } from '@/lib/dates';

// Minimal iCalendar (RFC 5545) reader for the Nailzy → Google Calendar feed.
// Only the fields a booking needs; recurring and all-day events are reported
// so the sync can skip them (salon bookings are single, timed events).

export type CalendarEvent = {
  uid: string;
  start: string;
  end: string;
  summary: string;
  description: string | null;
  cancelled: boolean;
  /** Set for events the sync should not import, with the reason. */
  unsupported: 'all_day' | 'recurring' | 'no_time' | null;
};

type Prop = { name: string; params: Record<string, string>; value: string };

function parseLine(line: string): Prop | null {
  // NAME;PARAM=VALUE;PARAM="VALUE":value — the value may itself contain colons.
  let i = 0;
  let inQuotes = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ':' && !inQuotes) break;
  }
  if (i >= line.length) return null;
  const [name, ...rawParams] = line.slice(0, i).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value: line.slice(i + 1) };
}

function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** ISO instant for a DATE-TIME property, or null for an all-day DATE. */
function toInstant(prop: Prop, fallbackZone: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(prop.value.trim());
  if (!m || !m[4]) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString();
  const zone = prop.params.TZID ?? fallbackZone;
  try {
    return zonedTimeToUtc(`${y}-${mo}-${d}`, +h, +mi, +s, zone).toISOString();
  } catch {
    // Unknown TZID (e.g. a Windows zone name): fall back to the owner's zone.
    return zonedTimeToUtc(`${y}-${mo}-${d}`, +h, +mi, +s, fallbackZone).toISOString();
  }
}

function addDuration(startIso: string, duration: string): string | null {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(duration.trim());
  if (!m) return null;
  const [, d = '0', h = '0', mi = '0', s = '0'] = m;
  const ms = ((+d * 24 + +h) * 60 + +mi) * 60_000 + +s * 1000;
  return new Date(Date.parse(startIso) + ms).toISOString();
}

export function parseIcs(text: string, fallbackZone: string): CalendarEvent[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events: CalendarEvent[] = [];
  let props: Prop[] | null = null;
  let depth = 0; // nested components (VALARM) inside a VEVENT

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      props = [];
      depth = 0;
      continue;
    }
    if (!props) continue;
    if (line.startsWith('BEGIN:')) {
      depth++;
      continue;
    }
    if (line.startsWith('END:') && line !== 'END:VEVENT') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (line === 'END:VEVENT') {
      const event = toEvent(props, fallbackZone);
      if (event) events.push(event);
      props = null;
      continue;
    }
    if (depth > 0) continue;
    const prop = parseLine(line);
    if (prop) props.push(prop);
  }
  return events;
}

function toEvent(props: Prop[], zone: string): CalendarEvent | null {
  const get = (name: string) => props.find((p) => p.name === name);
  const uid = get('UID')?.value.trim();
  const dtstart = get('DTSTART');
  if (!uid || !dtstart) return null;
  // A changed single occurrence of a recurring event shares the series UID.
  const recurrence = get('RECURRENCE-ID')?.value.trim();
  const key = recurrence ? `${uid}#${recurrence}` : uid;
  const summary = unescapeText(get('SUMMARY')?.value ?? '').trim();
  const description = get('DESCRIPTION');
  const base = {
    uid: key,
    summary,
    description: description ? unescapeText(description.value).trim() || null : null,
    cancelled: get('STATUS')?.value.trim().toUpperCase() === 'CANCELLED'
  };

  const isAllDay = dtstart.params.VALUE === 'DATE' || /^\d{8}$/.test(dtstart.value.trim());
  const start = toInstant(dtstart, zone);
  if (isAllDay || !start) {
    return { ...base, start: '', end: '', unsupported: isAllDay ? 'all_day' : 'no_time' };
  }
  const dtend = get('DTEND');
  const duration = get('DURATION');
  const end =
    (dtend && toInstant(dtend, zone)) ||
    (duration && addDuration(start, duration.value)) ||
    new Date(Date.parse(start) + 60 * 60_000).toISOString();
  return {
    ...base,
    start,
    end:
      Date.parse(end) > Date.parse(start)
        ? end
        : new Date(Date.parse(start) + 60_000).toISOString(),
    unsupported: get('RRULE') ? 'recurring' : null
  };
}
