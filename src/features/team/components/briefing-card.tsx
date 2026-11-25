import Link from 'next/link';

import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import type { AgentMessage } from '@/server/data/types';

import { AGENTS } from '../agents';

export function BriefingCard({
  briefing,
  openCount
}: {
  briefing: AgentMessage | null;
  openCount: number;
}) {
  return (
    <SectionCard
      title='Team briefing'
      eyebrow={`${AGENTS.ceo.name} · CEO`}
      action={
        <Link href='/kouture/team' className='text-rose text-sm hover:underline'>
          {openCount > 0 ? `${openCount} open` : 'Team'}
        </Link>
      }
    >
      {briefing ? (
        <p className='line-clamp-6 text-sm leading-relaxed whitespace-pre-line'>{briefing.body}</p>
      ) : (
        <EmptyNote>Open the team page to get today’s first briefing.</EmptyNote>
      )}
    </SectionCard>
  );
}
