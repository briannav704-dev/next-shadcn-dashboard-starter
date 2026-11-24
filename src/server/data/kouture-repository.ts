import 'server-only';

import type { EntityAccess } from '@/server/entities/collection';
import type { RowOf } from '@/server/entities/definitions';

import type { Appointment, KoutureRepository } from './types';

type ApptRow = RowOf<'kouture.appointments'>;

/** Turns stored appointments into display records, naming client and service. */
export async function describeAppointments(
  entities: EntityAccess,
  rows: ApptRow[],
  known?: { clients: { id: string; fullName: string }[]; services: { id: string; name: string }[] }
): Promise<Appointment[]> {
  if (rows.length === 0) return [];
  // One salon's client list and menu are small; loading them avoids N lookups.
  const [clients, services] = known
    ? [known.clients, known.services]
    : await Promise.all([entities('kouture.clients').list(), entities('kouture.services').list()]);
  const clientName = new Map(clients.map((c) => [c.id, c.fullName]));
  const serviceName = new Map(services.map((s) => [s.id, s.name]));
  return rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    clientName: (r.clientId && clientName.get(r.clientId)) || r.clientLabel || 'Walk-in',
    serviceName: r.serviceLabel || (r.serviceId && serviceName.get(r.serviceId)) || 'Service',
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    priceCents: r.priceCents,
    depositCents: r.depositCents,
    source: r.source
  }));
}

/** Dashboard-level Kouture queries, shared by the Supabase and sample-data modes. */
export function createKoutureRepository(entities: EntityAccess): KoutureRepository {
  return {
    async listAppointments(range) {
      const rows = await entities('kouture.appointments').list({
        range: { field: 'startsAt', gte: range.from, lt: range.to },
        order: [{ field: 'startsAt' }]
      });
      return describeAppointments(entities, rows);
    },
    async listPayments(range) {
      const rows = await entities('kouture.payments').list({
        range: { field: 'receivedAt', gte: range.from, lt: range.to }
      });
      return rows.map((p) => ({
        id: p.id,
        appointmentId: p.appointmentId,
        kind: p.kind,
        method: p.method,
        amountCents: p.amountCents,
        receivedAt: p.receivedAt
      }));
    },
    async listExpenses({ fromDay, toDay }) {
      const rows = await entities('kouture.expenses').list({
        range: { field: 'spentOn', gte: fromDay, lte: toDay }
      });
      return rows.map((e) => ({
        id: e.id,
        category: e.category,
        vendor: e.vendor,
        amountCents: e.amountCents,
        spentOn: e.spentOn
      }));
    },
    async clientStats(monthStart, lapsedBefore) {
      const [clients, recent] = await Promise.all([
        entities('kouture.clients').list(),
        entities('kouture.appointments').list({ range: { field: 'startsAt', gte: lapsedBefore } })
      ]);
      const nowIso = new Date().toISOString();
      // Active = a completed visit since `lapsedBefore`, or something booked ahead.
      const active = new Set(
        recent
          .filter(
            (a) =>
              a.clientId &&
              (a.status === 'completed' || (a.startsAt > nowIso && a.status !== 'cancelled'))
          )
          .map((a) => a.clientId)
      );
      return {
        total: clients.length,
        newThisMonth: clients.filter((c) => Date.parse(c.createdAt) >= Date.parse(monthStart))
          .length,
        lapsed: clients.filter((c) => !active.has(c.id)).length
      };
    }
  };
}
