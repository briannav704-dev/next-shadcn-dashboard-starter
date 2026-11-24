import type { Metadata } from 'next';
import Link from 'next/link';

import PageContainer from '@/components/layout/page-container';
import { SectionCard } from '@/components/lux/section-card';
import { requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Connect Nailzy calendar' };

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Open Google Calendar in Safari',
    body: (
      <>
        Go to <strong>calendar.google.com</strong> and sign in as your salon Gmail (the
        kouturenailbar1 account your Nailzy bookings sync to). Tap <strong>aA</strong> in the
        address bar, then <strong>Request Desktop Website</strong>. The settings you need only exist
        on the desktop version.
      </>
    )
  },
  {
    title: 'Find the secret address',
    body: (
      <>
        Tap the gear <strong>⚙ → Settings</strong>. On the left, under{' '}
        <strong>Settings for my calendars</strong>, tap your kouturenailbar1 calendar, then{' '}
        <strong>Integrate calendar</strong>. Copy the <strong>Secret address in iCal format</strong>{' '}
        (it ends in <code>basic.ics</code>).
      </>
    )
  },
  {
    title: 'Save it in Vercel, not anywhere else',
    body: (
      <>
        In Vercel, open your project → <strong>Settings → Environment Variables</strong>. Add the
        name <code>NAILZY_CALENDAR_URL</code>, paste the address as the value, and save. Then go to{' '}
        <strong>Deployments</strong>, tap ⋯ on the newest one and choose <strong>Redeploy</strong>.
      </>
    )
  },
  {
    title: 'Sync',
    body: (
      <>
        Come back to{' '}
        <Link href='/kouture/appointments' className='text-rose underline'>
          Appointments
        </Link>{' '}
        and tap <strong>Sync now</strong>. After that it syncs by itself whenever you open the page.
      </>
    )
  }
];

export default async function ConnectCalendarPage() {
  await requireOwnerPage();
  return (
    <PageContainer
      eyebrow='Kouture · Appointments'
      pageTitle='Connect your Nailzy calendar'
      pageDescription='Nailzy already copies every booking into your Google Calendar. Kouture reads that calendar, so new bookings, reschedules and cancellations show up here on their own.'
    >
      <div className='grid gap-5 lg:grid-cols-12'>
        <div className='lg:col-span-7'>
          <SectionCard title='Four steps, about five minutes' eyebrow='On your iPad'>
            <ol className='flex flex-col gap-5'>
              {STEPS.map((step, i) => (
                <li key={step.title} className='flex gap-4'>
                  <span className='bg-blush text-rose font-display grid size-9 shrink-0 place-items-center rounded-full text-lg'>
                    {i + 1}
                  </span>
                  <div>
                    <p className='font-medium'>{step.title}</p>
                    <p className='text-muted-foreground mt-1 text-sm leading-relaxed'>
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>
        </div>
        <div className='flex flex-col gap-5 lg:col-span-5'>
          <SectionCard title='Keep the link private' eyebrow='Important'>
            <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-sm leading-relaxed'>
              <li>Anyone with the secret address can see your bookings and client names.</li>
              <li>Don’t paste it in chats, emails or GitHub. Vercel stores it privately.</li>
              <li>
                If it’s ever shared by mistake, tap <strong>Reset</strong> next to it in Google
                Calendar and save the new one in Vercel.
              </li>
            </ul>
          </SectionCard>
          <SectionCard title='How bookings are read' eyebrow='Good to know'>
            <ul className='text-muted-foreground list-disc space-y-2 pl-5 text-sm leading-relaxed'>
              <li>
                Titles like <em>Jen Rivera — Acrylic Fill — Short</em> become the client and the
                service. Other events on the calendar are ignored.
              </li>
              <li>
                Prices come from your{' '}
                <Link href='/kouture/services' className='text-rose underline'>
                  service menu
                </Link>
                . Use the same names as Nailzy so they match.
              </li>
              <li>
                Kouture only reads the calendar. It never changes anything in Nailzy or Google.
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
