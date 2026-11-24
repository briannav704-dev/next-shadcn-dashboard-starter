import 'server-only';

import { z } from 'zod';

import { isAppError, publicMessage } from '@/server/errors';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Wraps a server action body: validates input, maps errors to safe messages,
 * and logs unexpected failures server-side (Sentry picks these up).
 */
export async function runAction<TSchema extends z.ZodType, TResult>(
  schema: TSchema,
  input: unknown,
  body: (data: z.infer<TSchema>) => Promise<TResult>
): Promise<ActionResult<TResult>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  try {
    return { ok: true, data: await body(parsed.data) };
  } catch (error) {
    if (!isAppError(error) || error.code === 'UPSTREAM') {
      console.error('[action]', error);
    }
    return { ok: false, error: publicMessage(error) };
  }
}
