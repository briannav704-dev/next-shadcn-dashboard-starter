import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/auth/callback', '/setup'];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the Supabase session cookie on every request and sends signed-out
 * visitors to /login. Pages and actions still verify the owner themselves
 * (requireOwnerPage / requireOwnerAction): this is a convenience layer, not the
 * security boundary.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  let signedIn = false;
  try {
    const supabase = createServerClient(url.trim(), key.trim(), {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        }
      }
    });
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  } catch (error) {
    // A malformed Supabase setting must not take the whole site down: /setup
    // explains which setting to fix.
    console.error('[proxy] Supabase session check failed', error);
    if (pathname === '/setup') return NextResponse.next();
    const setup = request.nextUrl.clone();
    setup.pathname = '/setup';
    setup.search = '?check=failed';
    return NextResponse.redirect(setup);
  }
  if (!signedIn && !isPublic(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'
  ]
};
