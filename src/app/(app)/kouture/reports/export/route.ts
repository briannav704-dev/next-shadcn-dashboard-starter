import { loadProfitReport } from '@/features/kouture/server/load-report';
import { getOwnerSession } from '@/server/session';

// Profit report as CSV for the owner's accountant. Owner-only, never cached.
export const dynamic = 'force-dynamic';

const dollars = (cents: number) => (cents / 100).toFixed(2);

export async function GET(request: Request) {
  const session = await getOwnerSession();
  if (!session) return new Response('Sign in required', { status: 401 });

  const requested = Number(new URL(request.url).searchParams.get('months'));
  const months = Number.isInteger(requested) && requested >= 1 && requested <= 24 ? requested : 12;
  const { lines } = await loadProfitReport(session, months);

  const header = ['Month', 'Services', 'Tips', 'Refunds', 'Expenses', 'Profit', 'Visits'];
  const rows = lines.map((l) => [
    l.month.slice(0, 7),
    dollars(l.serviceCents),
    dollars(l.tipCents),
    dollars(l.refundCents),
    dollars(l.expenseCents),
    dollars(l.profitCents),
    String(l.visits)
  ]);
  const csv = [header, ...rows].map((r) => r.join(',')).join('\r\n');

  return new Response(`${csv}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="kouture-profit-${lines.at(-1)?.month.slice(0, 7)}.csv"`,
      'cache-control': 'private, no-store'
    }
  });
}
