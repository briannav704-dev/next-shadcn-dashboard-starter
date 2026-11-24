import 'server-only';

import { AppError } from '@/server/errors';

import {
  type Collection,
  type EntityAccess,
  type Query,
  validateInput,
  writableFields
} from './collection';
import { ENTITIES, type EntityKey, type RowOf } from './definitions';

export type DemoRow = Record<string, unknown> & { id: string };
export type DemoTables = Partial<Record<EntityKey, DemoRow[]>>;

export type DemoBackend = {
  tables: () => DemoTables;
  nextId: (prefix: string) => string;
  audit: (entry: {
    domain: 'life' | 'kouture';
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
  }) => void;
};

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1; // nulls last, like the database default we ask for
  if (b === null || b === undefined) return -1;
  return String(a).localeCompare(String(b), undefined, { numeric: typeof a === 'number' });
}

function matches(row: DemoRow, query: Query<Record<string, unknown>>): boolean {
  for (const [field, value] of Object.entries(query.eq ?? {})) {
    if ((row[field] ?? null) !== value) return false;
  }
  if (query.range) {
    const v = row[query.range.field] as string | null | undefined;
    if (v === null || v === undefined) return false;
    if (query.range.gte !== undefined && v < query.range.gte) return false;
    if (query.range.lte !== undefined && v > query.range.lte) return false;
    if (query.range.lt !== undefined && v >= query.range.lt) return false;
  }
  return true;
}

/**
 * In-memory implementation of the entity collections. It applies the same
 * validation as the database path, plus the unique keys and foreign keys the
 * database would enforce, and writes an audit entry for every change.
 */
export function createDemoEntities(backend: DemoBackend): EntityAccess {
  const rowsOf = (key: EntityKey): DemoRow[] => {
    const tables = backend.tables();
    tables[key] ??= [];
    return tables[key];
  };

  function audit(key: EntityKey, action: 'insert' | 'update' | 'delete', row: DemoRow) {
    const def = ENTITIES[key];
    const label = (def.label as (r: unknown) => string)(row);
    backend.audit({
      domain: def.schema,
      action,
      entityType: def.table,
      entityId: row.id,
      summary: `${action[0].toUpperCase()}${action.slice(1)} ${def.table.replace(/_/g, ' ')}: ${label}`
    });
  }

  function checkRefs(key: EntityKey, clean: Record<string, unknown>) {
    const refs = ('refs' in ENTITIES[key] ? ENTITIES[key].refs : undefined) as
      | Record<string, { entity: EntityKey }>
      | undefined;
    for (const [field, ref] of Object.entries(refs ?? {})) {
      const value = clean[field];
      if (value && !rowsOf(ref.entity).some((r) => r.id === value)) {
        throw new AppError('INVALID', 'The linked item no longer exists.');
      }
    }
  }

  function checkUnique(key: EntityKey, clean: Record<string, unknown>, exceptId?: string) {
    const unique = ('uniqueBy' in ENTITIES[key] ? ENTITIES[key].uniqueBy : undefined) as
      | string[]
      | undefined;
    if (!unique) return;
    const clash = rowsOf(key).find(
      (r) => r.id !== exceptId && unique.every((f) => r[f] === clean[f])
    );
    if (clash) throw new AppError('CONFLICT', 'That already exists.');
  }

  function cascade(parentKey: EntityKey, parentId: string) {
    for (const [childKey, def] of Object.entries(ENTITIES) as [
      EntityKey,
      (typeof ENTITIES)[EntityKey]
    ][]) {
      const refs = ('refs' in def ? def.refs : undefined) as
        | Record<string, { entity: string; onDelete: 'cascade' | 'setNull' }>
        | undefined;
      for (const [field, ref] of Object.entries(refs ?? {})) {
        if (ref.entity !== parentKey) continue;
        const rows = rowsOf(childKey);
        const linked = rows.filter((child) => child[field] === parentId);
        for (const child of linked) {
          if (ref.onDelete === 'setNull') child[field] = null;
          else {
            rows.splice(rows.indexOf(child), 1);
            cascade(childKey, child.id);
          }
        }
      }
    }
  }

  function collection<K extends EntityKey>(key: K): Collection<K> {
    const def = ENTITIES[key];
    const copy = (row: DemoRow) => def.row.parse(structuredClone(row)) as RowOf<K>;
    const find = (id: string) => {
      const row = rowsOf(key).find((r) => r.id === id);
      if (!row) throw new AppError('NOT_FOUND', 'That item no longer exists.');
      return row;
    };

    const self: Collection<K> = {
      async list(query = {}) {
        let rows = rowsOf(key).filter((r) => matches(r, query as Query<Record<string, unknown>>));
        for (const o of [...(query.order ?? [])].reverse()) {
          rows = rows.toSorted(
            (a, b) => compare(a[o.field], b[o.field]) * (o.ascending === false ? -1 : 1)
          );
        }
        if (query.limit) rows = rows.slice(0, query.limit);
        return rows.map(copy);
      },
      async get(id) {
        return copy(find(id));
      },
      async insert(input) {
        const clean = validateInput(key, input) as Record<string, unknown>;
        checkRefs(key, clean);
        checkUnique(key, clean);
        const row: DemoRow = {
          createdAt: new Date().toISOString(),
          ...clean,
          id: backend.nextId(def.table.slice(0, 3))
        };
        rowsOf(key).push(row);
        audit(key, 'insert', row);
        return copy(row);
      },
      async update(id, patch) {
        const row = find(id);
        const clean = validateInput(key, {
          ...writableFields(key, copy(row)),
          ...patch
        }) as Record<string, unknown>;
        checkRefs(key, clean);
        checkUnique(key, clean, id);
        Object.assign(row, clean);
        audit(key, 'update', row);
        return copy(row);
      },
      async upsert(input) {
        const unique = ('uniqueBy' in def ? def.uniqueBy : undefined) as string[] | undefined;
        if (!unique) throw new AppError('INVALID', 'This record cannot be upserted.');
        const clean = validateInput(key, input) as Record<string, unknown>;
        const existing = rowsOf(key).find((r) => unique.every((f) => r[f] === clean[f]));
        return existing ? self.update(existing.id, input) : self.insert(input);
      },
      async remove(id) {
        const rows = rowsOf(key);
        const row = find(id);
        rows.splice(rows.indexOf(row), 1);
        cascade(key, id);
        audit(key, 'delete', row);
      }
    };
    return self;
  }

  return collection;
}
