import 'server-only';

import type { Repositories } from '@/server/data/types';
import { readEnv } from '@/server/env';
import { AppError, isAppError } from '@/server/errors';

import { demoFeed } from '../sync/demo-feed';
import { parseIcs } from '../sync/ics';
import { planSync } from '../sync/plan';

const MAX_FEED_BYTES = 5_000_000;
const WRITE_CONCURRENCY = 6;

export type SyncSummary = {
  ok: boolean;
  added: number;
  updated: number;
  cancelled: number;
  skipped: number;
  message: string | null;
};

/** The configured Nailzy calendar feed, or the sample feed in preview mode. */
export function calendarFeedSource(mode: 'supabase' | 'demo'): 'live' | 'sample' | null {
  if (readEnv().NAILZY_CALENDAR_URL) return 'live';
  return mode === 'demo' ? 'sample' : null;
}

async function fetchFeed(rawUrl: string): Promise<string> {
  // Apple and Google hand out webcal:// links; they are plain HTTPS underneath.
  const url = new URL(rawUrl.replace(/^webcal:\/\//i, 'https://'));
  if (url.protocol !== 'https:') throw new AppError('INVALID', 'The calendar link must be https.');
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { accept: 'text/calendar' }
    });
  } catch (cause) {
    throw new AppError('UPSTREAM', 'Could not reach the calendar', { cause });
  }
  if (response.status === 404 || response.status === 403) {
    throw new AppError(
      'INVALID',
      'The calendar link was refused. It may have been reset; paste the new secret address.'
    );
  }
  if (!response.ok) throw new AppError('UPSTREAM', `Calendar responded ${response.status}`);
  const text = await response.text();
  if (text.length > MAX_FEED_BYTES) throw new AppError('INVALID', 'The calendar is too large.');
  if (!text.includes('BEGIN:VCALENDAR')) {
    throw new AppError('INVALID', 'That link didn’t return a calendar. Use the iCal address.');
  }
  return text;
}

async function inBatches<T>(items: T[], work: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += WRITE_CONCURRENCY) {
    await Promise.all(items.slice(i, i + WRITE_CONCURRENCY).map(work));
  }
}

/** Pulls Nailzy bookings from the calendar feed into appointments. Idempotent. */
export async function syncNailzyCalendar(
  repos: Repositories,
  opts: { mode: 'supabase' | 'demo'; timeZone: string; now?: Date }
): Promise<SyncSummary> {
  const now = opts.now ?? new Date();
  const source = calendarFeedSource(opts.mode);
  if (!source) throw new AppError('INVALID', 'Add your Nailzy calendar link first.');
  const runs = repos.entities('kouture.sync_runs');

  try {
    const text =
      source === 'live'
        ? await fetchFeed(readEnv().NAILZY_CALENDAR_URL as string)
        : demoFeed(now, opts.timeZone);
    const events = parseIcs(text, opts.timeZone);

    const appointments = repos.entities('kouture.appointments');
    const clients = repos.entities('kouture.clients');
    const [existing, knownClients, services] = await Promise.all([
      appointments.list({ eq: { source: 'nailzy' } }),
      clients.list(),
      repos.entities('kouture.services').list({ eq: { active: true } })
    ]);
    const plan = planSync({ events, existing, clients: knownClients, services, now });

    const clientIds = new Map(knownClients.map((c) => [c.fullName.toLowerCase(), c.id]));
    for (const fullName of plan.newClients) {
      const created = await clients.insert({ fullName, source: 'nailzy' });
      clientIds.set(fullName.toLowerCase(), created.id);
    }
    const resolve = (name: string | undefined, id: string | null | undefined) =>
      id ?? (name ? (clientIds.get(name.toLowerCase()) ?? null) : null);

    let added = 0;
    let conflicts = 0;
    await inBatches(plan.inserts, async ({ clientName, ...draft }) => {
      try {
        await appointments.insert({
          ...draft,
          clientId: resolve(clientName, draft.clientId),
          source: 'nailzy'
        });
        added++;
      } catch (error) {
        // A sync running at the same moment already added it.
        if (isAppError(error) && error.code === 'CONFLICT') conflicts++;
        else throw error;
      }
    });
    await inBatches(plan.updates, async ({ id, patch: { clientName, ...patch } }) => {
      if ('clientLabel' in patch) patch.clientId = resolve(clientName, patch.clientId);
      await appointments.update(id, patch);
    });
    await inBatches(plan.cancels, async (id) => {
      await appointments.update(id, { status: 'cancelled' });
    });

    const summary: SyncSummary = {
      ok: true,
      added,
      updated: plan.updates.length,
      cancelled: plan.cancels.length,
      skipped: plan.skipped.length + conflicts,
      message: source === 'sample' ? 'Sample bookings (preview mode)' : null
    };
    await runs.insert({ source: 'nailzy_calendar', ranAt: now.toISOString(), ...summary });
    return summary;
  } catch (error) {
    const message =
      isAppError(error) && error.code !== 'UPSTREAM'
        ? error.message
        : 'The calendar couldn’t be read. Try again in a few minutes.';
    if (!isAppError(error) || error.code === 'UPSTREAM') console.error('[nailzy-sync]', error);
    await runs
      .insert({ source: 'nailzy_calendar', ranAt: now.toISOString(), ok: false, message })
      .catch((logError) => console.error('[nailzy-sync] could not record the run', logError));
    return { ok: false, added: 0, updated: 0, cancelled: 0, skipped: 0, message };
  }
}
