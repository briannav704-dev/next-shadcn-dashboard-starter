import type { Metadata } from 'next';

import { AddButton, RowActions } from '@/components/entity/entity-controls';
import type { FieldSpec } from '@/components/entity/entity-form-dialog';
import PageContainer from '@/components/layout/page-container';
import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { BUSINESS } from '@/config/business';
import { SendCampaign } from '@/features/kouture/components/send-campaign';
import {
  AUDIENCE_LABEL,
  EMAIL_TEMPLATES,
  type EmailAudience,
  composeEmail,
  emailRecipients,
  mailtoHref
} from '@/features/kouture/lib/email';
import { formatVisitDate } from '@/features/kouture/lib/format';
import { clientHistories } from '@/features/kouture/lib/insights';
import { loadBusiness } from '@/features/kouture/server/load-business';
import { todayKey } from '@/lib/dates';
import { readEnv } from '@/server/env';
import { isAppError } from '@/server/errors';
import { requestNow, requireOwnerPage } from '@/server/session';

export const metadata: Metadata = { title: 'Email campaigns' };

const campaignFields: FieldSpec[] = [
  { name: 'title', label: 'Name (just for you)', type: 'text', required: true },
  {
    name: 'audience',
    label: 'Send to',
    type: 'select',
    required: true,
    options: (Object.keys(AUDIENCE_LABEL) as EmailAudience[]).map((value) => ({
      value,
      label: AUDIENCE_LABEL[value]
    }))
  },
  { name: 'subject', label: 'Subject', type: 'text', required: true },
  {
    name: 'body',
    label: 'Message',
    type: 'textarea',
    required: true,
    help: '{booking_link} becomes your Nailzy link. Your address and how to unsubscribe are added at the bottom automatically.'
  }
];

const addressFields: FieldSpec[] = [
  {
    name: 'postalAddress',
    label: 'Salon mailing address',
    type: 'text',
    required: true,
    placeholder: 'Street, city, state ZIP (a P.O. box is fine)',
    help: 'US law (CAN-SPAM) requires a mailing address in marketing emails.'
  }
];

