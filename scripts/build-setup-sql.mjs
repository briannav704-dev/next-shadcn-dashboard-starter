#!/usr/bin/env node
// Bundles every migration into supabase/setup.sql: one file to copy and paste
// into the Supabase SQL Editor (works from an iPad, no terminal needed).
// Usage: node scripts/build-setup-sql.mjs [--check]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dir = join(root, 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const header = `-- ============================================================================
-- Kouture Life OS — complete database setup
-- GENERATED from supabase/migrations by scripts/build-setup-sql.mjs. Do not edit.
--
-- How to use: Supabase → SQL Editor → New query → paste this whole file → Run.
-- Run it ONCE on a new, empty project. Expected result: "Success. No rows returned".
-- ============================================================================
`;
const body = files
  .map((f) => `\n-- ─── ${f} ${'─'.repeat(Math.max(0, 70 - f.length))}\n\n${readFileSync(join(dir, f), 'utf8').trim()}\n`)
  .join('');
const output = `${header}${body}`;
const target = join(root, 'supabase', 'setup.sql');

if (process.argv.includes('--check')) {
  const current = readFileSync(target, 'utf8');
  if (current !== output) {
    console.error('supabase/setup.sql is out of date. Run: node scripts/build-setup-sql.mjs');
    process.exit(1);
  }
  console.log('supabase/setup.sql is up to date');
} else {
  writeFileSync(target, output);
  console.log(`Wrote supabase/setup.sql from ${files.length} migrations`);
}
