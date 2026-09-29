import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { pathname, searchParams } = request.nextUrl
  const isLoginPage = pathname === '/login'
  const isJoinPage = pathname.startsWith('/join')
  const isAuthCallback = pathname.startsWith('/auth')
  const isDemoPage = pathname === '/demo' || pathname.startsWith('/demo/')
  const isPaymentPage = pathname.startsWith('/pay')
  const isPublicApi = pathname.startsWith('/api/whatsapp/webhook') || 
                      pathname.startsWith('/api/ai/') || 
                      pathname.startsWith('/api/calendar/') || 
                      pathname.startsWith('/api/payments/') || 
                      pathname.startsWith('/api/v1') || 
                      pathname.startsWith('/api/invitations') || 
                      pathname.startsWith('/api/auth')
  const isPublic = isLoginPage || isJoinPage || isAuthCallback || isDemoPage || isPaymentPage || isPublicApi

  // Check demo session cookie
  const hasDemoCookie = request.cookies.get('wacrm_demo_session')?.value === '1'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  let user = null

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
    try {
      const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
              cookiesToSet.forEach(({ name, value, options }) =>
                supabaseResponse.cookies.set(name, value, options)
              )
            },
          },
        }
      )

      const { data } = await supabase.auth.getUser()
      user = data?.user ?? null
    } catch (err) {
      console.warn('[Middleware] Supabase refresh notice:', err)
    }
  }

  const isAuthenticated = !!user || (hasDemoCookie && process.env.NODE_ENV !== 'test')

  // Helper to construct a redirect response preserving cookies
  const redirectWithCookies = (url: URL | string) => {
    const redirectRes = NextResponse.redirect(url)
    // Copy all cookies from supabaseResponse and request
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectRes.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectRes
  }

  // Redirect signed-in user off /login
  if (user && isLoginPage) {
    const inviteToken = searchParams.get('invite')
    if (inviteToken) {
      return redirectWithCookies(new URL(`/join/${inviteToken}`, request.url))
    }
    return redirectWithCookies(new URL('/dashboard', request.url))
  }

  // Return 401 JSON for unauthenticated API calls, redirect browser pages to /login
  if (!isAuthenticated && !isPublic) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url)
    return redirectWithCookies(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
