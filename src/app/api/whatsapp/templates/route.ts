import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentAccount } from '@/lib/auth/account'

export async function GET() {
  try {
    const supabase = await createClient()

    let accountId: string | null = null
    let userId: string | null = null

    try {
      const ctx = await getCurrentAccount()
      accountId = ctx.accountId
      userId = ctx.userId
    } catch {
      // If auth fails, try to see if user has a session directly
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
      }
    }

    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = admin
      .from('message_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (accountId) {
      query = query.or(`account_id.eq.${accountId},account_id.is.null`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching message_templates:', error)
      return NextResponse.json(
        { success: false, error: error.message, templates: [] },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      templates: data || [],
    })
  } catch (error) {
    console.error('Error in templates GET:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        templates: [],
      },
      { status: 500 },
    )
  }
}
