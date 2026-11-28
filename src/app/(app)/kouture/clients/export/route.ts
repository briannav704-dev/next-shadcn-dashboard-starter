import { consentState } from '@/features/kouture/lib/consent';
import { toE164 } from '@/features/kouture/lib/sms';
import { getOwnerSession } from '@/server/session';

// Clients who agreed to marketing on a channel, for importing into a texting or
// email app. Owner-only and never cached: this is personal client data.
export const dynamic = 'force-dynamic';

function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const session = await getOwnerSession();
  if (!session) return new Response('Sign in required', { status: 401 });
  const channel = new URL(request.url).searchParams.get('channel') === 'email' ? 'email' : 'sms';

  const clients = await session.repos
    .entities('kouture.clients')
    .list({ order: [{ field: 'fullName' }] });
  const rows = clients
    .filter((c) =>
      channel === 'sms'
        ? consentState(c.smsMarketingConsentAt, c.smsOptedOutAt) === 'subscribed' && toE164(c.phone)
        : consentState(c.emailMarketingConsentAt, c.emailOptedOutAt) === 'subscribed' && c.email
    )
    .map((c) => {
      const [first, ...rest] = c.fullName.split(/\s+/);
      return channel === 'sms'
        ? [
            first,
            rest.join(' '),
            toE164(c.phone) as string,
            (c.smsMarketingConsentAt ?? '').slice(0, 10)
          ]
        : [
            first,
            rest.join(' '),
            c.email as string,
            (c.emailMarketingConsentAt ?? '').slice(0, 10)
          ];
    });
  const header = ['First name', 'Last name', channel === 'sms' ? 'Phone' : 'Email', 'Consent date'];
  const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  return new Response(`${csv}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="kouture-${channel === 'sms' ? 'text' : 'email'}-list.csv"`,
      'cache-control': 'private, no-store'
    }
  });
}
