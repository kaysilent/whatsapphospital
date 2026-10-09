import { NextResponse } from 'next/server'
import { verifyPhoneNumber } from '@/lib/whatsapp/meta-api'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone_number_id, access_token } = body

    if (!phone_number_id || !phone_number_id.trim()) {
      return NextResponse.json(
        { success: false, error: 'Phone Number ID is required for testing' },
        { status: 400 }
      )
    }

    if (!access_token || !access_token.trim()) {
      return NextResponse.json(
        { success: false, error: 'Access Token is required for testing' },
        { status: 400 }
      )
    }

    const trimmedToken = access_token.trim()
    const trimmedPhoneId = phone_number_id.trim()

    try {
      const phoneInfo = await verifyPhoneNumber({
        phoneNumberId: trimmedPhoneId,
        accessToken: trimmedToken,
      })

      return NextResponse.json({
        success: true,
        connected: true,
        phone_info: phoneInfo,
        message: `Successfully connected to Meta! Verified name: ${phoneInfo.verified_name || phoneInfo.display_phone_number || 'WhatsApp Business'}`
      })
    } catch (metaErr) {
      let msg = metaErr instanceof Error ? metaErr.message : 'Unknown Meta API error'
      if (msg.includes('expired') || msg.includes('OAuthException') || msg.includes('Code 190')) {
        msg = 'The Meta Access Token has expired or is invalid. Please generate a fresh Permanent System User Token in Meta Business Suite.'
      } else if (msg.includes('100') || msg.includes('Param error')) {
        msg = `Meta rejected Phone Number ID "${trimmedPhoneId}". Please verify the Phone Number ID in Meta Developer Portal.`
      } else if (msg.includes('200') || msg.includes('permission')) {
        msg = 'The Access Token is missing required permissions (whatsapp_business_messaging, whatsapp_business_management).'
      }

      return NextResponse.json({
        success: false,
        connected: false,
        error: msg
      }, { status: 200 })
    }
  } catch (err) {
    console.error('Error testing WhatsApp config:', err)
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: err instanceof Error ? err.message : 'Failed to test Meta connection'
      },
      { status: 200 }
    )
  }
}
