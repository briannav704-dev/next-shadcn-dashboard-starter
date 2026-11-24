import type { AppointmentStatus } from '@/server/data/types';

export const APPOINTMENT_STATUS_STYLE: Record<
  AppointmentStatus,
  { label: string; className: string }
> = {
  booked: { label: 'Booked', className: 'bg-muted text-muted-foreground' },
  confirmed: { label: 'Confirmed', className: 'bg-blush text-secondary-foreground' },
  completed: { label: 'Completed', className: 'bg-success/12 text-success' },
  no_show: { label: 'No-show', className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground line-through' }
};
