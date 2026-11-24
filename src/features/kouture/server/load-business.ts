import 'server-only';

import { describeAppointments } from '@/server/data/kouture-repository';
import type { OwnerSession } from '@/server/session';

/**
 * Everything the business pages compute from: clients, menu, appointments,
 * payments and expenses since `sinceIso` (or all time). One salon's history is
 * small enough to analyse in memory.
 */
export async function loadBusiness({ repos }: OwnerSession, sinceIso?: string) {
  const { entities } = repos;
  const since = <F extends string>(field: F) =>
    sinceIso ? { range: { field, gte: sinceIso } } : {};
  const [clients, services, appointmentRows, payments, expenses] = await Promise.all([
    entities('kouture.clients').list({ order: [{ field: 'fullName' }] }),
    entities('kouture.services').list({ order: [{ field: 'name' }] }),
    entities('kouture.appointments').list({
      ...since('startsAt' as const),
      order: [{ field: 'startsAt' }]
    }),
    entities('kouture.payments').list(since('receivedAt' as const)),
    entities('kouture.expenses').list(
      sinceIso ? { range: { field: 'spentOn', gte: sinceIso.slice(0, 10) } } : {}
    )
  ]);
  const appointments = await describeAppointments(entities, appointmentRows, { clients, services });
  return { clients, services, appointmentRows, appointments, payments, expenses };
}

export type BusinessData = Awaited<ReturnType<typeof loadBusiness>>;
