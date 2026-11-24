import type { Metadata } from 'next';

import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { StatCard } from '@/components/lux/stat-card';
import { StackedBars } from '@/features/kouture/components/stacked-bars';
import {
  bookingsByWeekday,
  clientHistories,
  monthLabel,
  newVsReturning,
  rebookRate,
  topServices
} from '@/features/kouture/lib/insights';
import { loadBusiness } from '@/features/kouture/server/load-business';
import { shiftMonth } from '@/features/life/lib/modules';
import { startOfMonth, todayKey } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { requestNow, requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Analytics' };

const DAY_MS = 86_400_000;

export default async function AnalyticsPage() {
  const session = await requireOwnerPage();
  const tz = session.profile.timezone;
  const now = requestNow();
  const data = await loadBusiness(session);
  const recentFrom = new Date(now.getTime() - 90 * DAY_MS).toISOString();
  const nowIso = now.toISOString();
  const recent = data.appointments.filter((a) => a.startsAt >= recentFrom && a.startsAt <= nowIso);
  const completed = recent.filter((a) => a.status === 'completed');
  const settled = recent.filter((a) => a.status === 'completed' || a.status === 'no_show');
  const histories = clientHistories(data.appointments, data.payments, now);
  const current = startOfMonth(todayKey(tz, now));
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(current, i - 5));
  const services = topServices(recent);
  const topRevenue = services[0]?.revenueCents ?? 0;
  const tips = data.payments
    .filter((p) => p.kind === 'tip' && p.receivedAt >= recentFrom)
    .reduce((s, p) => s + p.amountCents, 0);
  const serviceRevenue = completed.reduce((s, a) => s + a.priceCents, 0);

  return (
    <PageContainer
      eyebrow='Kouture · Money'
      pageTitle='Analytics'
      pageDescription='How the chair is performing over the last 90 days.'
    >
      <div className='grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4'>
        <StatCard
          label='Average ticket'
          icon='receipt'
          value={formatCents(completed.length ? serviceRevenue / completed.length : 0, {
            whole: true
          })}
          hint={`${completed.length} visits`}
        />
        <StatCard
          label='Tip rate'
          icon='heart'
          value={serviceRevenue ? `${Math.round((tips / serviceRevenue) * 100)}%` : '—'}
          hint='of service value'
        />
        <StatCard
          label='Rebooked'
          icon='calendarEvent'
          value={`${Math.round(rebookRate(histories, now) * 100)}%`}
          hint='left with a next visit'
        />
        <StatCard
          label='No-shows'
          icon='warning'
          value={
            settled.length
              ? `${Math.round((settled.filter((a) => a.status === 'no_show').length / settled.length) * 100)}%`
              : '—'
          }
          hint='of finished bookings'
        />
      </div>

      <div className='mt-5 grid gap-5 lg:grid-cols-12'>
        <div className='lg:col-span-7'>
          <SectionCard title='Top services' eyebrow='By revenue'>
            {services.length === 0 ? (
              <EmptyNote>Completed visits will rank your services here.</EmptyNote>
            ) : (
              <ul className='space-y-3.5'>
                {services.map((s) => (
                  <li key={s.name}>
                    <div className='flex items-baseline justify-between gap-3 text-sm'>
                      <span className='truncate'>{s.name}</span>
                      <span className='shrink-0 tabular-nums'>
                        {formatCents(s.revenueCents, { whole: true })}
                        <span className='text-muted-foreground ml-1.5 text-xs'>· {s.count}</span>
                      </span>
                    </div>
                    <div className='bg-blush mt-1.5 h-2 overflow-hidden rounded-full' aria-hidden>
                      <div
                        className='h-full rounded-full'
                        style={{
                          width: `${(s.revenueCents / topRevenue) * 100}%`,
                          background: 'var(--chart-1)'
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
        <div className='lg:col-span-5'>
          <SectionCard title='Busiest days' eyebrow='Bookings by weekday'>
            <StackedBars
              caption='Bookings by weekday, last 90 days'
              series={[{ key: 'count', label: 'Bookings' }]}
              data={bookingsByWeekday(recent, tz).map((d) => ({ label: d.day, count: d.count }))}
              height='h-48'
            />
          </SectionCard>
        </div>
        <div className='lg:col-span-12'>
          <SectionCard title='New and returning clients' eyebrow='Last 6 months'>
            <StackedBars
              caption='New and returning clients by month'
              series={[
                { key: 'returning', label: 'Returning' },
                { key: 'newClients', label: 'New' }
              ]}
              data={newVsReturning(months, data.appointments, tz).map((m) => ({
                label: monthLabel(m.month),
                returning: m.returning,
                newClients: m.newClients
              }))}
            />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
