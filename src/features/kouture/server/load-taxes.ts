import 'server-only';

import { startOfDayInZone } from '@/lib/dates';
import type { OwnerSession } from '@/server/session';

import { taxYearSummary } from '../lib/taxes';

export const INCOME_TAX_RATES = [10, 15, 20, 25] as const;
export const DEFAULT_INCOME_TAX_RATE = 15;

export async function loadTaxYear(session: OwnerSession, year: number, ratePercent: number) {
  const tz = session.profile.timezone;
  const { entities } = session.repos;
  const [payments, expenses, taxPayments] = await Promise.all([
    entities('kouture.payments').list({
      range: {
        field: 'receivedAt',
        gte: startOfDayInZone(`${year}-01-01`, tz).toISOString(),
        lt: startOfDayInZone(`${year + 1}-01-01`, tz).toISOString()
      }
    }),
    entities('kouture.expenses').list({
      range: { field: 'spentOn', gte: `${year}-01-01`, lte: `${year}-12-31` },
      order: [{ field: 'spentOn' }]
    }),
    entities('kouture.tax_payments').list({
      eq: { taxYear: year },
      order: [{ field: 'paidOn' }]
    })
  ]);
  const summary = taxYearSummary({
    year,
    payments,
    expenses,
    timeZone: tz,
    incomeTaxRate: ratePercent / 100
  });
  return { summary, expenses, taxPayments };
}
