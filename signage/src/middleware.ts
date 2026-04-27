import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Keeps the Supabase auth cookie alive across navigation. Without this the
 * access token silently expires and Server Component calls to getUser() start
 * returning null even though the user is still "logged in" client-side.
 */
export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: req.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request: { headers: req.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Skip Next internals and the public player feed (unauthenticated).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/player|player).*)'],
};
