'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { type ActionResult, runAction } from '@/server/action-result';
import { ENTITIES, type EntityKey, isEntityKey } from '@/server/entities/definitions';
import { AppError } from '@/server/errors';
import { requireOwnerAction } from '@/server/session';

// Generic create/update/delete for My Life records. The entity key is checked
// against the registry, the payload is validated by that entity's schema inside
// the collection, and RLS scopes every write to the owner.

const keySchema = z.string().refine(isEntityKey, 'Unknown record type.');
const idSchema = z.string().min(1).max(64);
const payloadSchema = z.record(z.string(), z.unknown());

function refresh(key: EntityKey) {
  for (const path of ENTITIES[key].paths) revalidatePath(path);
}

export async function createEntityAction(input: {
  entity: string;
  values: Record<string, unknown>;
}): Promise<ActionResult<{ id: string }>> {
  return runAction(
    z.object({ entity: keySchema, values: payloadSchema }),
    input,
    async ({ entity, values }) => {
      const { repos } = await requireOwnerAction();
      const row = await repos.entities(entity as EntityKey).insert(values as never);
      refresh(entity as EntityKey);
      return { id: (row as { id: string }).id };
    }
  );
}

export async function updateEntityAction(input: {
  entity: string;
  id: string;
  values: Record<string, unknown>;
}): Promise<ActionResult> {
  return runAction(
    z.object({ entity: keySchema, id: idSchema, values: payloadSchema }),
    input,
    async ({ entity, id, values }) => {
      const { repos } = await requireOwnerAction();
      await repos.entities(entity as EntityKey).update(id, values as never);
      refresh(entity as EntityKey);
      return undefined;
    }
  );
}

export async function upsertEntityAction(input: {
  entity: string;
  values: Record<string, unknown>;
}): Promise<ActionResult> {
  return runAction(
    z.object({ entity: keySchema, values: payloadSchema }),
    input,
    async ({ entity, values }) => {
      if (!('uniqueBy' in ENTITIES[entity as EntityKey]))
        throw new AppError('INVALID', 'Cannot save this way.');
      const { repos } = await requireOwnerAction();
      await repos.entities(entity as EntityKey).upsert(values as never);
      refresh(entity as EntityKey);
      return undefined;
    }
  );
}

export async function deleteEntityAction(input: {
  entity: string;
  id: string;
}): Promise<ActionResult> {
  return runAction(z.object({ entity: keySchema, id: idSchema }), input, async ({ entity, id }) => {
    const { repos } = await requireOwnerAction();
    await repos.entities(entity as EntityKey).remove(id);
    refresh(entity as EntityKey);
    return undefined;
  });
}
