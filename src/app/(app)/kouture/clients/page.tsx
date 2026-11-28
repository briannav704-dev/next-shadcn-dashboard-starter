import type { Metadata } from 'next';
import Link from 'next/link';

import { AddButton } from '@/components/entity/entity-controls';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { SegmentLinks } from '@/components/lux/segment-links';
import { StatCard } from '@/components/lux/stat-card';
import { FORMS } from '@/features/kouture/forms';
import { clientConsent } from '@/features/kouture/lib/consent';
import { daysAgoLabel } from '@/features/kouture/lib/format';
import { clientHistories, rebookRate } from '@/features/kouture/lib/insights';
import { loadBusiness } from '@/features/kouture/server/load-business';
import { startOfDayInZone, startOfMonth, todayKey } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { requestNow, requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Clients' };

type PageProps = { searchParams: Promise<{ q?: string; show?: string }> };

const SHOW = ['all', 'regulars', 'new', 'texts'] as const;
type Show = (typeof SHOW)[number];

export default async function ClientsPage({ searchParams }: PageProps) {
  const session = await requireOwnerPage();
  const tz = session.profile.timezone;
  const now = requestNow();
  const { q: rawQ, show: rawShow } = await searchParams;
  const q = (rawQ ?? '').trim().slice(0, 80);
  const show: Show = SHOW.includes(rawShow as Show) ? (rawShow as Show) : 'all';

  const data = await loadBusiness(session);
  const histories = clientHistories(data.appointments, data.payments, now);
  const monthStart = startOfDayInZone(startOfMonth(todayKey(tz, now)), tz).getTime();

  const rows = data.clients.map((c) => ({
    client: c,
    history: histories.get(c.id),
    consent: clientConsent(c),
    isNew: Date.parse(c.createdAt) >= monthStart
  }));
  const counts = {
    all: rows.length,
    regulars: rows.filter((r) => (r.history?.visits ?? 0) >= 3).length,
    new: rows.filter((r) => r.isNew).length,
    texts: rows.filter((r) => r.consent.sms === 'subscribed').length
  };
  const needle = q.toLowerCase();
  const shown = rows
    .filter((r) =>
      show === 'regulars'
        ? (r.history?.visits ?? 0) >= 3
        : show === 'new'
          ? r.isNew
          : show === 'texts'
            ? r.consent.sms === 'subscribed'
            : true
    )
    .filter(
      (r) =>
        !needle ||
        r.client.fullName.toLowerCase().includes(needle) ||
        r.client.phone?.includes(needle) ||
        r.client.email?.toLowerCase().includes(needle) ||
        r.client.instagram?.toLowerCase().includes(needle)
    );
  const totalSpend = rows.reduce((s, r) => s + (r.history?.spendCents ?? 0), 0);
  const paying = rows.filter((r) => (r.history?.spendCents ?? 0) > 0).length;
  const href = (next: Partial<{ q: string; show: string }>) => {
    const params = new URLSearchParams();
    const nq = next.q ?? q;
    const ns = next.show ?? show;
    if (nq) params.set('q', nq);
    if (ns !== 'all') params.set('show', ns);
    const s = params.toString();
    return `/kouture/clients${s ? `?${s}` : ''}`;
  };

  return (
    <PageContainer
      eyebrow='Kouture · Salon'
      pageTitle='Clients'
      pageDescription='Everyone who sits in your chair, with their history, preferences and consent.'
      pageHeaderAction={
        <div className='flex flex-wrap items-center gap-2'>
          <a
            href='/kouture/clients/export?channel=sms'
            download
            className='border-input hover:bg-blush/60 inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium'
          >
            <Icons.download className='size-4' aria-hidden />
            Text list
          </a>
          <a
            href='/kouture/clients/export?channel=email'
            download
            className='border-input hover:bg-blush/60 inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium'
          >
            <Icons.download className='size-4' aria-hidden />
            Email list
          </a>
          <AddButton
            entity='kouture.clients'
            label='Add client'
            title='New client'
            fields={FORMS.client}
          />
        </div>
      }
    >
      <div className='grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4'>
        <StatCard
          label='Clients'
          icon='teams'
          value={String(counts.all)}
          hint={`${counts.new} new this month`}
        />
        <StatCard label='Regulars' icon='heart' value={String(counts.regulars)} hint='3+ visits' />
        <StatCard
          label='Average lifetime spend'
          icon='cash'
          value={formatCents(paying ? totalSpend / paying : 0, { whole: true })}
        />
        <StatCard
          label='Rebooked'
          icon='calendarEvent'
          value={`${Math.round(rebookRate(histories, now) * 100)}%`}
          hint='seen in 60 days, next visit booked'
        />
      </div>

      <SectionCard
        className='mt-5'
        title={q ? `Results for “${q}”` : 'Client list'}
        eyebrow={`${shown.length} shown`}
      >
        <div className='mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
          <form action='/kouture/clients' className='relative md:w-80' role='search'>
            {show !== 'all' && <input type='hidden' name='show' value={show} />}
            <Icons.search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
            <input
              type='search'
              name='q'
              defaultValue={q}
              placeholder='Search name, phone, email, Instagram'
              aria-label='Search clients'
              className='border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-11 w-full rounded-full border pr-4 pl-9 text-base outline-none focus-visible:ring-3 md:text-sm'
            />
          </form>
          <div className='overflow-x-auto'>
            <SegmentLinks
              label='Filter clients'
              current={show}
              items={[
                { value: 'all', label: 'All', href: href({ show: 'all' }), count: counts.all },
                {
                  value: 'regulars',
                  label: 'Regulars',
                  href: href({ show: 'regulars' }),
                  count: counts.regulars
                },
                { value: 'new', label: 'New', href: href({ show: 'new' }), count: counts.new },
                {
                  value: 'texts',
                  label: 'Texts OK',
                  href: href({ show: 'texts' }),
                  count: counts.texts
                }
              ]}
            />
          </div>
        </div>

        {shown.length === 0 ? (
          <EmptyNote>{q ? 'No clients match that search.' : 'No clients here yet.'}</EmptyNote>
        ) : (
          <ul className='divide-border/60 divide-y'>
            {shown.map(({ client, history, consent }) => (
              <li key={client.id}>
                <Link
                  href={`/kouture/clients/${client.id}`}
                  className='hover:bg-blush/40 -mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors'
                >
                  <span className='bg-blush text-rose font-display grid size-10 shrink-0 place-items-center rounded-full text-lg'>
                    {client.fullName.slice(0, 1)}
                  </span>
                  <div className='min-w-0 flex-1'>
                    <p className='flex items-center gap-1.5 truncate text-sm font-medium'>
                      {client.fullName}
                      {client.allergies && (
                        <Icons.warning
                          className='text-destructive size-3.5 shrink-0'
                          aria-label='Has allergies noted'
                        />
                      )}
                    </p>
                    <p className='text-muted-foreground truncate text-xs'>
                      {history?.lastVisit
                        ? `Last visit ${daysAgoLabel(history.lastVisit, now)}`
                        : 'No visits yet'}
                      {history?.nextVisit && ' · booked ahead'}
                    </p>
                  </div>
                  <div className='hidden shrink-0 text-right sm:block'>
                    <p className='text-sm tabular-nums'>
                      {formatCents(history?.spendCents ?? 0, { whole: true })}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {history?.visits ?? 0} {history?.visits === 1 ? 'visit' : 'visits'}
                    </p>
                  </div>
                  <div className='flex shrink-0 gap-1' aria-label='Marketing consent'>
                    {(['sms', 'email'] as const).map((ch) => (
                      <span
                        key={ch}
                        title={`${ch === 'sms' ? 'Texts' : 'Emails'}: ${consent[ch]}`}
                        className={cn(
                          'grid size-7 place-items-center rounded-full',
                          consent[ch] === 'subscribed'
                            ? 'bg-success/12 text-success'
                            : consent[ch] === 'opted_out'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-muted text-muted-foreground/60'
                        )}
                      >
                        {ch === 'sms' ? (
                          <Icons.phone className='size-3.5' />
                        ) : (
                          <Icons.mail className='size-3.5' />
                        )}
                        <span className='sr-only'>
                          {ch === 'sms' ? 'Texts' : 'Emails'} {consent[ch].replace('_', ' ')}
                        </span>
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  );
}
