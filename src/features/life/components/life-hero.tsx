import { ProgressRing } from '@/components/lux/progress-ring';
import { Icons } from '@/components/icons';
import { formatDayLong } from '@/lib/dates';

export function LifeHero({
  name,
  today,
  greeting,
  tasksDueToday,
  habitsDone,
  habitsTotal,
  salonBookingsToday
}: {
  name: string;
  today: string;
  greeting: string;
  tasksDueToday: number;
  habitsDone: number;
  habitsTotal: number;
  salonBookingsToday: number;
}) {
  const chips = [
    {
      icon: Icons.checklist,
      text: `${tasksDueToday} ${tasksDueToday === 1 ? 'task' : 'tasks'} due today`
    },
    { icon: Icons.habit, text: `${habitsDone} of ${habitsTotal} habits done` },
    {
      icon: Icons.diamond,
      text: `${salonBookingsToday} ${salonBookingsToday === 1 ? 'client' : 'clients'} at the salon`
    }
  ];
  const habitRatio = habitsTotal ? habitsDone / habitsTotal : 0;
  return (
    <section className='lux-card hero-wash relative overflow-hidden p-6 md:p-8' aria-label='Today'>
      <div className='flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between'>
        <div className='min-w-0'>
          <div className='flex items-start justify-between gap-3'>
            <p className='text-gold-ink pt-1 text-xs font-medium tracking-[0.22em] uppercase'>
              {formatDayLong(today)}
            </p>
            <ProgressRing
              value={habitRatio}
              size={64}
              stroke={5}
              className='-mt-1 shrink-0 sm:hidden'
            />
          </div>
          <h1 className='font-display mt-2 text-4xl leading-tight font-medium text-balance md:text-5xl'>
            {greeting}, <em className='text-rose font-normal'>{name}</em>
          </h1>
          <ul className='mt-5 flex flex-wrap gap-2'>
            {chips.map((chip) => (
              <li
                key={chip.text}
                className='bg-card/70 text-foreground/85 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs backdrop-blur'
              >
                <chip.icon className='text-rose size-3.5' aria-hidden />
                {chip.text}
              </li>
            ))}
          </ul>
        </div>
        <ProgressRing
          value={habitRatio}
          size={112}
          label='Habits'
          className='hidden shrink-0 self-center sm:grid'
        />
      </div>
    </section>
  );
}