export default async function EmailPage() {
  const session = await requireOwnerPage();
  const { repos, profile } = session;
  const now = requestNow();
  const loaded = await Promise.all([
    repos
      .entities('kouture.email_campaigns')
      .list({ order: [{ field: 'createdAt', ascending: false }] }),
    repos.entities('kouture.business_profile').list({ limit: 1 }),
    loadBusiness(session)
  ]).catch((error: unknown) => {
    if (isAppError(error) && error.code === 'INVALID') return error.message;
    throw error;
  });
  if (typeof loaded === 'string') {
    return (
      <PageContainer eyebrow='Kouture · Growth' pageTitle='One quick database update'>
        <SectionCard title='Add email campaigns to your database' eyebrow='About 1 minute'>
          <ol className='text-muted-foreground list-decimal space-y-2 pl-5 text-sm leading-relaxed'>
            <li>
              On GitHub, open <strong>supabase/update.sql</strong> in your project and tap{' '}
              <strong>Copy raw file</strong>.
            </li>
            <li>
              In Supabase, go to <strong>SQL Editor → New query</strong>, paste, and tap{' '}
              <strong>Run</strong>.
            </li>
            <li>Come back and refresh this page.</li>
          </ol>
        </SectionCard>
      </PageContainer>
    );
  }
  const [campaigns, [business], data] = loaded;
  const histories = clientHistories(data.appointments, data.payments, now);
  const today = todayKey(profile.timezone, now);
  const bookingUrl = readEnv().NAILZY_BOOKING_URL ?? BUSINESS.nailzyBookingUrl;
  const postalAddress = business?.postalAddress ?? null;
  const drafts = campaigns.filter((c) => c.status === 'draft');
  const sent = campaigns.filter((c) => c.status === 'sent');
  const allReachable = emailRecipients('all', data.clients, histories, now, today);

  return (
    <PageContainer
      eyebrow='Kouture · Growth'
      pageTitle='Email campaigns'
      pageDescription='Write once, send from your own email. Only clients who agreed to emails are included, hidden in BCC so no one sees anyone else’s address.'
    >
      <div className='grid gap-5 lg:grid-cols-12'>
        <div className='flex flex-col gap-5 lg:col-span-8'>
          <SectionCard title='Ready to send' eyebrow={`${drafts.length} drafts`}>
            {drafts.length === 0 ? (
              <EmptyNote>Pick a template on the right to start an email.</EmptyNote>
            ) : (
              <ul className='space-y-5'>
                {drafts.map((c) => {
                  const recipients = emailRecipients(
                    c.audience,
                    data.clients,
                    histories,
                    now,
                    today
                  );
                  const email = composeEmail(c, {
                    name: profile.businessName,
                    postalAddress,
                    bookingUrl
                  });
                  const addresses = recipients.map((r) => r.email as string);
                  const blocked = !postalAddress
                    ? 'Add your salon mailing address (on the right) before sending; the law requires it in marketing emails.'
                    : addresses.length === 0
                      ? 'No one in this group has agreed to emails yet. Record consent on client profiles.'
                      : null;
                  return (
                    <li key={c.id} className='border-border/60 rounded-2xl border p-4'>
                      <div className='flex items-start gap-3'>
                        <div className='min-w-0 flex-1'>
                          <p className='text-gold-ink text-[0.65rem] font-medium tracking-[0.16em] uppercase'>
                            {AUDIENCE_LABEL[c.audience]} · {addresses.length}{' '}
                            {addresses.length === 1 ? 'client' : 'clients'}
                          </p>
                          <p className='mt-1 font-medium'>{email.subject}</p>
                          <p className='text-muted-foreground text-xs'>{c.title}</p>
                        </div>
                        <RowActions
                          entity='kouture.email_campaigns'
                          id={c.id}
                          label={c.title}
                          fields={campaignFields}
                          values={c}
                        />
                      </div>
                      <pre className='bg-muted/40 mt-3 max-h-56 overflow-y-auto rounded-xl p-3 font-sans text-sm leading-relaxed whitespace-pre-wrap'>
                        {email.text}
                      </pre>
                      <div className='mt-3'>
                        <SendCampaign
                          campaignId={c.id}
                          mailto={mailtoHref(profile.email, addresses, email.subject, email.text)}
                          addresses={addresses}
                          subject={email.subject}
                          text={email.text}
                          blockedReason={blocked}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {sent.length > 0 && (
            <SectionCard title='Sent' eyebrow='History'>
              <ul className='divide-border/60 divide-y'>
                {sent.map((c) => (
                  <li key={c.id} className='flex items-center gap-3 py-2.5 text-sm'>
                    <span className='min-w-0 flex-1 truncate'>{c.subject}</span>
                    <span className='text-muted-foreground shrink-0 text-xs'>
                      {c.recipientCount ?? 0} ·{' '}
                      {c.sentAt ? formatVisitDate(c.sentAt, profile.timezone, now) : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>

        <div className='flex flex-col gap-5 lg:col-span-4'>
          <SectionCard title='Start from a template' eyebrow='Tap to edit'>
            <ul className='space-y-2'>
              {EMAIL_TEMPLATES.map((t) => (
                <li key={t.id} className='flex items-center gap-2'>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>{t.title}</p>
                    <p className='text-muted-foreground truncate text-xs'>
                      {AUDIENCE_LABEL[t.audience]}
                    </p>
                  </div>
                  <AddButton
                    entity='kouture.email_campaigns'
                    variant='outline'
                    label='Use'
                    title={`New email: ${t.title}`}
                    fields={campaignFields}
                    initial={{
                      title: t.title,
                      subject: t.subject,
                      body: t.body,
                      audience: t.audience
                    }}
                  />
                </li>
              ))}
              <li className='pt-2'>
                <AddButton
                  entity='kouture.email_campaigns'
                  variant='ghost'
                  label='Blank email'
                  title='New email'
                  fields={campaignFields}
                  initial={{ audience: 'all', body: '\n\nBook here: {booking_link}\n\nKouture' }}
                />
              </li>
            </ul>
          </SectionCard>

          <SectionCard title='Your audience' eyebrow='Agreed to emails'>
            <p className='font-display text-3xl'>{allReachable.length}</p>
            <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
              clients with an email who agreed to marketing. Record consent on a client’s profile
              when they say yes; when someone replies UNSUBSCRIBE, mark them opted out there.
            </p>
          </SectionCard>

          <SectionCard
            title='Mailing address'
            eyebrow='Required by law'
            action={
              <AddButton
                entity='kouture.business_profile'
                mode='upsert'
                variant='ghost'
                label={postalAddress ? 'Edit' : 'Add'}
                title='Salon mailing address'
                fields={addressFields}
                initial={{ postalAddress }}
              />
            }
          >
            {postalAddress ? (
              <p className='text-sm'>{postalAddress}</p>
            ) : (
              <EmptyNote>Add the address that goes at the bottom of every email.</EmptyNote>
            )}
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}
