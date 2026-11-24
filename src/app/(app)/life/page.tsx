import type { Metadata } from 'next';

import PageContainer from '@/components/layout/page-container';
import { GoalsCard } from '@/features/life/components/goals-card';
import { HabitsCard } from '@/features/life/components/habits-card';
import { LifeHero } from '@/features/life/components/life-hero';
import { TasksCard } from '@/features/life/components/tasks-card';
import { WeekStrip } from '@/features/life/components/week-strip';
import { habitCompletionToday } from '@/features/life/lib/summary';
import { loadLifeDashboard } from '@/features/life/server/load-dashboard';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'My Life' };

export default async function LifeDashboardPage() {
  const session = await requireOwnerPage();
  const data = await loadLifeDashboard(session);
  const habitsDone = Math.round(habitCompletionToday(data.habits) * data.habits.length);

  return (
    <PageContainer>
      <div className='grid gap-5 lg:grid-cols-12'>
        <div className='lg:col-span-12'>
          <LifeHero
            name={session.profile.displayName}
            today={data.today}
            greeting={data.greeting}
            tasksDueToday={
              data.tasks.filter(
                (t) => t.status === 'open' && t.dueOn !== null && t.dueOn <= data.today
              ).length
            }
            habitsDone={habitsDone}
            habitsTotal={data.habits.length}
            salonBookingsToday={data.salonBookingsToday}
          />
        </div>
        <div className='lg:col-span-7'>
          <WeekStrip events={data.events} today={data.today} timeZone={data.timeZone} />
        </div>
        <div className='lg:col-span-5'>
          <TasksCard tasks={data.tasks} today={data.today} />
        </div>
        <div className='lg:col-span-7'>
          <HabitsCard habits={data.habits} />
        </div>
        <div className='lg:col-span-5'>
          <GoalsCard goals={data.goals} />
        </div>
      </div>
    </PageContainer>
  );
}
