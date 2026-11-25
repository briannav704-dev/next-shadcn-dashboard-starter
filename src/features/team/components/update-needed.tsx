import PageContainer from '@/components/layout/page-container';
import { SectionCard } from '@/components/lux/section-card';

/** Shown instead of the team when the database update hasn't been applied yet. */
export function TeamUpdateNeeded() {
  return (
    <PageContainer eyebrow='Kouture · AI management team' pageTitle='One quick database update'>
      <SectionCard title='Add the team to your database' eyebrow='About 1 minute'>
        <ol className='text-muted-foreground list-decimal space-y-2 pl-5 text-sm leading-relaxed'>
          <li>
            On GitHub, open <strong>supabase/migrations/20261128000001_ai_team.sql</strong> in your
            project and tap <strong>Copy raw file</strong>.
          </li>
          <li>
            In Supabase, go to <strong>SQL Editor → New query</strong>, paste, and tap{' '}
            <strong>Run</strong>. You should see “Success. No rows returned.”
          </li>
          <li>Come back and refresh this page.</li>
        </ol>
      </SectionCard>
    </PageContainer>
  );
}
