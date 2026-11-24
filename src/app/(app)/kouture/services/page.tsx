import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { FORMS, SERVICE_CATEGORY_LABEL } from '@/features/kouture/forms';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Service menu' };

function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(' ');
}

export default async function ServicesPage() {
  const { repos } = await requireOwnerPage();
  const services = await repos.entities('kouture.services').list({ order: [{ field: 'name' }] });
  const categories = Object.entries(SERVICE_CATEGORY_LABEL)
    .map(([key, label]) => ({ key, label, items: services.filter((s) => s.category === key) }))
    .filter((c) => c.items.length > 0);

  return (
    <PageContainer
      eyebrow='Kouture · Salon'
      pageTitle='Service menu'
      pageDescription='Prices here price your Nailzy bookings. Keep names the same as in Nailzy so they match.'
      pageHeaderAction={
        <AddButton
          entity='kouture.services'
          label='Add service'
          title='New service'
          fields={FORMS.service}
          initial={{ category: 'manicure', durationMinutes: 60, active: true }}
        />
      }
    >
      {categories.length === 0 ? (
        <EmptyNote>Add your services to price bookings and see what earns the most.</EmptyNote>
      ) : (
        <div className='grid gap-5 lg:grid-cols-2'>
          {categories.map((cat) => (
            <SectionCard key={cat.key} title={cat.label} eyebrow={`${cat.items.length} services`}>
              <ul className='divide-border/60 divide-y'>
                {cat.items.map((s) => (
                  <li
                    key={s.id}
                    className={cn('flex items-center gap-3 py-3', !s.active && 'opacity-55')}
                  >
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm font-medium'>
                        {s.name}
                        {!s.active && (
                          <span className='text-muted-foreground ml-2 text-xs font-normal'>
                            hidden
                          </span>
                        )}
                      </p>
                      <p className='text-muted-foreground truncate text-xs'>
                        {duration(s.durationMinutes)}
                        {s.depositCents > 0 &&
                          ` · ${formatCents(s.depositCents, { whole: true })} deposit`}
                      </p>
                    </div>
                    <p className='font-display shrink-0 text-xl tabular-nums'>
                      {formatCents(s.priceCents, { whole: true })}
                    </p>
                    <RowActions
                      entity='kouture.services'
                      id={s.id}
                      label={s.name}
                      fields={FORMS.service}
                      values={s}
                      extra={[
                        {
                          label: s.active ? 'Hide from menu' : 'Show on menu',
                          icon: s.active ? 'eyeOff' : 'check',
                          patch: { active: !s.active }
                        }
                      ]}
                    />
                  </li>
                ))}
              </ul>
            </SectionCard>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
