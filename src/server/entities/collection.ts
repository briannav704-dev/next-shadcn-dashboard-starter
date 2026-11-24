import { AppError } from '@/server/errors';

import {
  ENTITIES,
  type CleanInputOf,
  type EntityKey,
  type InputOf,
  type RowOf
} from './definitions';

type Scalar = string | number | boolean | null;

export type Query<TRow> = {
  eq?: Partial<Record<keyof TRow & string, Scalar>>;
  range?: { field: keyof TRow & string; gte?: string; lte?: string; lt?: string };
  order?: { field: keyof TRow & string; ascending?: boolean }[];
  limit?: number;
};

export interface Collection<K extends EntityKey> {
  list(query?: Query<RowOf<K>>): Promise<RowOf<K>[]>;
  get(id: string): Promise<RowOf<K>>;
  insert(input: InputOf<K>): Promise<RowOf<K>>;
  /** Merges the patch into the stored record and re-validates the whole thing. */
  update(id: string, patch: Partial<InputOf<K>>): Promise<RowOf<K>>;
  /** Insert or replace by the entity's `uniqueBy` fields (e.g. one journal entry per day). */
  upsert(input: InputOf<K>): Promise<RowOf<K>>;
  remove(id: string): Promise<void>;
}

export type EntityAccess = <K extends EntityKey>(key: K) => Collection<K>;

export function validateInput<K extends EntityKey>(key: K, input: unknown): CleanInputOf<K> {
  const result = ENTITIES[key].input.safeParse(input);
  if (!result.success) {
    throw new AppError('INVALID', result.error.issues[0]?.message ?? 'Please check the form.');
  }
  return result.data as CleanInputOf<K>;
}

/** The writable fields of a stored row, so an update can be re-validated as a whole. */
export function writableFields<K extends EntityKey>(
  key: K,
  row: RowOf<K>
): Record<string, unknown> {
  const shape = ENTITIES[key].input.shape as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of Object.keys(shape)) out[field] = (row as Record<string, unknown>)[field];
  return out;
}

export function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function toCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function snakeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toSnake(k), v]));
}

export function camelKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [toCamel(k), v]));
}
