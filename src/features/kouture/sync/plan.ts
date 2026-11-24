import type { CalendarEvent } from './ics';

// Pure planning for the Nailzy calendar sync: given the feed and what is
// already stored, decide what to add, change and cancel. Kept free of I/O so
// it can be tested exhaustively and re-run safely (the sync is idempotent).

export type ExistingAppointment = {
  id: string;
  externalRef: string | null;
  clientId: string | null;
  serviceId: string | null;
  clientLabel: string | null;
  serviceLabel: string | null;
  startsAt: string;
  endsAt: string;
  status: 'booked' | 'confirmed' | 'completed' | 'no_show' | 'cancelled';
  priceCents: number;
};
export type KnownClient = { id: string; fullName: string };
export type KnownService = { id: string; name: string; priceCents: number; depositCents: number };

export type BookingTitle = { client: string; services: string[] };

export type AppointmentDraft = {
  externalRef: string;
  clientName: string;
  clientId: string | null;
  serviceId: string | null;
  clientLabel: string;
  serviceLabel: string;
  startsAt: string;
  endsAt: string;
  priceCents: number;
  depositCents: number;
  status: 'booked' | 'cancelled';
};

export type SyncPlan = {
  /** Clients to create first; drafts refer to them by `clientName`. */
  newClients: string[];
  inserts: AppointmentDraft[];
  updates: { id: string; patch: Partial<AppointmentDraft> }[];
  cancels: string[];
  skipped: { uid: string; reason: string }[];
};

const SEPARATOR = /\s+[—–-]\s+/;
export const SYNC_PAST_DAYS = 30;
export const SYNC_FUTURE_DAYS = 180;

/** "Jen Rivera — Acrylic Fill — Short, Kouture Classic Manicure" → client + services. */
export function parseBookingTitle(summary: string): BookingTitle | null {
  const parts = summary.split(SEPARATOR);
  if (parts.length < 2) return null;
  const client = parts[0].trim();
  if (!client || client.length > 160 || !/\p{L}/u.test(client)) return null;
  const rest = parts.slice(1).join(' — ');
  const services = rest
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (services.length === 0) return null;
  return { client, services };
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** The menu service a booked item refers to: longest menu name the item starts with. */
export function matchService(item: string, menu: KnownService[]): KnownService | null {
  const target = normalize(item);
  let best: KnownService | null = null;
  for (const service of menu) {
    const name = normalize(service.name);
    if (!name) continue;
    if (
      (target === name || target.startsWith(`${name} `)) &&
      name.length > normalize(best?.name ?? '').length
    ) {
      best = service;
    }
  }
  return best;
}

export function planSync(input: {
  events: CalendarEvent[];
  existing: ExistingAppointment[];
  clients: KnownClient[];
  services: KnownService[];
  now: Date;
}): SyncPlan {
  const { events, existing, clients, services, now } = input;
  const from = now.getTime() - SYNC_PAST_DAYS * 86_400_000;
  const to = now.getTime() + SYNC_FUTURE_DAYS * 86_400_000;
  const nowIso = now.toISOString();

  const clientByName = new Map(clients.map((c) => [normalize(c.fullName), c]));
  const byRef = new Map(
    existing.filter((a) => a.externalRef).map((a) => [a.externalRef as string, a])
  );
  const plan: SyncPlan = { newClients: [], inserts: [], updates: [], cancels: [], skipped: [] };
  const newClientKeys = new Set<string>();
  const seen = new Set<string>();

  for (const event of events) {
    if (event.unsupported) {
      plan.skipped.push({ uid: event.uid, reason: event.unsupported.replace('_', ' ') });
      continue;
    }
    const startMs = Date.parse(event.start);
    if (startMs < from || startMs > to) continue;
    const title = parseBookingTitle(event.summary);
    if (!title) {
      plan.skipped.push({ uid: event.uid, reason: 'not a booking' });
      continue;
    }
    seen.add(event.uid);

    const matched = title.services
      .map((item) => matchService(item, services))
      .filter((s): s is KnownService => s !== null);
    const primary = matched[0] ?? null;
    const clientKey = normalize(title.client);
    const client = clientByName.get(clientKey) ?? null;
    if (!client && !newClientKeys.has(clientKey)) {
      newClientKeys.add(clientKey);
      plan.newClients.push(title.client);
    }

    const draft: AppointmentDraft = {
      externalRef: event.uid,
      clientName: title.client,
      clientId: client?.id ?? null,
      serviceId: primary?.id ?? null,
      clientLabel: title.client,
      serviceLabel: title.services.join(', '),
      startsAt: event.start,
      endsAt: event.end,
      priceCents: matched.reduce((sum, s) => sum + s.priceCents, 0),
      depositCents: primary?.depositCents ?? 0,
      status: event.cancelled ? 'cancelled' : 'booked'
    };

    const current = byRef.get(event.uid);
    if (!current) {
      // A booking that was cancelled before we ever saw it isn't worth importing.
      if (!event.cancelled) plan.inserts.push(draft);
      continue;
    }

    const patch: Partial<AppointmentDraft> = {};
    if (current.startsAt !== draft.startsAt) patch.startsAt = draft.startsAt;
    if (current.endsAt !== draft.endsAt) patch.endsAt = draft.endsAt;
    if (current.clientLabel !== draft.clientLabel) {
      patch.clientLabel = draft.clientLabel;
      patch.clientName = draft.clientName;
      patch.clientId = draft.clientId;
    }
    if (current.serviceLabel !== draft.serviceLabel) {
      patch.serviceLabel = draft.serviceLabel;
      patch.serviceId = draft.serviceId;
    }
    // Never overwrite a price the owner set; fill one in once the menu matches.
    if (current.priceCents === 0 && draft.priceCents > 0) {
      patch.priceCents = draft.priceCents;
      patch.depositCents = draft.depositCents;
      patch.serviceId ??= draft.serviceId;
    }
    const open = current.status === 'booked' || current.status === 'confirmed';
    if (event.cancelled && open) patch.status = 'cancelled';
    if (!event.cancelled && current.status === 'cancelled' && draft.startsAt > nowIso) {
      patch.status = 'booked';
    }
    if (Object.keys(patch).length > 0) plan.updates.push({ id: current.id, patch });
  }

  // Upcoming bookings that vanished from the calendar were cancelled in Nailzy.
  // An empty feed is far more likely a broken link than a wiped diary.
  if (seen.size > 0) {
    for (const appt of existing) {
      if (!appt.externalRef || seen.has(appt.externalRef)) continue;
      const startMs = Date.parse(appt.startsAt);
      const open = appt.status === 'booked' || appt.status === 'confirmed';
      if (open && appt.startsAt > nowIso && startMs <= to) plan.cancels.push(appt.id);
    }
  }
  return plan;
}
