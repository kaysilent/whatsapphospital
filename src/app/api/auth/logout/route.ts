import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const response = NextResponse.json({ success: true });

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      try {
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
              setAll(cookiesToSet) {
                try {
                  cookiesToSet.forEach(({ name, value, options }) => {
                    cookieStore.set(name, value, options);
                    response.cookies.set(name, value, options);
                  });
                } catch (err) {}
              },
            },
          }
        );
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[API Auth Logout] Supabase signout notice:', err);
      }
    }

    // Always clear demo session cookie
    response.cookies.set('wacrm_demo_session', '', {
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to logout' }, { status: 500 });
  }
}

