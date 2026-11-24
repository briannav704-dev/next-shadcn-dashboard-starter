import type { Metadata } from 'next';

import { AddButton, EntityCheck, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { Pager } from '@/components/lux/pager';
import { SectionCard } from '@/components/lux/section-card';
import { FORMS, MEAL_SLOT_LABEL } from '@/features/life/forms';
import { addDays, daysBetween, formatDayShort, startOfWeek, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Meal planning' };

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

type PageProps = { searchParams: Promise<{ week?: string }> };

export default async function MealsPage({ searchParams }: PageProps) {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const { week: raw } = await searchParams;
  const weekStart = startOfWeek(raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today);
  const days = daysBetween(weekStart, addDays(weekStart, 6));
  const [meals, groceries] = await Promise.all([
    repos.entities('life.meals').list({ range: { field: 'day', gte: weekStart, lte: days[6] } }),
    repos.entities('life.grocery_items').list({ order: [{ field: 'checked' }, { field: 'name' }] })
  ]);
  const fmt = (key: string) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${key}T12:00:00Z`)
    );
  const remaining = groceries.filter((g) => !g.checked).length;

  return (
    <PageContainer
      eyebrow='My Life · Wellness'
      pageTitle='Meal planning'
      pageHeaderAction={
        <div className='flex flex-wrap items-center gap-3'>
          <Pager
            label={`${fmt(weekStart)} – ${fmt(days[6])}`}
            prevHref={`/life/meals?week=${addDays(weekStart, -7)}`}
            nextHref={`/life/meals?week=${addDays(weekStart, 7)}`}
            todayHref='/life/meals'
            isCurrent={weekStart === startOfWeek(today)}
          />
          <AddButton
            entity='life.meals'
            label='Add meal'
            title='Plan a meal'
            fields={FORMS.meal}
            initial={{
              day: today >= weekStart && today <= days[6] ? today : weekStart,
              slot: 'dinner'
            }}
          />
        </div>
      }
    >
      <div className='grid gap-5 xl:grid-cols-12'>
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:col-span-9'>
          {days.map((day) => {
            const dayMeals = meals.filter((m) => m.day === day);
            return (
              <section
                key={day}
                aria-label={day}
                className={cn('lux-card p-4', day === today && 'border-champagne/70 bg-blush/30')}
              >
                <div className='flex items-baseline justify-between'>
                  <h2 className='font-display text-lg'>
                    {formatDayShort(day)}{' '}
                    <span className='text-muted-foreground'>{Number(day.slice(8))}</span>
                  </h2>
                  <AddButton
                    entity='life.meals'
                    variant='ghost'
                    label=''
                    title={`Meal for ${formatDayShort(day)}`}
                    fields={FORMS.meal}
                    initial={{ day, slot: 'dinner' }}
                    className='size-8 px-0'
                  />
                </div>
                <ul className='mt-2 space-y-2'>
                  {SLOTS.map((slot) => {
                    const items = dayMeals.filter((m) => m.slot === slot);
                    if (items.length === 0 && slot === 'snack') return null;
                    return (
                      <li key={slot}>
                        <p className='text-gold-ink text-[0.6rem] font-medium tracking-[0.18em] uppercase'>
                          {MEAL_SLOT_LABEL[slot]}
                        </p>
                        {items.length === 0 ? (
                          <p className='text-muted-foreground/70 text-xs italic'>—</p>
                        ) : (
                          items.map((m) => (
                            <div key={m.id} className='flex items-center justify-between gap-1'>
                              <span className='text-sm'>{m.title}</span>
                              <RowActions
                                entity='life.meals'
                                id={m.id}
                                label={m.title}
                                fields={FORMS.meal}
                                values={m}
                              />
                            </div>
                          ))
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
        <div className='xl:col-span-3'>
          <SectionCard
            title='Grocery list'
            eyebrow={`${remaining} to buy`}
            action={
              <AddButton
                entity='life.grocery_items'
                variant='ghost'
                label='Add'
                title='Add to list'
                fields={FORMS.grocery}
              />
            }
          >
            {groceries.length === 0 ? (
              <EmptyNote>Your list is empty.</EmptyNote>
            ) : (
              <ul className='space-y-1.5'>
                {groceries.map((g) => (
                  <li key={g.id} className='flex items-center gap-2.5'>
                    <EntityCheck
                      entity='life.grocery_items'
                      id={g.id}
                      field='checked'
                      checked={g.checked}
                      label={g.name}
                    />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm',
                        g.checked && 'text-muted-foreground line-through'
                      )}
                    >
                      {g.name}
                    </span>
                    {g.quantity && (
                      <span className='text-muted-foreground text-xs'>{g.quantity}</span>
                    )}
                    <RowActions
                      entity='life.grocery_items'
                      id={g.id}
                      label={g.name}
                      fields={FORMS.grocery}
                      values={g}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
