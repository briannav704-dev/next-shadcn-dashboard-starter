'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';

const config = { minutes: { label: 'Minutes', color: 'var(--chart-1)' } } satisfies ChartConfig;

export function WeeklyMinutesChart({
  series
}: {
  series: { weekStart: string; minutes: number; sessions: number }[];
}) {
  const data = series.map((w) => ({
    label: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(`${w.weekStart}T12:00:00Z`)),
    minutes: w.minutes
  }));
  return (
    <>
      <ChartContainer config={config} className='aspect-auto h-52 w-full'>
        <BarChart
          data={data}
          margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          barCategoryGap='28%'
        >
          <CartesianGrid vertical={false} strokeDasharray='2 4' />
          <XAxis dataKey='label' tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={36} />
          <ChartTooltip
            cursor={{ fillOpacity: 0.5 }}
            content={<ChartTooltipContent indicator='dot' />}
          />
          <Bar dataKey='minutes' fill='var(--color-minutes)' radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
      <table className='sr-only'>
        <caption>Workout minutes per week</caption>
        <tbody>
          {series.map((w) => (
            <tr key={w.weekStart}>
              <th scope='row'>Week of {w.weekStart}</th>
              <td>{w.minutes} minutes</td>
              <td>{w.sessions} sessions</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
