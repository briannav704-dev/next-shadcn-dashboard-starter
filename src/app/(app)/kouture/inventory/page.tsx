import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { StatCard } from '@/components/lux/stat-card';
import { StockStepper } from '@/features/kouture/components/stock-stepper';
import { FORMS, INVENTORY_CATEGORY_LABEL } from '@/features/kouture/forms';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Inventory' };

export default async function InventoryPage() {
  const { repos } = await requireOwnerPage();
  const items = await repos
    .entities('kouture.inventory_items')
    .list({ eq: { archived: false }, order: [{ field: 'name' }] });
  const low = items.filter((i) => i.onHand <= i.reorderAt);
  const value = items.reduce((s, i) => s + i.onHand * (i.unitCostCents ?? 0), 0);
  const restockCost = low.reduce(
    (s, i) => s + Math.max(1, Math.ceil(i.reorderAt * 2 - i.onHand)) * (i.unitCostCents ?? 0),
    0
  );
  const groups = Object.entries(INVENTORY_CATEGORY_LABEL)
    .map(([key, label]) => ({ key, label, items: items.filter((i) => i.category === key) }))
    .filter((g) => g.items.length > 0);

  return (
    <PageContainer
      eyebrow='Kouture · Salon'
      pageTitle='Inventory'
      pageDescription='Tap − as you use something up; items at their reorder point are flagged.'
      pageHeaderAction={
        <AddButton
          entity='kouture.inventory_items'
          label='Add item'
          title='New item'
          fields={FORMS.inventory}
          initial={{ category: 'gel', unit: 'unit', onHand: 1, reorderAt: 1 }}
        />
      }
    >
      <div className='grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-3'>
        <StatCard label='Items tracked' icon='inventory' value={String(items.length)} />
        <StatCard
          label='Running low'
          icon='warning'
          value={String(low.length)}
          hint={
            low.length
              ? `about ${formatCents(restockCost, { whole: true })} to restock`
              : 'all stocked'
          }
        />
        <StatCard
          label='Stock value'
          icon='cash'
          value={formatCents(value, { whole: true })}
          hint='at cost'
          className='col-span-2 xl:col-span-1'
        />
      </div>

      {low.length > 0 && (
        <SectionCard className='mt-5' title='Restock list' eyebrow='Running low'>
          <ul className='divide-border/60 divide-y'>
            {low.map((i) => (
              <li key={i.id} className='flex items-center gap-3 py-2.5'>
                <Icons.warning className='text-gold-ink size-4 shrink-0' aria-hidden />
                <p className='min-w-0 flex-1 truncate text-sm'>{i.name}</p>
                <p className='text-muted-foreground shrink-0 text-xs'>
                  {i.onHand} left{i.supplier && ` · ${i.supplier}`}
                </p>
              </li>
            ))}
          </ul>
          <p className='text-muted-foreground mt-3 text-xs'>
            In Phase 5 your Inventory Manager drafts these orders for you to approve.
          </p>
        </SectionCard>
      )}

      {groups.length === 0 ? (
        <EmptyNote className='mt-5'>Add the supplies you’d hate to run out of.</EmptyNote>
      ) : (
        <div className='mt-5 grid gap-5 lg:grid-cols-2'>
          {groups.map((g) => (
            <SectionCard key={g.key} title={g.label} eyebrow={`${g.items.length} items`}>
              <ul className='divide-border/60 divide-y'>
                {g.items.map((i) => {
                  const isLow = i.onHand <= i.reorderAt;
                  return (
                    <li key={i.id} className='flex flex-wrap items-center gap-x-3 gap-y-2 py-3'>
                      <div className='min-w-0 flex-1'>
                        <p className={cn('truncate text-sm font-medium', isLow && 'text-gold-ink')}>
                          {i.name}
                        </p>
                        <p className='text-muted-foreground truncate text-xs'>
                          Reorder at {i.reorderAt}
                          {i.unitCostCents ? ` · ${formatCents(i.unitCostCents)} each` : ''}
                        </p>
                      </div>
                      <StockStepper itemId={i.id} name={i.name} onHand={i.onHand} unit={i.unit} />
                      <RowActions
                        entity='kouture.inventory_items'
                        id={i.id}
                        label={i.name}
                        fields={FORMS.inventory}
                        values={i}
                        extra={[{ label: 'Archive', icon: 'eyeOff', patch: { archived: true } }]}
                      />
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
