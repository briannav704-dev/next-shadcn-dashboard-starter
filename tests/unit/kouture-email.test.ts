import { describe, expect, it } from 'vitest';

import { composeEmail, emailRecipients, mailtoHref } from '@/features/kouture/lib/email';
import { clientHistories } from '@/features/kouture/lib/insights';
import type { Appointment } from '@/server/data/types';

const NOW = new Date('2026-11-28T15:00:00Z');
const today = '2026-11-28';
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const client = (id: string, over = {}) => ({
  id,
  fullName: id,
  email: `${id}@example.com`,
  birthday: null as string | null,
  emailMarketingConsentAt: '2026-01-01T00:00:00Z' as string | null,
  emailOptedOutAt: null as string | null,
  ...over
});
const visit = (clientId: string, days: number): Appointment => ({
  id: `${clientId}${days}`,
  clientId,
  clientName: clientId,
  serviceName: 'Fill',
  startsAt: daysAgo(days),
  endsAt: daysAgo(days),
  status: 'completed',
  priceCents: 5500,
  depositCents: 0,
  source: 'nailzy'
});

describe('email audience', () => {
  const clients = [
    client('ava'),
    client('bea', { emailMarketingConsentAt: null }),
    client('cam', { emailOptedOutAt: '2026-06-01T00:00:00Z' }),
    client('dee', { email: 'not-an-email' }),
    client('eve', { birthday: '1990-12-05' }),
    client('fay')
  ];
  const histories = clientHistories([visit('ava', 25), visit('fay', 60)], [], NOW);

  it('only ever includes clients who agreed and have a valid email', () => {
    expect(emailRecipients('all', clients, histories, NOW, today).map((c) => c.id)).toEqual([
      'ava',
      'eve',
      'fay'
    ]);
  });

  it('narrows to due, slipping and birthday groups', () => {
    expect(emailRecipients('due', clients, histories, NOW, today).map((c) => c.id)).toEqual([
      'ava'
    ]);
    expect(emailRecipients('lapsed', clients, histories, NOW, today).map((c) => c.id)).toEqual([
      'fay'
    ]);
    expect(emailRecipients('birthdays', clients, histories, NOW, today).map((c) => c.id)).toEqual([
      'eve'
    ]);
  });
});

describe('composing and sending', () => {
  it('fills the booking link and always adds address and unsubscribe', () => {
    const { subject, text } = composeEmail(
      { subject: ' Hi ', body: 'Book: {booking_link}' },
      {
        name: 'Kouture Nail Bar',
        postalAddress: '1 Main St, City, ST 00000',
        bookingUrl: 'https://x.test/book'
      }
    );
    expect(subject).toBe('Hi');
    expect(text).toContain('Book: https://x.test/book');
    expect(text).toContain('Kouture Nail Bar · 1 Main St, City, ST 00000');
    expect(text).toContain('Reply UNSUBSCRIBE');
  });

  it('puts the owner in To and clients only in BCC', () => {
    const href = mailtoHref(
      'me@example.com',
      ['a@x.com', 'b@x.com'],
      'Hi & hello',
      'Line 1\nLine 2'
    );
    expect(href.startsWith('mailto:me%40example.com?bcc=a%40x.com%2Cb%40x.com&')).toBe(true);
    expect(href).toContain('subject=Hi%20%26%20hello');
    expect(href).toContain('body=Line%201%0ALine%202');
  });
});
