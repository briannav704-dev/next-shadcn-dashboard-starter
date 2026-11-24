import { cn } from '@/lib/utils';

import { MARKETING_CHANNEL_LABEL, MARKETING_STATUS_LABEL } from '../forms';

type Channel = keyof typeof MARKETING_CHANNEL_LABEL;
type Status = keyof typeof MARKETING_STATUS_LABEL;

export const STATUS_TONE: Record<Status, string> = {
  idea: 'bg-muted text-muted-foreground',
  drafting: 'bg-champagne/30 text-gold-ink',
  ready: 'bg-blush text-rose',
  scheduled: 'bg-rose/15 text-rose',
  published: 'bg-success/12 text-success'
};

export function ChannelDot({ channel }: { channel: Channel }) {
  const tone: Record<Channel, string> = {
    instagram: 'bg-rose',
    tiktok: 'bg-foreground/70',
    facebook: 'bg-chart-3',
    sms: 'bg-champagne',
    email: 'bg-gold-ink',
    in_salon: 'bg-taupe',
    other: 'bg-muted-foreground'
  };
  return (
    <span
      className={cn('inline-block size-2 shrink-0 rounded-full', tone[channel])}
      title={MARKETING_CHANNEL_LABEL[channel]}
      aria-hidden
    />
  );
}

export function StatusPill({ status }: { status: Status }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[0.7rem]', STATUS_TONE[status])}>
      {MARKETING_STATUS_LABEL[status]}
    </span>
  );
}
