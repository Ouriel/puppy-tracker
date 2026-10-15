import { describe, it, expect } from 'vitest';
import { is, SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect, type PgColumn, type PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../schema';

// The hand-written migrations in file order (migrations/README.md), comments removed
const files = import.meta.glob<string>('/migrations/*.sql', { query: '?raw', import: 'default', eager: true });
const migrationsSql = Object.keys(files)
  .sort()
  .map((path) => files[path])
  .join('\n')
  .replace(/--.*$/gm, '');

const tables = Object.values(schema).map((table) => getTableConfig(table as PgTable));
const dialect = new PgDialect();

/** The default as SQL text: now() for defaultNow(), 200, 'ACTIVE'; null without one. */
function defaultSql(column: PgColumn): string | null {
  if (!column.hasDefault) return null;
  if (is(column.default, SQL)) return dialect.sqlToQuery(column.default).sql;
  return typeof column.default === 'string' ? `'${column.default}'` : String(column.default);
}

/** "table.column" → its definition ("text NOT NULL DEFAULT ..."), from CREATE TABLE and ADD COLUMN. */
function migratedColumns(): Map<string, string> {
  const columns = new Map<string, string>();
  for (const [, table, body] of migrationsSql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([^;]*)\);/g)) {
    for (const line of body.split(',\n')) {
      const [, column, definition] = line.trim().match(/^"?(\w+)"? (.*)$/s) ?? [];
      if (column && column !== 'CONSTRAINT') columns.set(`${table}.${column}`, definition);
    }
  }
  for (const [, table, column, definition] of migrationsSql.matchAll(/ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS "?(\w+)"? ([^;]*);/g)) {
    columns.set(`${table}.${column}`, definition);
  }
  return columns;
}

describe('migrations/ build the schema of src/db/schema.ts', () => {
  it('every column, with its type, primary key, NOT NULL and default value, and no other column', () => {
    const migrated = migratedColumns();
    const described = tables.flatMap(({ name, columns }) =>
      columns.map((column) => {
        const definition = migrated.get(`${name}.${column.name}`) ?? '';
        return {
          column: `${name}.${column.name}`,
          type: definition.startsWith(column.getSQLType()) ? column.getSQLType() : definition,
          primaryKey: /PRIMARY KEY/.test(definition),
          notNull: /NOT NULL|PRIMARY KEY/.test(definition),
          default: definition.match(/DEFAULT (\S+)/)?.[1] ?? null,
        };
      })
    );
    const expected = tables.flatMap(({ name, columns }) =>
      columns.map((column) => ({
        column: `${name}.${column.name}`,
        type: column.getSQLType(),
        primaryKey: column.primary,
        notNull: column.notNull,
        default: defaultSql(column),
      }))
    );

    expect(described).toEqual(expected);
    expect([...migrated.keys()].sort()).toEqual(expected.map(({ column }) => column).sort());
  });

  it('every index, on the same columns and order, and every unique column', () => {
    const indexes = [...migrationsSql.matchAll(/CREATE INDEX IF NOT EXISTS (\w+) ON (\w+) \(([^)]*)\)/g)]
      .map(([, name, table, columns]) => `${table}.${name} (${columns.replaceAll('"', '')})`)
      .sort();
    const uniques = [...migrationsSql.matchAll(/CONSTRAINT (\w+) UNIQUE \((\w+)\)/g)].map(([, name, column]) => `${name} (${column})`).sort();

    expect(indexes).toEqual(
      tables
        .flatMap(({ name, indexes: tableIndexes }) =>
          tableIndexes.map(({ config }) => {
            const columns = config.columns.map((column) => {
              const indexed = column as { name: string; indexConfig?: { order?: string } };
              return indexed.indexConfig?.order === 'desc' ? `${indexed.name} DESC` : indexed.name;
            });
            return `${name}.${config.name} (${columns.join(', ')})`;
          })
        )
        .sort()
    );
    expect(uniques).toEqual(
      tables.flatMap(({ columns }) => columns.filter((column) => column.isUnique).map((column) => `${column.uniqueName} (${column.name})`)).sort()
    );
  });
});
