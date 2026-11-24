import { EmptyNote } from '@/components/lux/empty-note';
import { SectionCard } from '@/components/lux/section-card';
import { Badge } from '@/components/ui/badge';
import { dayKey, formatDayShort, formatTime } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/server/data/types';

import { APPOINTMENT_STATUS_STYLE } from './appointment-status';

const STATUS = APPOINTMENT_STATUS_STYLE;

function AppointmentRow({
  appt,
  timeZone,
  showDay
}: {
  appt: Appointment;
  timeZone: string;
  showDay?: boolean;
}) {
  const balance = appt.priceCents - appt.depositCents;
  const status = STATUS[appt.status];
  return (
    <li className='flex items-center gap-3 py-2.5'>
      <div className='w-[4.5rem] shrink-0 text-right whitespace-nowrap'>
        {showDay && (
          <p className='text-gold-ink text-[0.62rem] font-medium tracking-[0.12em] uppercase'>
            {formatDayShort(dayKey(new Date(appt.startsAt), timeZone))}
          </p>
        )}
        <p className='font-display text-lg leading-none'>{formatTime(appt.startsAt, timeZone)}</p>
      </div>
      <span className='bg-champagne/60 h-10 w-px shrink-0' aria-hidden />
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>{appt.clientName}</p>
        <p className='text-muted-foreground truncate text-xs'>{appt.serviceName}</p>
      </div>
      <div className='hidden shrink-0 text-right sm:block'>
        <p className='text-sm tabular-nums'>{formatCents(appt.priceCents, { whole: true })}</p>
        <p className='text-muted-foreground text-[0.7rem] tabular-nums'>
          {appt.status === 'completed'
            ? 'Paid in full'
            : `${formatCents(balance, { whole: true })} cash due`}
        </p>
      </div>
      <Badge className={cn('shrink-0 rounded-full font-normal', status.className)}>
        {status.label}
      </Badge>
    </li>
  );
}

export function TodayAppointments({
  today,
  upcoming,
  timeZone,
  bookingUrl
}: {
  today: Appointment[];
  upcoming: Appointment[];
  timeZone: string;
  bookingUrl: string | null;
}) {
  const expected = today
    .filter((a) => a.status !== 'no_show')
    .reduce((s, a) => s + a.priceCents, 0);
  return (
    <SectionCard
      title='Appointments'
      eyebrow='Today'
      action={
        bookingUrl ? (
          <a
            href={bookingUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='border-champagne/70 text-gold-ink hover:bg-blush/60 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors'
          >
            Open Nailzy
          </a>
        ) : (
          <span
            className='text-muted-foreground text-xs'
            title='Set NAILZY_BOOKING_URL to add a shortcut'
          >
            Nailzy link not set
          </span>
        )
      }
    >
      {today.length === 0 ? (
        <EmptyNote>No clients booked today.</EmptyNote>
      ) : (
        <>
          <p className='text-muted-foreground mb-1 text-xs'>
            {today.length} {today.length === 1 ? 'client' : 'clients'} ·{' '}
            {formatCents(expected, { whole: true })} on the books
          </p>
          <ul className='divide-border/70 divide-y'>
            {today.map((a) => (
              <AppointmentRow key={a.id} appt={a} timeZone={timeZone} />
            ))}
          </ul>
        </>
      )}
      {upcoming.length > 0 && (
        <>
          <p className='text-gold-ink mt-5 mb-1 text-[0.65rem] font-medium tracking-[0.2em] uppercase'>
            Coming up
          </p>
          <ul className='divide-border/70 divide-y'>
            {upcoming.slice(0, 4).map((a) => (
              <AppointmentRow key={a.id} appt={a} timeZone={timeZone} showDay />
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
