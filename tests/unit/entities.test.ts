import { beforeEach, describe, expect, it } from 'vitest';

import { createDemoRepositories, resetDemoStore } from '@/server/data/demo-store';
import { isAppError } from '@/server/errors';

const code = (c: string) => (e: unknown) => isAppError(e) && e.code === c;

describe('entity collections (sample-data implementation)', () => {
  beforeEach(() => resetDemoStore());

  it('validates input with the entity schema', async () => {
    const { entities } = createDemoRepositories();
    await expect(
      entities('life.transactions').insert({
        occurredOn: '2026-11-24',
        kind: 'expense',
        amountCents: 0,
        description: 'x'
      })
    ).rejects.toSatisfy(code('INVALID'));
    await expect(
      entities('life.trips').insert({
        name: 'x',
        destination: 'y',
        startsOn: '2026-12-10',
        endsOn: '2026-12-01'
      })
    ).rejects.toSatisfy(code('INVALID'));
  });

  it('re-validates the whole record on update', async () => {
    const { entities } = createDemoRepositories();
    const trip = await entities('life.trips').insert({
      name: 'Paris',
      destination: 'Paris',
      startsOn: '2027-04-01',
      endsOn: '2027-04-05'
    });
    await expect(
      entities('life.trips').update(trip.id, { endsOn: '2027-03-01' })
    ).rejects.toSatisfy(code('INVALID'));
    const updated = await entities('life.trips').update(trip.id, { status: 'booked' });
    expect(updated).toMatchObject({ status: 'booked', endsOn: '2027-04-05' });
  });

  it('upserts one journal entry per day', async () => {
    const { entities } = createDemoRepositories();
    const journal = entities('life.journal_entries');
    await journal.upsert({ entryOn: '2030-01-01', mood: 3, body: 'first' });
    await journal.upsert({ entryOn: '2030-01-01', mood: 5, body: 'second' });
    const rows = await journal.list({ eq: { entryOn: '2030-01-01' } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mood: 5, body: 'second' });
  });

  it('cascades and nulls foreign keys like the database', async () => {
    const { entities } = createDemoRepositories();
    const goal = await entities('life.savings_goals').insert({ name: 'Car', targetCents: 100000 });
    await entities('life.savings_contributions').insert({
      goalId: goal.id,
      amountCents: 5000,
      contributedOn: '2026-11-24'
    });
    await entities('life.savings_goals').remove(goal.id);
    expect(
      await entities('life.savings_contributions').list({ eq: { goalId: goal.id } })
    ).toHaveLength(0);

    const category = await entities('life.budget_categories').insert({ name: 'Treats' });
    const txn = await entities('life.transactions').insert({
      occurredOn: '2026-11-24',
      kind: 'expense',
      amountCents: 500,
      categoryId: category.id,
      description: 'Latte'
    });
    await entities('life.budget_categories').remove(category.id);
    expect((await entities('life.transactions').get(txn.id)).categoryId).toBeNull();

    await expect(
      entities('life.trip_items').insert({ tripId: 'missing', kind: 'packing', title: 'SPF' })
    ).rejects.toSatisfy(code('INVALID'));
  });

  it('audits writes without journal contents', async () => {
    const repos = createDemoRepositories();
    await repos
      .entities('life.journal_entries')
      .upsert({ entryOn: '2030-02-02', body: 'secret thoughts' });
    const [entry] = await repos.core.listAudit({ domain: 'life', limit: 1 });
    expect(entry.entityType).toBe('journal_entries');
    expect(entry.summary).not.toContain('secret');
  });
});
