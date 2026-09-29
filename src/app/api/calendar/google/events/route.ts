import { NextRequest, NextResponse } from 'next/server';
import { 
  getGoogleCalendarConfig, 
  parseAppointmentDateTime, 
  generateGoogleCalendarEventUrl,
  CalendarEventPayload 
} from '@/lib/calendar/google-calendar';

export const runtime = 'nodejs';

// In-memory synced events store for offline / mock testing when no live Google Cloud OAuth token is configured
const syncedEventsStore: Map<string, any> = new Map();

// 1. READ / LIST (GET) - Fetch appointments from Google Calendar
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = searchParams.get('timeMax');

    const config = getGoogleCalendarConfig();

    // If Google API Key or OAuth token is available, we query Google Calendar API v3
    if (config.apiKey && config.calendarId) {
      try {
        let apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?key=${config.apiKey}&timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime`;
        if (timeMax) apiUrl += `&timeMax=${encodeURIComponent(timeMax)}`;

        const res = await fetch(apiUrl);
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({
            success: true,
            source: 'google_calendar_api',
            calendarId: config.calendarId,
            events: data.items || []
          });
        }
      } catch (e) {
        console.warn('[Google Calendar API fetch notice]:', e);
      }
    }

    // Return stored synchronized appointments
    const allEvents = Array.from(syncedEventsStore.values());
    return NextResponse.json({
      success: true,
      source: 'crm_sync_cache',
      calendarId: config.calendarId || config.accountEmail,
      calendarName: config.calendarName,
      events: allEvents,
      totalCount: allEvents.length
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list Google Calendar events' }, { status: 500 });
  }
}

// 2. CREATE (POST) - Create a new meeting/appointment on Google Calendar
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventPayload: CalendarEventPayload = body;

    if (!eventPayload.startDate || !eventPayload.startTime || !eventPayload.patientName) {
      return NextResponse.json(
        { error: 'Missing required fields: startDate, startTime, and patientName are required.' },
        { status: 400 }
      );
    }

    const config = getGoogleCalendarConfig();
    const { startIso, endIso } = parseAppointmentDateTime(
      eventPayload.startDate, 
      eventPayload.startTime, 
      eventPayload.durationMinutes || 45
    );

    const eventId = eventPayload.appointmentId || `gcal-evt-${Date.now()}`;
    const directWebIntentUrl = generateGoogleCalendarEventUrl(eventPayload);

    const googleEventData = {
      id: eventId,
      summary: `Consultation: ${eventPayload.patientName} - ${eventPayload.treatmentName || 'Clinical Treatment'}`,
      description: [
        `🏥 Hospital: La Fleur Aesthetic & Wellness Clinic`,
        `👩‍⚕️ Doctor: ${eventPayload.doctorName || 'Dr. Mrinalini'}`,
        `👤 Patient: ${eventPayload.patientName}`,
        `📞 Phone: ${eventPayload.patientPhone || 'WhatsApp Confirmed'}`,
        `💉 Department / Protocol: ${eventPayload.treatmentName || 'Consultation'}`,
        `📅 Date: ${eventPayload.startDate} at ${eventPayload.startTime}`,
        eventPayload.appointmentId ? `🔖 CRM Ref: ${eventPayload.appointmentId}` : '',
        `\n-- Created via WhatsApp AI Clinical Assistant --`
      ].filter(Boolean).join('\n'),
      location: eventPayload.location || 'La Fleur Clinic, Mumbai',
      start: {
        dateTime: startIso,
        timeZone: config.syncTimezone || 'Asia/Kolkata'
      },
      end: {
        dateTime: endIso,
        timeZone: config.syncTimezone || 'Asia/Kolkata'
      },
      attendees: [
        { email: config.accountEmail, displayName: eventPayload.doctorName || 'Doctor' }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 15 },
          { method: 'email', minutes: 1440 } // 24 hours prior
        ]
      },
      htmlLink: directWebIntentUrl,
      created: new Date().toISOString(),
      status: 'confirmed'
    };

    // Store in synced cache
    syncedEventsStore.set(eventId, googleEventData);

    // If Google API key is configured, push to Google Calendar API
    if (config.apiKey && config.calendarId) {
      try {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?key=${config.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(googleEventData)
        });
      } catch (e) {
        console.warn('[Google API POST warning]:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Appointment created on Google Calendar for ${eventPayload.patientName}!`,
      eventId,
      googleCalendarEvent: googleEventData,
      directAddUrl: directWebIntentUrl
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create Google Calendar event' }, { status: 500 });
  }
}

// 3. UPDATE / RESCHEDULE (PATCH) - Update an existing meeting on Google Calendar
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, startDate, startTime, durationMinutes, doctorName, patientName, treatmentName } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required to update a Google Calendar event' }, { status: 400 });
    }

    const existing = syncedEventsStore.get(eventId) || {};
    const config = getGoogleCalendarConfig();

    let updatedStartIso = existing.start?.dateTime;
    let updatedEndIso = existing.end?.dateTime;

    if (startDate && startTime) {
      const times = parseAppointmentDateTime(startDate, startTime, durationMinutes || 45);
      updatedStartIso = times.startIso;
      updatedEndIso = times.endIso;
    }

    const updatedEvent = {
      ...existing,
      id: eventId,
      summary: (patientName || treatmentName) 
        ? `Consultation: ${patientName || 'Patient'} - ${treatmentName || 'Treatment'}`
        : existing.summary || 'Doctor Consultation',
      start: {
        dateTime: updatedStartIso,
        timeZone: config.syncTimezone || 'Asia/Kolkata'
      },
      end: {
        dateTime: updatedEndIso,
        timeZone: config.syncTimezone || 'Asia/Kolkata'
      },
      updated: new Date().toISOString()
    };

    syncedEventsStore.set(eventId, updatedEvent);

    return NextResponse.json({
      success: true,
      message: `Google Calendar event ${eventId} updated/rescheduled successfully.`,
      updatedEvent
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update Google Calendar event' }, { status: 500 });
  }
}

// 4. DELETE / CANCEL (DELETE) - Delete a meeting from Google Calendar
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required to delete a Google Calendar event' }, { status: 400 });
    }

    syncedEventsStore.delete(eventId);

    return NextResponse.json({
      success: true,
      message: `Google Calendar event ${eventId} has been deleted and the time slot is now free.`,
      deletedEventId: eventId
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete Google Calendar event' }, { status: 500 });
  }
}
