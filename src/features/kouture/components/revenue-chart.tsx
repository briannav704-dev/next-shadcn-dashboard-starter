'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { SectionCard } from '@/components/lux/section-card';
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { formatDayShort } from '@/lib/dates';
import { formatCents } from '@/lib/money';

import type { RevenueDay } from '../lib/summary';

const config = {
  stripe: { label: 'Stripe deposits', color: 'var(--chart-1)' },
  cash: { label: 'Cash balances & tips', color: 'var(--chart-2)' }
} satisfies ChartConfig;

function tooltipRow(value: unknown, name: unknown) {
  return (
    <div className='flex w-full items-center justify-between gap-4'>
      <span className='text-muted-foreground'>
        {config[name as keyof typeof config]?.label ?? String(name)}
      </span>
      <span className='font-medium tabular-nums'>{formatCents(Number(value) * 100)}</span>
    </div>
  );
}

export function RevenueChart({ series }: { series: RevenueDay[] }) {
  const data = series.map((d) => ({
    day: d.day,
    label: `${formatDayShort(d.day)} ${Number(d.day.slice(8, 10))}`,
    stripe: d.stripeCents / 100,
    cash: d.cashCents / 100
  }));
  const total = series.reduce((s, d) => s + d.stripeCents + d.cashCents, 0);

  return (
    <SectionCard
      title='Money in'
      eyebrow='Last 14 days'
      action={
        <p className='font-display text-2xl leading-none tabular-nums'>
          {formatCents(total, { whole: true })}
        </p>
      }
    >
      <ul className='mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs' aria-label='Legend'>
        {Object.entries(config).map(([key, item]) => (
          <li key={key} className='text-muted-foreground flex items-center gap-1.5'>
            <span
              className='size-2.5 rounded-[3px]'
              style={{ background: item.color }}
              aria-hidden
            />
            {item.label}
          </li>
        ))}
      </ul>
      <ChartContainer config={config} className='aspect-auto h-56 w-full'>
        <BarChart
          data={data}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          barCategoryGap='22%'
        >
          <CartesianGrid vertical={false} strokeDasharray='2 4' />
          <XAxis
            dataKey='label'
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval='preserveStartEnd'
            minTickGap={18}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
          />
          <ChartTooltip
            cursor={{ fillOpacity: 0.5 }}
            content={<ChartTooltipContent indicator='dot' formatter={tooltipRow} />}
          />
          {/* 2px card-coloured stroke separates the stacked segments. */}
          <Bar
            dataKey='stripe'
            stackId='money'
            fill='var(--color-stripe)'
            stroke='var(--card)'
            strokeWidth={2}
            radius={0}
          />
          <Bar
            dataKey='cash'
            stackId='money'
            fill='var(--color-cash)'
            stroke='var(--card)'
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
      <table className='sr-only'>
        <caption>Money in by day</caption>
        <thead>
          <tr>
            <th scope='col'>Day</th>
            <th scope='col'>Stripe deposits</th>
            <th scope='col'>Cash</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.day}>
              <th scope='row'>{d.day}</th>
              <td>{formatCents(d.stripeCents)}</td>
              <td>{formatCents(d.cashCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}
