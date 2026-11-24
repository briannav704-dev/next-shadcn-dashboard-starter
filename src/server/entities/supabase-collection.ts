import 'server-only';

import { AppError } from '@/server/errors';
import type { SupabaseServerClient } from '@/server/supabase';

import {
  type Collection,
  type EntityAccess,
  type Query,
  camelKeys,
  snakeKeys,
  toSnake,
  validateInput,
  writableFields
} from './collection';
import { ENTITIES, type EntityKey, type RowOf } from './definitions';

type PgError = { message: string; code?: string };

function fail(error: PgError, what: string): never {
  if (error.code === '42501') throw new AppError('FORBIDDEN', `Not allowed to ${what}.`);
  if (error.code === 'PGRST116') throw new AppError('NOT_FOUND', 'That item no longer exists.');
  if (error.code === '23505') throw new AppError('CONFLICT', 'That already exists.');
  if (error.code === '23514') throw new AppError('INVALID', 'Some values are out of range.');
  throw new AppError('UPSTREAM', `Failed to ${what}`, { cause: error });
}

export function createSupabaseEntities(db: SupabaseServerClient): EntityAccess {
  function collection<K extends EntityKey>(key: K): Collection<K> {
    const def = ENTITIES[key];
    const table = () => db.schema(def.schema).from(def.table);
    const parseRow = (raw: unknown) =>
      def.row.parse(camelKeys(raw as Record<string, unknown>)) as RowOf<K>;

    const self: Collection<K> = {
      async list(query: Query<RowOf<K>> = {}) {
        let q = table().select('*');
        for (const [field, value] of Object.entries(query.eq ?? {})) {
          q =
            value === null
              ? q.is(toSnake(field), null)
              : q.eq(toSnake(field), value as string | number | boolean);
        }
        if (query.range) {
          const col = toSnake(query.range.field);
          if (query.range.gte !== undefined) q = q.gte(col, query.range.gte);
          if (query.range.lte !== undefined) q = q.lte(col, query.range.lte);
          if (query.range.lt !== undefined) q = q.lt(col, query.range.lt);
        }
        for (const o of query.order ?? [])
          q = q.order(toSnake(o.field), { ascending: o.ascending ?? true });
        if (query.limit) q = q.limit(query.limit);
        const { data, error } = await q;
        if (error) fail(error, `load ${def.table.replace(/_/g, ' ')}`);
        return (data ?? []).map(parseRow);
      },
      async get(id) {
        const { data, error } = await table().select('*').eq('id', id).single();
        if (error) fail(error, 'load that item');
        return parseRow(data);
      },
      async insert(input) {
        const clean = validateInput(key, input);
        const { data, error } = await table()
          .insert(snakeKeys(clean as Record<string, unknown>))
          .select('*')
          .single();
        if (error) fail(error, 'save that');
        return parseRow(data);
      },
      async update(id, patch) {
        const current = await self.get(id);
        const clean = validateInput(key, { ...writableFields(key, current), ...patch });
        const { data, error } = await table()
          .update(snakeKeys(clean as Record<string, unknown>))
          .eq('id', id)
          .select('*')
          .single();
        if (error) fail(error, 'update that');
        return parseRow(data);
      },
      async upsert(input) {
        const unique = 'uniqueBy' in def ? (def.uniqueBy as string[] | undefined) : undefined;
        if (!unique) throw new AppError('INVALID', 'This record cannot be upserted.');
        const clean = validateInput(key, input);
        const { data, error } = await table()
          .upsert(snakeKeys(clean as Record<string, unknown>), {
            onConflict: ['owner_id', ...unique.map(toSnake)].join(',')
          })
          .select('*')
          .single();
        if (error) fail(error, 'save that');
        return parseRow(data);
      },
      async remove(id) {
        const { error, count } = await table().delete({ count: 'exact' }).eq('id', id);
        if (error) fail(error, 'delete that');
        if (count === 0) throw new AppError('NOT_FOUND', 'That item no longer exists.');
      }
    };
    return self;
  }
  return collection;
}
