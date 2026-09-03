import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const response = NextResponse.json({ success: true });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

    return NextResponse.json({ success: true }, { headers: response.headers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to logout' }, { status: 500 });
  }
}
