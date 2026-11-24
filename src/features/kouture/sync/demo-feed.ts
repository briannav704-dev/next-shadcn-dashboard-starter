import { addDays, todayKey, zonedTimeToUtc } from '@/lib/dates';

// Sample calendar feed for preview mode, shaped like Nailzy's Google Calendar
// events ("Client — Service — Length"), so the sync can be tried end to end.

function stamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function demoFeed(now: Date, timeZone: string): string {
  const today = todayKey(timeZone, now);
  const at = (days: number, hour: number, minute = 0) =>
    zonedTimeToUtc(addDays(today, days), hour, minute, 0, timeZone);
  const events: [string, string, Date, number, string?][] = [
    ['sample-1', 'Jen Rivera — Acrylic Fill — Short', at(1, 11), 95],
    [
      'sample-2',
      'Jamiyla Hills — Acrylic Full Set — Short, Kouture Classic Manicure',
      at(1, 13),
      165
    ],
    ['sample-3', 'Maya Thompson — Gel-X Full Set — Medium', at(2, 10), 120],
    ['sample-4', 'Nia Johnson — Luxe Pedicure', at(3, 15, 30), 60, 'CANCELLED'],
    ['sample-5', 'Ari Santos — Chrome French — Long', at(4, 12), 120],
    ['sample-6', 'Supply pickup', at(2, 9), 30]
  ];
  const body = events
    .map(([uid, summary, start, minutes, status]) =>
      [
        'BEGIN:VEVENT',
        `UID:${uid}@kouture-preview`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART:${stamp(start)}`,
        `DTEND:${stamp(new Date(start.getTime() + minutes * 60_000))}`,
        `SUMMARY:${summary}`,
        status ? `STATUS:${status}` : 'STATUS:CONFIRMED',
        'END:VEVENT'
      ].join('\r\n')
    )
    .join('\r\n');
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Kouture preview//EN\r\n${body}\r\nEND:VCALENDAR\r\n`;
}
