import { describe, expect, it } from 'vitest';

import { personalize, toE164, withinQuietHours } from '@/features/kouture/lib/sms';

describe('text rules', () => {
  it('normalises US numbers and rejects anything else', () => {
    expect(toE164('(555) 010-0102')).toBe('+15550100102');
    expect(toE164('1-555-010-0102')).toBe('+15550100102');
    expect(toE164('555-0102')).toBeNull();
    expect(toE164(null)).toBeNull();
  });

  it('personalises and always includes opt-out wording, once', () => {
    expect(personalize('Hi {first_name}! See you soon.', 'Jen Rivera')).toBe(
      'Hi Jen! See you soon. Reply STOP to opt out.'
    );
    expect(personalize('Hi {first_name}. Reply STOP to opt out.', 'Ivory')).toBe(
      'Hi Ivory. Reply STOP to opt out.'
    );
  });

  it('only allows marketing texts between 8am and 9pm local time', () => {
    const at = (iso: string) => withinQuietHours(new Date(iso), 'America/New_York');
    expect(at('2026-11-28T12:59:00Z')).toBe(false); // 7:59am
    expect(at('2026-11-28T13:00:00Z')).toBe(true); // 8:00am
    expect(at('2026-11-29T01:59:00Z')).toBe(true); // 8:59pm
    expect(at('2026-11-29T02:00:00Z')).toBe(false); // 9:00pm
  });
});
