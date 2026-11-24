import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { StatCard } from '@/components/lux/stat-card';
import { Badge } from '@/components/ui/badge';
import { APPOINTMENT_STATUS_STYLE } from '@/features/kouture/components/appointment-status';
import { ConsentControl } from '@/features/kouture/components/consent-controls';
import { FORMS } from '@/features/kouture/forms';
import { clientConsent } from '@/features/kouture/lib/consent';
import { daysAgoLabel, formatVisitDate } from '@/features/kouture/lib/format';
import { clientHistories } from '@/features/kouture/lib/insights';
import { formatTime } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import { describeAppointments } from '@/server/data/kouture-repository';
import { isAppError } from '@/server/errors';
import { requestNow, requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Client' };

type PageProps = { params: Promise<{ id: string }> };

export default async function ClientPage({ params }: PageProps) {
  const { repos, profile } = await requireOwnerPage();
  const { id } = await params;
  const tz = profile.timezone;
  const now = requestNow();
  const { entities } = repos;

  const client = await entities('kouture.clients')
    .get(id)
    .catch((error: unknown) => {
      if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
      throw error;
    });
  const [rows, payments, notes, services] = await Promise.all([
    entities('kouture.appointments').list({
      eq: { clientId: id },
      order: [{ field: 'startsAt', ascending: false }]
    }),
    entities('kouture.payments').list({ eq: { clientId: id } }),
    entities('kouture.client_notes').list({
      eq: { clientId: id },
      order: [{ field: 'createdAt', ascending: false }]
    }),
    entities('kouture.services').list()
  ]);
  const appointments = await describeAppointments(entities, rows, { clients: [client], services });
  const history = clientHistories(appointments, payments, now).get(id);
  const consent = clientConsent(client);
  const tips = payments.filter((p) => p.kind === 'tip').reduce((s, p) => s + p.amountCents, 0);

  const contact = [
    client.phone && {
      icon: 'phone' as const,
      label: client.phone,
      href: `tel:${client.phone.replace(/[^\d+]/g, '')}`
    },
    client.email && { icon: 'mail' as const, label: client.email, href: `mailto:${client.email}` },
    client.instagram && {
      icon: 'social' as const,
      label: client.instagram,
      href: `https://instagram.com/${client.instagram.replace(/^@/, '')}`
    }
  ].filter(Boolean) as { icon: 'phone' | 'mail' | 'social'; label: string; href: string }[];

  return (
    <PageContainer
      eyebrow='Kouture · Client'
      pageTitle={client.fullName}
      pageDescription={
        history?.lastVisit
          ? `Last visit ${daysAgoLabel(history.lastVisit, now)}${history.nextVisit ? ` · next ${formatVisitDate(history.nextVisit, tz, now)}` : ''}`
          : 'No visits yet'
      }
      pageHeaderAction={
        <div className='flex items-center gap-2'>
          <Link
            href='/kouture/clients'
            className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm'
          >
            <Icons.chevronLeft className='size-4' />
            All clients
          </Link>
          <RowActions
            entity='kouture.clients'
            id={client.id}
            label={client.fullName}
            fields={FORMS.client}
            values={client}
          />
        </div>
      }
    >
      {client.allergies && (
        <div
          role='note'
          className='bg-destructive/8 text-destructive mb-5 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm'
        >
          <Icons.warning className='mt-0.5 size-4 shrink-0' aria-hidden />
          <p>
            <strong className='font-medium'>Allergies & sensitivities:</strong> {client.allergies}
          </p>
        </div>
      )}

      <div className='grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4'>
        <StatCard
          label='Visits'
          icon='calendarEvent'
          value={String(history?.visits ?? 0)}
          hint={
            history?.noShows
              ? `${history.noShows} no-show${history.noShows > 1 ? 's' : ''}`
              : undefined
          }
        />
        <StatCard
          label='Lifetime spend'
          icon='cash'
          value={formatCents(history?.spendCents ?? 0, { whole: true })}
          hint={tips ? `incl. ${formatCents(tips, { whole: true })} tips` : undefined}
        />
        <StatCard
          label='Usual rhythm'
          icon='habit'
          value={history?.cadenceDays ? `${history.cadenceDays} days` : '—'}
          hint='between visits'
        />
        <StatCard
          label='Favourite'
          icon='heart'
          value={history?.lastService?.split(/\s+[—–-]\s+|,/)[0] ?? '—'}
          className='[&_p.font-display]:text-xl'
          hint='most recent service'
        />
      </div>

      <div className='mt-5 grid gap-5 lg:grid-cols-12'>
        <div className='flex flex-col gap-5 lg:col-span-5'>
          <SectionCard title='Details' eyebrow='Contact'>
            {contact.length === 0 ? (
              <EmptyNote>No contact details yet. Tap ⋯ above to add them.</EmptyNote>
            ) : (
              <ul className='space-y-2.5'>
                {contact.map((c) => {
                  const Icon = Icons[c.icon];
                  return (
                    <li key={c.href}>
                      <a
                        href={c.href}
                        className='hover:text-rose inline-flex items-center gap-2.5 text-sm'
                        {...(c.icon === 'social'
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                      >
                        <Icon className='text-muted-foreground size-4' aria-hidden />
                        {c.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
            {client.birthday && (
              <p className='text-muted-foreground mt-3 text-sm'>
                Birthday{' '}
                {new Intl.DateTimeFormat('en-US', {
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC'
                }).format(new Date(`${client.birthday}T12:00:00Z`))}
              </p>
            )}
            {client.notes && (
              <p className='mt-3 text-sm leading-relaxed whitespace-pre-line'>{client.notes}</p>
            )}
          </SectionCard>

          <SectionCard title='Marketing consent' eyebrow='Texts & email'>
            <div className='space-y-4'>
              <ConsentControl
                clientId={client.id}
                channel='sms'
                state={consent.sms}
                since={
                  consent.sms === 'opted_out' ? client.smsOptedOutAt : client.smsMarketingConsentAt
                }
              />
              <ConsentControl
                clientId={client.id}
                channel='email'
                state={consent.email}
                since={
                  consent.email === 'opted_out'
                    ? client.emailOptedOutAt
                    : client.emailMarketingConsentAt
                }
              />
            </div>
            <p className='text-muted-foreground mt-4 text-xs leading-relaxed'>
              Only clients who agreed get marketing. Record consent when they give it (for example,
              they ticked the box or texted you “yes”). Opt-outs always win.
            </p>
          </SectionCard>

          <SectionCard
            title='Notes'
            eyebrow='Private'
            action={
              <AddButton
                entity='kouture.client_notes'
                variant='ghost'
                label='Add'
                title={`Note about ${client.fullName}`}
                fields={[{ name: 'body', label: 'Note', type: 'textarea', required: true }]}
                fixed={{ clientId: client.id }}
              />
            }
          >
            {notes.length === 0 ? (
              <EmptyNote>Shapes, colours, life updates — anything worth remembering.</EmptyNote>
            ) : (
              <ul className='space-y-3'>
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className='bg-blush/40 flex items-start gap-2 rounded-xl px-3 py-2.5'
                  >
                    <div className='min-w-0 flex-1'>
                      <p className='text-sm leading-relaxed whitespace-pre-line'>{n.body}</p>
                      <p className='text-muted-foreground mt-1 text-xs'>
                        {formatVisitDate(n.createdAt, tz, now)}
                      </p>
                    </div>
                    <RowActions
                      entity='kouture.client_notes'
                      id={n.id}
                      label='this note'
                      fields={[{ name: 'body', label: 'Note', type: 'textarea', required: true }]}
                      values={n}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className='lg:col-span-7'>
          <SectionCard title='Visit history' eyebrow={`${appointments.length} appointments`}>
            {appointments.length === 0 ? (
              <EmptyNote>No appointments yet.</EmptyNote>
            ) : (
              <ul className='divide-border/60 divide-y'>
                {appointments.map((a) => {
                  const status = APPOINTMENT_STATUS_STYLE[a.status];
                  return (
                    <li key={a.id} className='flex items-center gap-3 py-2.5'>
                      <div className='w-24 shrink-0'>
                        <p className='text-sm'>{formatVisitDate(a.startsAt, tz, now)}</p>
                        <p className='text-muted-foreground text-xs'>
                          {formatTime(a.startsAt, tz)}
                        </p>
                      </div>
                      <p className='min-w-0 flex-1 truncate text-sm'>{a.serviceName}</p>
                      <p className='shrink-0 text-sm tabular-nums'>
                        {a.priceCents ? formatCents(a.priceCents, { whole: true }) : '—'}
                      </p>
                      <Badge className={cn('shrink-0 rounded-full font-normal', status.className)}>
                        {status.label}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
