import type { Metadata } from 'next';
import Link from 'next/link';

import { Icons } from '@/components/icons';
import { CopyButton } from '@/components/lux/copy-button';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { StatCard } from '@/components/lux/stat-card';
import { BUSINESS } from '@/config/business';
import { clientConsent } from '@/features/kouture/lib/consent';
import {
  type RetentionBucket,
  birthdaysWithin,
  clientHistories,
  retentionList
} from '@/features/kouture/lib/insights';
import { loadBusiness } from '@/features/kouture/server/load-business';
import { todayKey } from '@/lib/dates';
import { readEnv } from '@/server/env';
import type { RowOf } from '@/server/entities/definitions';
import { requestNow, requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Client retention' };

const BUCKETS: Record<RetentionBucket, { title: string; eyebrow: string; empty: string }> = {
  due: {
    title: 'Due for their next set',
    eyebrow: 'Past their usual rhythm',
    empty: 'Nobody is overdue. Everyone’s rebooked or recently in.'
  },
  lapsed: {
    title: 'Slipping away',
    eyebrow: '6+ weeks, nothing booked',
    empty: 'No lapsed clients right now.'
  },
  lost: {
    title: 'Win back',
    eyebrow: '4+ months since a visit',
    empty: 'No long-lost clients.'
  }
};

function firstName(fullName: string) {
  return fullName.split(/\s+/)[0];
}

function message(bucket: RetentionBucket | 'birthday', name: string, link: string) {
  const first = firstName(name);
  switch (bucket) {
    case 'due':
      return `Hi ${first}! Your nails are probably ready for some love 💅 Grab your next spot here: ${link} Reply STOP to opt out.`;
    case 'lapsed':
      return `Hi ${first}, it’s been a minute and I miss you at Kouture! Book your next set here: ${link} Reply STOP to opt out.`;
    case 'lost':
      return `Hi ${first}! Kouture misses you. If you’d like to come back, I’d love to have you: ${link} Reply STOP to opt out.`;
    case 'birthday':
      return `Happy almost-birthday, ${first}! 🎂 Treat yourself to a birthday set: ${link} Reply STOP to opt out.`;
  }
}

/** sms: link that opens Messages with the text filled in. The owner sends it herself. */
function smsHref(phone: string, body: string) {
  return `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(body)}`;
}

type Client = RowOf<'kouture.clients'>;

function OutreachRow({
  client,
  detail,
  kind,
  link
}: {
  client: Client | undefined;
  detail: string;
  kind: RetentionBucket | 'birthday';
  link: string;
}) {
  if (!client) return null;
  const canText = clientConsent(client).sms === 'subscribed' && client.phone;
  return (
    <li className='flex items-center gap-3 py-2.5'>
      <div className='min-w-0 flex-1'>
        <Link
          href={`/kouture/clients/${client.id}`}
          className='hover:text-rose truncate text-sm font-medium hover:underline'
        >
          {client.fullName}
        </Link>
        <p className='text-muted-foreground truncate text-xs'>{detail}</p>
      </div>
      {canText ? (
        <div className='flex shrink-0 items-center gap-1'>
          {/* For Google Voice: copy, then paste into a text to their number. */}
          <CopyButton
            text={message(kind, client.fullName, link)}
            label='Copy'
            done={`Message copied. Paste it into Google Voice for ${client.phone}.`}
            ariaLabel={`Copy message for ${client.fullName}`}
          />
          <a
            href={smsHref(client.phone as string, message(kind, client.fullName, link))}
            className='border-rose/40 text-rose hover:bg-blush inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium'
          >
            <Icons.chat className='size-3.5' aria-hidden />
            Text
          </a>
        </div>
      ) : (
        <span
          className='text-muted-foreground shrink-0 text-xs'
          title='Record consent on their profile before sending marketing texts'
        >
          No text consent
        </span>
      )}
    </li>
  );
}

export default async function RetentionPage() {
  const session = await requireOwnerPage();
  const tz = session.profile.timezone;
  const now = requestNow();
  const data = await loadBusiness(session);
  const histories = clientHistories(data.appointments, data.payments, now);
  const entries = retentionList(data.clients, histories, now);
  const byId = new Map(data.clients.map((c) => [c.id, c]));
  const birthdays = birthdaysWithin(data.clients, todayKey(tz, now), 30);
  const link = readEnv().NAILZY_BOOKING_URL ?? BUSINESS.nailzyBookingUrl;

  const counts = { due: 0, lapsed: 0, lost: 0 };
  for (const e of entries) counts[e.bucket]++;

  return (
    <PageContainer
      eyebrow='Kouture · Growth'
      pageTitle='Client retention'
      pageDescription='Who to reach out to this week. “Text” opens your phone’s Messages with a note ready; “Copy” copies it so you can paste it into Google Voice. You review and send it yourself.'
    >
      <div className='grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4'>
        <StatCard label='Due now' icon='clock' value={String(counts.due)} />
        <StatCard label='Slipping away' icon='warning' value={String(counts.lapsed)} />
        <StatCard label='To win back' icon='retention' value={String(counts.lost)} />
        <StatCard
          label='Birthdays'
          icon='sparkles'
          value={String(birthdays.length)}
          hint='next 30 days'
        />
      </div>

      <div className='mt-5 grid gap-5 lg:grid-cols-2'>
        {(Object.keys(BUCKETS) as RetentionBucket[]).map((bucket) => {
          const list = entries.filter((e) => e.bucket === bucket);
          return (
            <SectionCard
              key={bucket}
              title={BUCKETS[bucket].title}
              eyebrow={BUCKETS[bucket].eyebrow}
            >
              {list.length === 0 ? (
                <EmptyNote>{BUCKETS[bucket].empty}</EmptyNote>
              ) : (
                <ul className='divide-border/60 divide-y'>
                  {list.map((e) => (
                    <OutreachRow
                      key={e.clientId}
                      client={byId.get(e.clientId)}
                      link={link}
                      kind={bucket}
                      detail={`${e.daysSince} days since ${e.lastService?.split(/\s+[—–-]\s+|,/)[0] ?? 'last visit'}`}
                    />
                  ))}
                </ul>
              )}
            </SectionCard>
          );
        })}
        <SectionCard title='Birthdays' eyebrow='Next 30 days'>
          {birthdays.length === 0 ? (
            <EmptyNote>No birthdays coming up. Add birthdays on client profiles.</EmptyNote>
          ) : (
            <ul className='divide-border/60 divide-y'>
              {birthdays.map((b) => (
                <OutreachRow
                  key={b.id}
                  client={byId.get(b.id)}
                  link={link}
                  kind='birthday'
                  detail={
                    b.inDays === 0 ? 'Today!' : `In ${b.inDays} day${b.inDays === 1 ? '' : 's'}`
                  }
                />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
      <p className='text-muted-foreground mt-5 text-xs leading-relaxed'>
        Marketing texts only go to clients who agreed to receive them, and every message includes
        “Reply STOP to opt out.” In Phase 5 your Client Relations Manager drafts these for you to
        approve.
      </p>
    </PageContainer>
  );
}
