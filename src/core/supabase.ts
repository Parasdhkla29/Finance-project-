import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env and fill in your project credentials.',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

// ── camelCase ↔ snake_case converters ─────────────────────────────────────

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
}

/**
 * Convert a camelCase TypeScript object to snake_case for Supabase insertion/update.
 * undefined values are converted to null so PostgreSQL columns are explicitly cleared.
 */
export function toDb(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value === undefined ? null : value;
  }
  return result;
}

/**
 * Convert a snake_case DB row to a camelCase TypeScript object.
 * null values are converted to undefined to match optional TypeScript fields.
 */
export function fromDb<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamel(key)] = value === null ? undefined : value;
  }
  return result as T;
}

/** Convert an array of DB rows to typed TypeScript objects. */
export function fromDbArray<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => fromDb<T>(r));
}
