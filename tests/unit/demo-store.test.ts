import { beforeEach, describe, expect, it } from 'vitest';

import { createDemoRepositories, resetDemoStore } from '@/server/data/demo-store';
import { isAppError } from '@/server/errors';

describe('sample-data store mirrors database rules', () => {
  beforeEach(() => resetDemoStore());

  it('only lets a pending approval be decided once, and audits it', async () => {
    const repos = createDemoRepositories();
    const [first] = await repos.core.listApprovals({ status: 'pending' });
    await repos.core.decideApproval(first.id, 'approved', 'ok');
    await expect(repos.core.decideApproval(first.id, 'rejected', null)).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.code === 'CONFLICT'
    );
    const audit = await repos.core.listAudit({ limit: 10 });
    expect(audit[0]).toMatchObject({ domain: 'core', entityType: 'approvals', entityId: first.id });
    expect(await repos.core.countPendingApprovals()).toBe(2);
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
});
