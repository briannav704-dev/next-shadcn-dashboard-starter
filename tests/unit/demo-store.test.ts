import { beforeEach, describe, expect, it } from 'vitest';

import { createDemoRepositories, resetDemoStore } from '@/server/data/demo-store';
import { isAppError } from '@/server/errors';

describe('sample-data store mirrors database rules', () => {
  beforeEach(() => resetDemoStore());

  it('only lets a pending approval be decided once, and audits it', async () => {
    const repos = createDemoRepositories();
    const pendingBefore = await repos.core.countPendingApprovals();
    const [first] = await repos.core.listApprovals({ status: 'pending' });
    await repos.core.decideApproval(first.id, 'approved', 'ok');
    await expect(repos.core.decideApproval(first.id, 'rejected', null)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'CONFLICT'
    );
    const audit = await repos.core.listAudit({ limit: 10 });
    expect(audit[0]).toMatchObject({ domain: 'core', entityType: 'approvals', entityId: first.id });
    expect(await repos.core.countPendingApprovals()).toBe(pendingBefore - 1);
  });

  it('audits task and habit changes in the life domain', async () => {
    const repos = createDemoRepositories();
    const [task] = await repos.life.listOpenTasks(1);
    await repos.life.setTaskDone(task.id, true);
    const [habit] = await repos.life.listHabits({ fromDay: '2000-01-01', toDay: '2100-01-01' });
    await repos.life.setHabitLogged(habit.id, '2026-11-24', true);
    const audit = await repos.core.listAudit({ domain: 'life', limit: 10 });
    expect(audit.map((a) => a.entityType)).toEqual(['habit_logs', 'tasks']);
  });

  it('rejects unknown ids with NOT_FOUND', async () => {
    const repos = createDemoRepositories();
    await expect(repos.life.setTaskDone('nope', true)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'NOT_FOUND'
    );
  });

  it('files agent work like the database: deduped, attributed, declined requests not refiled', async () => {
    const repos = createDemoRepositories();
    const approval = {
      kind: 'approval' as const,
      sourceKey: 'inv:restock:test',
      actionType: 'make_purchase' as const,
      title: 'Restock',
      summary: 'Gel ×2',
      payload: {},
      risk: 'medium' as const
    };
    const before = await repos.core.countPendingApprovals();
    await repos.team.file('inventory_manager', approval);
    await repos.team.file('inventory_manager', approval);
    expect(await repos.core.countPendingApprovals()).toBe(before + 1);
    const [filed] = await repos.core.listApprovals({ status: 'pending', limit: 1 });
    await repos.core.decideApproval(filed.id, 'rejected', null);
    await repos.team.file('inventory_manager', approval);
    expect(await repos.core.countPendingApprovals()).toBe(before);

    const task = {
      kind: 'task' as const,
      sourceKey: 'inv:low',
      title: 'Low',
      severity: 'attention' as const
    };
    await repos.team.file('inventory_manager', task);
    await repos.team.file('inventory_manager', { ...task, title: 'Lower' });
    const open = await repos.team.listTasks({ status: 'open' });
    expect(open.map((t) => t.title)).toEqual(['Lower']);
    const audit = await repos.core.listAudit({ limit: 1 });
    expect(audit[0]).toMatchObject({ actorType: 'agent', actorId: 'inventory_manager' });
  });
});

describe('completing approved requests', () => {
  beforeEach(() => resetDemoStore());

  it('runs an approved request once and refuses pending or finished ones', async () => {
    const repos = createDemoRepositories();
    const [first] = await repos.core.listApprovals({ status: 'pending' });
    await expect(repos.core.completeApproval(first.id, 'executed', 'x')).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'CONFLICT'
    );
    await repos.core.decideApproval(first.id, 'approved', 'ok');
    const done = await repos.core.completeApproval(first.id, 'executed', 'Sent 3.');
    expect(done).toMatchObject({ status: 'executed', decisionNote: 'ok\nSent 3.' });
    await expect(repos.core.completeApproval(first.id, 'executed', 'again')).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'CONFLICT'
    );
  });
});
