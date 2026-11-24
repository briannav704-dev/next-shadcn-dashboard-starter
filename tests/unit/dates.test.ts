import { describe, expect, it } from 'vitest';

import {
  addDays,
  dayKey,
  relativeDayLabel,
  startOfDayInZone,
  startOfWeek,
  todayKey
} from '@/lib/dates';

describe('dates', () => {
  it('uses the owner timezone for "today", not UTC', () => {
    // 2026-11-25 03:30 UTC is still the evening of Nov 24 in New York
    const instant = new Date('2026-11-25T03:30:00Z');
    expect(todayKey('America/New_York', instant)).toBe('2026-11-24');
    expect(todayKey('UTC', instant)).toBe('2026-11-25');
  });

  it('finds local midnight across DST changes', () => {
    expect(startOfDayInZone('2026-11-24', 'America/New_York').toISOString()).toBe(
      '2026-11-24T05:00:00.000Z'
    );
    expect(startOfDayInZone('2026-07-01', 'America/New_York').toISOString()).toBe(
      '2026-07-01T04:00:00.000Z'
    );
    // DST ends Nov 1 2026 in the US; midnight is still EDT
    expect(startOfDayInZone('2026-11-01', 'America/New_York').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z'
    );
    expect(
      dayKey(startOfDayInZone('2026-03-08', 'America/Los_Angeles'), 'America/Los_Angeles')
    ).toBe('2026-03-08');
  });

  it('does calendar arithmetic', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(startOfWeek('2026-11-24')).toBe('2026-11-23'); // Tuesday -> Monday
    expect(startOfWeek('2026-11-29')).toBe('2026-11-23'); // Sunday -> Monday
  });

  it('labels relative days', () => {
    expect(relativeDayLabel('2026-11-24', '2026-11-24')).toBe('Today');
    expect(relativeDayLabel('2026-11-25', '2026-11-24')).toBe('Tomorrow');
    expect(relativeDayLabel('2026-11-20', '2026-11-24')).toBe('Overdue');
    expect(relativeDayLabel('2026-12-02', '2026-11-24')).toBe('Dec 2');
  });
});
