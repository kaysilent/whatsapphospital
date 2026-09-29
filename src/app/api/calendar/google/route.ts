import { NextRequest, NextResponse } from 'next/server';
import { 
  DEFAULT_GOOGLE_CALENDAR_CONFIG, 
  GoogleCalendarConfig 
} from '@/lib/calendar/google-calendar';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { canEditClinicalConfig } from '@/lib/auth/roles';

export const runtime = 'nodejs';

// Server-side in-memory cache for Google Calendar config
let runtimeGoogleCalendarConfig: GoogleCalendarConfig = {
  ...DEFAULT_GOOGLE_CALENDAR_CONFIG
};

export async function GET() {
  return NextResponse.json({
    config: runtimeGoogleCalendarConfig,
    isConnected: runtimeGoogleCalendarConfig.isConnected,
    lastSyncedAt: runtimeGoogleCalendarConfig.lastSyncedAt
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRole('staff');
    if (!canEditClinicalConfig(ctx.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin or Doctor privilege required to update calendar settings.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { 
      calendarId, 
      accountEmail, 
      calendarName, 
      apiKey, 
      clientId, 
      clientSecret, 
      autoSyncOnBooking, 
      syncReminders, 
      syncTimezone, 
      isConnected,
      googleCalendarUrl 
    } = body;

    runtimeGoogleCalendarConfig = {
      ...runtimeGoogleCalendarConfig,
      calendarId: calendarId !== undefined ? String(calendarId).trim() : runtimeGoogleCalendarConfig.calendarId,
      accountEmail: accountEmail !== undefined ? String(accountEmail).trim() : runtimeGoogleCalendarConfig.accountEmail,
      calendarName: calendarName !== undefined ? String(calendarName).trim() : runtimeGoogleCalendarConfig.calendarName,
      apiKey: apiKey !== undefined ? String(apiKey).trim() : runtimeGoogleCalendarConfig.apiKey,
      clientId: clientId !== undefined ? String(clientId).trim() : runtimeGoogleCalendarConfig.clientId,
      clientSecret: clientSecret !== undefined ? String(clientSecret).trim() : runtimeGoogleCalendarConfig.clientSecret,
      autoSyncOnBooking: autoSyncOnBooking !== undefined ? Boolean(autoSyncOnBooking) : runtimeGoogleCalendarConfig.autoSyncOnBooking,
      syncReminders: syncReminders !== undefined ? Boolean(syncReminders) : runtimeGoogleCalendarConfig.syncReminders,
      syncTimezone: syncTimezone !== undefined ? String(syncTimezone).trim() : runtimeGoogleCalendarConfig.syncTimezone,
      isConnected: isConnected !== undefined ? Boolean(isConnected) : runtimeGoogleCalendarConfig.isConnected,
      googleCalendarUrl: googleCalendarUrl !== undefined ? String(googleCalendarUrl).trim() : runtimeGoogleCalendarConfig.googleCalendarUrl,
      lastSyncedAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'Google Calendar configuration saved successfully.',
      config: runtimeGoogleCalendarConfig
    });
  } catch (err: any) {
    return toErrorResponse(err);
  }
}
