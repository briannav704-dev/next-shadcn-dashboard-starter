import type { Metadata } from 'next';

import PageContainer from '@/components/layout/page-container';
import { StatCard } from '@/components/lux/stat-card';
import { ApprovalsPreview } from '@/features/core/components/approvals-preview';
import { ClientsCard } from '@/features/kouture/components/clients-card';
import { MoneyMix } from '@/features/kouture/components/money-mix';
import { RevenueChart } from '@/features/kouture/components/revenue-chart';
import { TodayAppointments } from '@/features/kouture/components/today-appointments';
import { loadKoutureDashboard } from '@/features/kouture/server/load-dashboard';
import { formatDayLong } from '@/lib/dates';
import { formatCents, percentChange } from '@/lib/money';
import { BUSINESS } from '@/config/business';
import { readEnv } from '@/server/env';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Kouture Nail Bar' };

export default async function KoutureDashboardPage() {
  const session = await requireOwnerPage();
  const [data, pending] = await Promise.all([
    loadKoutureDashboard(session),
    session.repos.core.listApprovals({ status: 'pending', limit: 5 })
  ]);
  const kouturePending = pending.filter((a) => a.domain === 'kouture');

  return (
    <PageContainer
      eyebrow={formatDayLong(data.today)}
      pageTitle={session.profile.businessName}
      pageDescription='Your salon at a glance: today’s clients, money in, and what your team needs from you.'
    >
      <div className='grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4'>
        <StatCard
          label='Revenue this month'
          icon='cash'
          value={formatCents(data.monthToDate.revenueCents, { whole: true })}
          delta={percentChange(
            data.monthToDate.revenueCents,
            data.previousMonthToDate.revenueCents
          )}
          hint='vs. same point last month'
        />
        <StatCard
          label='Profit this month'
          icon='trendingUp'
          value={formatCents(data.monthToDate.profitCents, { whole: true })}
          hint={`after ${formatCents(data.monthToDate.expenseCents, { whole: true })} expenses`}
        />
        <StatCard
          label='Average ticket'
          icon='receipt'
          value={formatCents(data.averageTicketCents, { whole: true })}
          hint='completed services this month'
        />
        <StatCard
          label='Booked next 7 days'
          icon='calendarEvent'
          value={String(data.bookedNext7)}
          hint={`${Math.round(data.noShowRate30 * 100)}% no-show rate (30 days)`}
        />
      </div>

      <div className='mt-5 grid gap-5 lg:grid-cols-12'>
        <div className='lg:col-span-7'>
          <TodayAppointments
            today={data.todayAppointments}
            upcoming={data.upcoming}
            timeZone={data.timeZone}
            bookingUrl={readEnv().NAILZY_BOOKING_URL ?? BUSINESS.nailzyBookingUrl}
          />
        </div>
        <div className='flex flex-col gap-5 lg:col-span-5'>
          <ApprovalsPreview approvals={kouturePending} />
          <ClientsCard stats={data.clients} />
        </div>
        <div className='lg:col-span-7'>
          <RevenueChart series={data.revenueSeries} />
        </div>
        <div className='lg:col-span-5'>
          <MoneyMix
            mix={data.mix}
            expenses={data.expenseByCategory}
            expenseTotal={data.monthToDate.expenseCents}
          />
        </div>
      </div>
    </PageContainer>
  );
}
