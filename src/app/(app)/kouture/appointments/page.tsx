import type { Metadata } from 'next';
import Link from 'next/link';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { SegmentLinks } from '@/components/lux/segment-links';
import { Badge } from '@/components/ui/badge';
import { BUSINESS } from '@/config/business';
import { APPOINTMENT_STATUS_STYLE } from '@/features/kouture/components/appointment-status';
import { CheckoutButton } from '@/features/kouture/components/checkout-button';
import { SyncCard } from '@/features/kouture/components/sync-card';
import { appointmentFields } from '@/features/kouture/forms';
import { calendarFeedSource } from '@/features/kouture/server/nailzy-sync';
import {
  addDays,
  dayKey,
  formatDayLong,
  formatTime,
  relativeDayLabel,
  startOfDayInZone,
  todayKey
} from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { describeAppointments } from '@/server/data/kouture-repository';
import { readEnv } from '@/server/env';
import { requestNow, requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Appointments' };

type PageProps = { searchParams: Promise<{ view?: string }> };

const VIEWS = ['upcoming', 'checkout', 'past'] as const;
type View = (typeof VIEWS)[number];

const open = (status: string) => status === 'booked' || status === 'confirmed';

export default async function AppointmentsPage({ searchParams }: PageProps) {
  const session = await requireOwnerPage();
  const { repos, profile, mode } = session;
  const tz = profile.timezone;
  const { view: rawView } = await searchParams;
  const view: View = VIEWS.includes(rawView as View) ? (rawView as View) : 'upcoming';

  const now = requestNow();
  const today = todayKey(tz, now);
  const from = startOfDayInZone(addDays(today, -45), tz).toISOString();
  const to = startOfDayInZone(addDays(today, 61), tz).toISOString();

  const { entities } = repos;
  const [rows, clients, services, deposits, lastRuns] = await Promise.all([
    entities('kouture.appointments').list({
      range: { field: 'startsAt', gte: from, lt: to },
      order: [{ field: 'startsAt' }]
    }),
    entities('kouture.clients').list({ order: [{ field: 'fullName' }] }),
    entities('kouture.services').list({ order: [{ field: 'name' }] }),
    entities('kouture.payments').list({ eq: { kind: 'deposit' } }),
    entities('kouture.sync_runs').list({ order: [{ field: 'ranAt', ascending: false }], limit: 1 })
  ]);
  const appointments = await describeAppointments(entities, rows, { clients, services });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const depositRecorded = new Set(deposits.map((p) => p.appointmentId));

  const nowIso = now.toISOString();
  const todayEnd = startOfDayInZone(addDays(today, 1), tz).toISOString();
  const needsCheckout = appointments.filter(
    (a) => open(a.status) && a.startsAt < todayEnd && a.startsAt < nowIso
  );
  const lists: Record<View, typeof appointments> = {
    upcoming: appointments.filter((a) => a.endsAt >= nowIso && a.status !== 'cancelled'),
    checkout: needsCheckout.toReversed(),
    past: appointments.filter((a) => a.endsAt < nowIso).toReversed()
  };
  const list = lists[view];
  const groups = new Map<string, typeof list>();
  for (const a of list) {
    const key = dayKey(new Date(a.startsAt), tz);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  const clientOptions = clients.map((c) => ({ value: c.id, label: c.fullName }));
  const serviceOptions = services
    .filter((s) => s.active)
    .map((s) => ({ value: s.id, label: s.name }));
  const fields = appointmentFields(clientOptions, serviceOptions);
  const bookingUrl = readEnv().NAILZY_BOOKING_URL ?? BUSINESS.nailzyBookingUrl;
  const lastRun = lastRuns[0] ?? null;
  const upcomingValue = lists.upcoming.reduce((s, a) => s + a.priceCents, 0);

  return (
    <PageContainer
      eyebrow='Kouture · Salon'
      pageTitle='Appointments'
      pageDescription={`${lists.upcoming.length} booked ahead · ${formatCents(upcomingValue, { whole: true })} on the books`}
      pageHeaderAction={
        <div className='flex flex-wrap items-center gap-2'>
          <a
            href={bookingUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='border-champagne/70 text-gold-ink hover:bg-blush/60 inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors'
          >
            Open Nailzy
          </a>
          <AddButton
            entity='kouture.appointments'
            label='Add'
            title='New appointment'
            fields={fields}
            fixed={{ source: 'manual' }}
            initial={{ status: 'booked' }}
          />
        </div>
      }
    >
      <SyncCard source={calendarFeedSource(mode)} lastRun={lastRun} timeZone={tz} />

      <div className='mt-5 mb-4'>
        <SegmentLinks
          label='Appointment views'
          current={view}
          items={[
            {
              value: 'upcoming',
              label: 'Upcoming',
              href: '/kouture/appointments',
              count: lists.upcoming.length
            },
            {
              value: 'checkout',
              label: 'To check out',
              href: '/kouture/appointments?view=checkout',
              count: lists.checkout.length
            },
            { value: 'past', label: 'Past', href: '/kouture/appointments?view=past' }
          ]}
        />
      </div>

      {groups.size === 0 ? (
        <EmptyNote>
          {view === 'checkout'
            ? 'All caught up — every finished visit is checked out.'
            : view === 'upcoming'
              ? 'Nothing booked yet. New Nailzy bookings appear here after a sync.'
              : 'No past appointments in the last six weeks.'}
        </EmptyNote>
      ) : (
        <div className='flex flex-col gap-5'>
          {[...groups.entries()].map(([day, items]) => (
            <SectionCard
              key={day}
              title={formatDayLong(day)}
              eyebrow={
                day === today
                  ? 'Today'
                  : relativeDayLabel(day, today) === 'Overdue'
                    ? undefined
                    : relativeDayLabel(day, today)
              }
              action={
                <span className='text-muted-foreground text-xs tabular-nums'>
                  {items.length} ·{' '}
                  {formatCents(
                    items.reduce((s, a) => s + (a.status === 'cancelled' ? 0 : a.priceCents), 0),
                    { whole: true }
                  )}
                </span>
              }
            >
              <ul className='divide-border/60 divide-y'>
                {items.map((a) => {
                  const row = byId.get(a.id)!;
                  const status = APPOINTMENT_STATUS_STYLE[a.status];
                  const canCheckout = open(a.status) && a.startsAt < todayEnd;
                  return (
                    <li key={a.id} className='flex flex-wrap items-center gap-x-3 gap-y-2 py-3'>
                      <p className='font-display w-[4.5rem] shrink-0 text-right text-lg leading-none whitespace-nowrap'>
                        {formatTime(a.startsAt, tz)}
                      </p>
                      <span className='bg-champagne/60 h-10 w-px shrink-0' aria-hidden />
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-medium'>
                          {a.clientId ? (
                            <Link
                              href={`/kouture/clients/${a.clientId}`}
                              className='hover:text-rose hover:underline'
                            >
                              {a.clientName}
                            </Link>
                          ) : (
                            a.clientName
                          )}
                          {a.source === 'nailzy' && (
                            <span className='text-gold-ink ml-2 text-[0.6rem] tracking-[0.14em] uppercase'>
                              Nailzy
                            </span>
                          )}
                        </p>
                        <p className='text-muted-foreground truncate text-xs'>{a.serviceName}</p>
                        <p className='text-muted-foreground mt-0.5 text-xs sm:hidden'>
                          {a.priceCents > 0
                            ? formatCents(a.priceCents, { whole: true })
                            : 'Set price'}{' '}
                          · {status.label}
                        </p>
                      </div>
                      <div className='hidden shrink-0 text-right sm:block'>
                        {a.priceCents > 0 ? (
                          <p className='text-sm tabular-nums'>
                            {formatCents(a.priceCents, { whole: true })}
                          </p>
                        ) : (
                          <p className='text-gold-ink text-xs'>Set price</p>
                        )}
                      </div>
                      <Badge
                        className={cn(
                          'hidden shrink-0 rounded-full font-normal sm:inline-flex',
                          status.className
                        )}
                      >
                        {status.label}
                      </Badge>
                      <div className='flex shrink-0 items-center gap-1'>
                        {canCheckout && (
                          <CheckoutButton
                            appointmentId={a.id}
                            clientName={a.clientName}
                            priceCents={a.priceCents}
                            depositCents={a.depositCents}
                            depositRecorded={depositRecorded.has(a.id)}
                          />
                        )}
                        <RowActions
                          entity='kouture.appointments'
                          id={a.id}
                          label={`${a.clientName} ${formatTime(a.startsAt, tz)}`}
                          fields={fields}
                          values={row}
                          extra={[
                            ...(a.status === 'booked'
                              ? [
                                  {
                                    label: 'Mark confirmed',
                                    icon: 'check' as const,
                                    patch: { status: 'confirmed' }
                                  }
                                ]
                              : []),
                            ...(open(a.status) && a.startsAt < nowIso
                              ? [
                                  {
                                    label: 'Mark no-show',
                                    icon: 'circleX' as const,
                                    patch: { status: 'no_show' }
                                  }
                                ]
                              : []),
                            ...(open(a.status)
                              ? [
                                  {
                                    label: 'Mark cancelled',
                                    icon: 'close' as const,
                                    patch: { status: 'cancelled' }
                                  }
                                ]
                              : [])
                          ]}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          ))}
        </div>
      )}
      <p className='text-muted-foreground mt-5 text-xs'>
        Marking a booking here updates Kouture only. To change it for your client, use Nailzy.
      </p>
    </PageContainer>
  );
}
