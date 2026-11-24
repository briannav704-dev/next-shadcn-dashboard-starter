'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { formatCents } from '@/lib/money';

type Series = { key: string; label: string };
const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];

/**
 * Stacked (or single) bar chart in the validated chart palette, with a visible
 * legend and a screen-reader table. `money` values are cents.
 */
export function StackedBars({
  data,
  series,
  caption,
  money = false,
  height = 'h-56'
}: {
  data: ({ label: string } & Record<string, number | string>)[];
  series: Series[];
  caption: string;
  money?: boolean;
  height?: string;
}) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s, i) => [s.key, { label: s.label, color: COLORS[i % COLORS.length] }])
  );
  const rows = money
    ? data.map((d) => ({
        ...d,
        ...Object.fromEntries(series.map((s) => [s.key, Number(d[s.key]) / 100]))
      }))
    : data;
  const format = (v: number) =>
    money ? `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}` : String(v);

  return (
    <>
      {series.length > 1 && (
        <ul className='mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs' aria-label='Legend'>
          {series.map((s, i) => (
            <li key={s.key} className='text-muted-foreground flex items-center gap-1.5'>
              <span
                className='size-2.5 rounded-[3px]'
                style={{ background: COLORS[i % COLORS.length] }}
                aria-hidden
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <ChartContainer config={config} className={`aspect-auto w-full ${height}`}>
        <BarChart
          data={rows}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          barCategoryGap='24%'
        >
          <CartesianGrid vertical={false} strokeDasharray='2 4' />
          <XAxis dataKey='label' tickLine={false} axisLine={false} tickMargin={8} minTickGap={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={false}
            tickFormatter={format}
          />
          <ChartTooltip
            cursor={{ fillOpacity: 0.5 }}
            content={
              <ChartTooltipContent
                indicator='dot'
                formatter={(value, name) => (
                  <div className='flex w-full items-center justify-between gap-4'>
                    <span className='text-muted-foreground'>
                      {config[name as string]?.label ?? String(name)}
                    </span>
                    <span className='font-medium tabular-nums'>
                      {money ? formatCents(Number(value) * 100, { whole: true }) : String(value)}
                    </span>
                  </div>
                )}
              />
            }
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId='stack'
              fill={`var(--color-${s.key})`}
              stroke='var(--card)'
              strokeWidth={series.length > 1 ? 2 : 0}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <table className='sr-only'>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope='col'>Period</th>
            {series.map((s) => (
              <th key={s.key} scope='col'>
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope='row'>{d.label}</th>
              {series.map((s) => (
                <td key={s.key}>{money ? formatCents(Number(d[s.key])) : String(d[s.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
