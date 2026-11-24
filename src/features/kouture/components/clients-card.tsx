import { SectionCard } from '@/components/lux/section-card';
import type { ClientStats } from '@/server/data/types';

export function ClientsCard({ stats }: { stats: ClientStats }) {
  const items = [
    { label: 'Clients', value: stats.total },
    { label: 'New this month', value: stats.newThisMonth },
    { label: 'Due for a visit', value: stats.lapsed }
  ];
  return (
    <SectionCard title='Clientele' eyebrow='Retention'>
      <dl className='grid grid-cols-3 gap-3'>
        {items.map((item) => (
          <div key={item.label} className='bg-muted/60 rounded-xl px-3 py-3 text-center'>
            <dd className='font-display text-3xl leading-none tabular-nums'>{item.value}</dd>
            <dt className='text-muted-foreground mt-1.5 text-[0.68rem] leading-tight'>
              {item.label}
            </dt>
          </div>
        ))}
      </dl>
      {stats.lapsed > 0 && (
        <p className='text-muted-foreground mt-3 text-xs'>
          {stats.lapsed} {stats.lapsed === 1 ? 'client has' : 'clients have'} not been in for 60+
          days and have nothing booked. Your Client Relations Manager will draft win-backs for your
          approval in Phase 5.
        </p>
      )}
    </SectionCard>
  );
}
