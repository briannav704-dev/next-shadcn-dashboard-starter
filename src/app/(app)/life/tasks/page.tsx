import type { Metadata } from 'next';

import { AddButton } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { SectionCard } from '@/components/lux/section-card';
import { FORMS } from '@/features/life/forms';
import { TaskList } from '@/features/life/modules/task-list';
import { addDays, todayKey } from '@/lib/dates';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Tasks' };

export default async function TasksPage() {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const tasks = repos.entities('life.tasks');
  const [open, done] = await Promise.all([
    tasks.list({ eq: { status: 'open' }, order: [{ field: 'dueOn' }] }),
    tasks.list({
      eq: { status: 'done' },
      order: [{ field: 'completedAt', ascending: false }],
      limit: 15
    })
  ]);
  const weekEnd = addDays(today, 7);
  const groups = [
    { title: 'Overdue', items: open.filter((t) => t.dueOn && t.dueOn < today) },
    { title: 'Today', items: open.filter((t) => t.dueOn === today) },
    {
      title: 'This week',
      items: open.filter((t) => t.dueOn && t.dueOn > today && t.dueOn <= weekEnd)
    },
    { title: 'Later', items: open.filter((t) => t.dueOn && t.dueOn > weekEnd) },
    { title: 'Someday', items: open.filter((t) => !t.dueOn) }
  ].filter((g) => g.items.length > 0);

  return (
    <PageContainer
      eyebrow='My Life'
      pageTitle='Tasks'
      pageDescription={`${open.length} open · tap the circle to complete`}
      pageHeaderAction={
        <AddButton
          entity='life.tasks'
          label='New task'
          title='New task'
          fields={FORMS.task}
          initial={{ dueOn: today, priority: 'normal' }}
        />
      }
    >
      <div className='grid gap-5 lg:grid-cols-12'>
        <div className='flex flex-col gap-5 lg:col-span-8'>
          {groups.length === 0 ? (
            <SectionCard title='All clear' eyebrow='Open'>
              <TaskList
                tasks={[]}
                today={today}
                empty='Nothing open. Add something when inspiration strikes.'
              />
            </SectionCard>
          ) : (
            groups.map((g) => (
              <SectionCard key={g.title} title={g.title} eyebrow={`${g.items.length} open`}>
                <TaskList tasks={g.items} today={today} empty='' />
              </SectionCard>
            ))
          )}
        </div>
        <div className='lg:col-span-4'>
          <SectionCard title='Recently done' eyebrow='Wins'>
            <TaskList tasks={done} today={today} empty='Completed tasks will show here.' />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
