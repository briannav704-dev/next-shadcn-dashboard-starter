import { type NextRequest, NextResponse } from 'next/server';

import { readEnv } from '@/server/env';
import { createSupabaseServerClient } from '@/server/supabase';

function safeNext(value: string | null) {
  // Only allow same-site relative paths to avoid open redirects.
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/life';
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const db = await createSupabaseServerClient();
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (!error && data.user?.email?.toLowerCase() === readEnv().OWNER_EMAIL) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    await db.auth.signOut();
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
