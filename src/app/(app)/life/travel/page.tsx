import type { Metadata } from 'next';
import Link from 'next/link';

import { AddButton, EntityCheck, RowActions } from '@/components/entity/entity-controls';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { FORMS, TRIP_ITEM_LABEL } from '@/features/life/forms';
import { tripSummary } from '@/features/life/lib/modules';
import { todayKey } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Travel' };

const KIND_ORDER = ['flight', 'stay', 'activity', 'dining', 'packing'] as const;
const fmt = (key: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${key}T12:00:00Z`)
  );

type PageProps = { searchParams: Promise<{ trip?: string }> };

export default async function TravelPage({ searchParams }: PageProps) {
  const { repos, profile } = await requireOwnerPage();
  const today = todayKey(profile.timezone);
  const { trip: selectedId } = await searchParams;
  const [trips, items] = await Promise.all([
    repos.entities('life.trips').list({ order: [{ field: 'startsOn' }] }),
    repos.entities('life.trip_items').list({ order: [{ field: 'onDay' }] })
  ]);
  const upcoming = trips.filter((t) => t.endsOn >= today);
  const past = trips.filter((t) => t.endsOn < today).toReversed();
  const selected = trips.find((t) => t.id === selectedId) ?? upcoming[0] ?? past[0];
  const summary = selected ? tripSummary(selected, items, today) : null;
  const tripItems = selected ? items.filter((i) => i.tripId === selected.id) : [];

  return (
    <PageContainer
      eyebrow='My Life · Dreams'
      pageTitle='Travel'
      pageDescription='Plan it, pack it, live it.'
      pageHeaderAction={
        <AddButton
          entity='life.trips'
          label='New trip'
          title='New trip'
          fields={FORMS.trip}
          initial={{ startsOn: today, endsOn: today, status: 'planning' }}
        />
      }
    >
      {trips.length === 0 && <EmptyNote>Where to next? Add your first trip.</EmptyNote>}
      <div className='grid gap-5 lg:grid-cols-12'>
        <div className='flex flex-col gap-3 lg:col-span-4'>
          {[...upcoming, ...past].map((t) => {
            const s = tripSummary(t, items, today);
            const active = t.id === selected?.id;
            return (
              <Link
                key={t.id}
                href={`/life/travel?trip=${t.id}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'lux-card lux-card-interactive block p-4',
                  active && 'border-champagne/70 bg-blush/40',
                  t.endsOn < today && 'opacity-70'
                )}
              >
                <p className='text-gold-ink text-[0.62rem] font-medium tracking-[0.2em] uppercase'>
                  {s.inProgress
                    ? 'Happening now'
                    : s.daysUntil > 0
                      ? `In ${s.daysUntil} days`
                      : 'Past trip'}
                </p>
                <p className='font-display mt-1 text-xl'>{t.name}</p>
                <p className='text-muted-foreground text-xs'>
                  {t.destination} · {fmt(t.startsOn)} – {fmt(t.endsOn)}
                </p>
              </Link>
            );
          })}
        </div>
        {selected && summary && (
          <div className='flex flex-col gap-5 lg:col-span-8'>
            <section className='lux-card hero-wash p-6' aria-label={selected.name}>
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <p className='text-gold-ink text-xs font-medium tracking-[0.22em] uppercase'>
                    {selected.destination} · {summary.nights} nights · {selected.status}
                  </p>
                  <h2 className='font-display mt-1 text-4xl'>{selected.name}</h2>
                </div>
                <RowActions
                  entity='life.trips'
                  id={selected.id}
                  label={selected.name}
                  fields={FORMS.trip}
                  values={selected}
                />
              </div>
              <dl className='mt-5 grid grid-cols-3 gap-3'>
                <div className='bg-card/70 rounded-xl border p-3 text-center'>
                  <dd className='font-display text-3xl leading-none'>
                    {summary.daysUntil > 0 ? summary.daysUntil : '—'}
                  </dd>
                  <dt className='text-muted-foreground mt-1 text-[0.65rem]'>days to go</dt>
                </div>
                <div className='bg-card/70 rounded-xl border p-3 text-center'>
                  <dd className='font-display text-3xl leading-none'>
                    {formatCents(summary.committedCents, { whole: true })}
                  </dd>
                  <dt className='text-muted-foreground mt-1 text-[0.65rem]'>
                    {selected.budgetCents
                      ? `of ${formatCents(selected.budgetCents, { whole: true })} budget`
                      : 'committed'}
                  </dt>
                </div>
                <div className='bg-card/70 rounded-xl border p-3 text-center'>
                  <dd className='font-display text-3xl leading-none'>
                    {summary.packed}/{summary.packingTotal}
                  </dd>
                  <dt className='text-muted-foreground mt-1 text-[0.65rem]'>packed</dt>
                </div>
              </dl>
              {selected.notes && (
                <p className='text-muted-foreground mt-4 text-sm'>{selected.notes}</p>
              )}
            </section>
            <SectionCard
              title='Itinerary & packing'
              eyebrow={`${tripItems.length} items`}
              action={
                <AddButton
                  entity='life.trip_items'
                  variant='ghost'
                  label='Add'
                  title='Add to trip'
                  fields={FORMS.tripItem}
                  initial={{ kind: 'activity', onDay: selected.startsOn }}
                  fixed={{ tripId: selected.id }}
                />
              }
            >
              {tripItems.length === 0 ? (
                <EmptyNote>Add flights, stays, reservations and your packing list.</EmptyNote>
              ) : (
                <div className='space-y-5'>
                  {KIND_ORDER.map((kind) => {
                    const list = tripItems.filter((i) => i.kind === kind);
                    if (list.length === 0) return null;
                    return (
                      <div key={kind}>
                        <p className='text-gold-ink mb-1.5 text-[0.65rem] font-medium tracking-[0.2em] uppercase'>
                          {TRIP_ITEM_LABEL[kind]}
                        </p>
                        <ul className='space-y-1.5'>
                          {list.map((i) => (
                            <li key={i.id} className='flex items-center gap-2.5'>
                              <EntityCheck
                                entity='life.trip_items'
                                id={i.id}
                                field='done'
                                checked={i.done}
                                label={i.title}
                              />
                              <span
                                className={cn(
                                  'min-w-0 flex-1 truncate text-sm',
                                  i.done &&
                                    kind === 'packing' &&
                                    'text-muted-foreground line-through'
                                )}
                              >
                                {i.title}
                              </span>
                              {i.onDay && (
                                <span className='text-muted-foreground text-xs'>
                                  {fmt(i.onDay)}
                                </span>
                              )}
                              {i.costCents !== null && (
                                <span className='text-xs tabular-nums'>
                                  {formatCents(i.costCents, { whole: true })}
                                </span>
                              )}
                              <RowActions
                                entity='life.trip_items'
                                id={i.id}
                                label={i.title}
                                fields={FORMS.tripItem}
                                values={i}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className='text-muted-foreground mt-4 flex items-center gap-1.5 text-xs'>
                <Icons.info className='size-3.5' aria-hidden /> Tick flights and stays once booked,
                and packing items once they’re in the suitcase.
              </p>
            </SectionCard>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
