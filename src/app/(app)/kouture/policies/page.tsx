import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import PageContainer from '@/components/layout/page-container';
import { CopyButton } from '@/components/lux/copy-button';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { FORMS } from '@/features/kouture/forms';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Policies' };

export default async function PoliciesPage() {
  const { repos } = await requireOwnerPage();
  const policies = await repos
    .entities('kouture.policies')
    .list({ order: [{ field: 'sortOrder' }, { field: 'title' }] });
  const all = policies.map((p) => `${p.title.toUpperCase()}\n${p.body}`).join('\n\n');

  return (
    <PageContainer
      eyebrow='Kouture · Salon'
      pageTitle='Policies'
      pageDescription='Your salon rules in one place, ready to paste into Nailzy, Instagram or a client text. Your AI team follows these too.'
      pageHeaderAction={
        <div className='flex items-center gap-2'>
          {policies.length > 0 && <CopyButton text={all} label='Copy all' />}
          <AddButton
            entity='kouture.policies'
            label='Add policy'
            title='New policy'
            fields={FORMS.policy}
            fixed={{ sortOrder: policies.length }}
          />
        </div>
      }
    >
      {policies.length === 0 ? (
        <EmptyNote>
          Start with deposits, cancellations, late arrivals and no-shows. Clear policies protect
          your time.
        </EmptyNote>
      ) : (
        <div className='grid gap-5 md:grid-cols-2'>
          {policies.map((p) => (
            <SectionCard
              key={p.id}
              title={p.title}
              action={
                <div className='flex items-center'>
                  <CopyButton text={p.body} />
                  <RowActions
                    entity='kouture.policies'
                    id={p.id}
                    label={p.title}
                    fields={FORMS.policy}
                    values={p}
                  />
                </div>
              }
            >
              <p className='text-sm leading-relaxed whitespace-pre-line'>{p.body}</p>
            </SectionCard>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
