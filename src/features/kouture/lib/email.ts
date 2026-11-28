import { consentState } from './consent';
import { type ClientHistory, birthdaysWithin, retentionList } from './insights';

// Email campaigns sent from the owner's own mail app. Only clients who agreed
// to marketing email (and haven't opted out since) are ever included, every
// email carries the business's postal address and how to unsubscribe
// (CAN-SPAM), and recipients go in BCC so no one sees anyone else's address.

export type EmailAudience = 'all' | 'due' | 'lapsed' | 'birthdays';

export const AUDIENCE_LABEL: Record<EmailAudience, string> = {
  all: 'Everyone who agreed to emails',
  due: 'Due for their next set',
  lapsed: 'Slipping away (6+ weeks)',
  birthdays: 'Birthdays in the next 30 days'
};

type Client = {
  id: string;
  fullName: string;
  email: string | null;
  birthday: string | null;
  emailMarketingConsentAt: string | null;
  emailOptedOutAt: string | null;
};

export function emailRecipients(
  audience: EmailAudience,
  clients: Client[],
  histories: Map<string, ClientHistory>,
  now: Date,
  today: string
): Client[] {
  const reachable = clients.filter(
    (c) =>
      c.email &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) &&
      consentState(c.emailMarketingConsentAt, c.emailOptedOutAt) === 'subscribed'
  );
  if (audience === 'all') return reachable;
  if (audience === 'birthdays') {
    const ids = new Set(birthdaysWithin(reachable, today, 30).map((c) => c.id));
    return reachable.filter((c) => ids.has(c.id));
  }
  const buckets = audience === 'due' ? ['due'] : ['lapsed', 'lost'];
  const ids = new Set(
    retentionList(reachable, histories, now)
      .filter((r) => buckets.includes(r.bucket))
      .map((r) => r.clientId)
  );
  return reachable.filter((c) => ids.has(c.id));
}

export function composeEmail(
  campaign: { subject: string; body: string },
  business: { name: string; postalAddress: string | null; bookingUrl: string }
): { subject: string; text: string } {
  const body = campaign.body.replaceAll('{booking_link}', business.bookingUrl).trim();
  const footer = [
    '—',
    `${business.name}${business.postalAddress ? ` · ${business.postalAddress}` : ''}`,
    'You’re getting this because you asked for Kouture updates. Reply UNSUBSCRIBE and I’ll take you off the list.'
  ].join('\n');
  return { subject: campaign.subject.trim(), text: `${body}\n\n${footer}` };
}

/** Opens the owner's mail app with herself in To and clients in BCC. */
export function mailtoHref(to: string, bcc: string[], subject: string, text: string): string {
  const params = [
    bcc.length ? `bcc=${encodeURIComponent(bcc.join(','))}` : '',
    `subject=${encodeURIComponent(subject)}`,
    `body=${encodeURIComponent(text)}`
  ].filter(Boolean);
  return `mailto:${encodeURIComponent(to)}?${params.join('&')}`;
}

export type EmailTemplate = {
  id: string;
  title: string;
  subject: string;
  body: string;
  audience: EmailAudience;
};

// Short, personal and specific beats long and salesy for a one-chair salon.
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'winback',
    title: 'We miss you',
    subject: 'Your nails miss me 💅',
    body: 'Hi love,\n\nIt’s been a little while and I’d love to see you back in my chair. Whether it’s a fresh full set or a quick fill, I’ve saved a few spots this month just for returning clients.\n\nBook here: {booking_link}\n\nSee you soon,\nKouture',
    audience: 'lapsed'
  },
  {
    id: 'due',
    title: 'Time for a fill',
    subject: 'Fill time? I’ve got you',
    body: 'Hi love,\n\nBy now your set is probably ready for some love. Grab a fill before the grow-out shows.\n\nBook here: {booking_link}\n\nKouture',
    audience: 'due'
  },
  {
    id: 'holiday',
    title: 'Holiday sets',
    subject: 'Holiday nails are booking up ✨',
    body: 'Hi love,\n\nHoliday season is here and my calendar is filling fast. Chrome, glitter, classic red: let’s make your hands the best accessory at every party.\n\nBook your holiday set: {booking_link}\n\nKouture',
    audience: 'all'
  },
  {
    id: 'openings',
    title: 'Openings this week',
    subject: 'A few openings this week',
    body: 'Hi love,\n\nI just had a few spots open up this week. If you’ve been wanting a refresh, now’s your chance.\n\nGrab one here: {booking_link}\n\nKouture',
    audience: 'all'
  },
  {
    id: 'birthday',
    title: 'Birthday treat',
    subject: 'Happy birthday from Kouture 🎂',
    body: 'Hi love,\n\nYour birthday is coming up and you deserve a birthday set! Treat yourself to something special this month.\n\nBook here: {booking_link}\n\nWith love,\nKouture',
    audience: 'birthdays'
  }
];
