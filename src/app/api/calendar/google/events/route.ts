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

import { supabaseAdmin } from '@/lib/supabase/admin';

// 1. READ / LIST (GET) - Fetch appointments from Google Calendar & CRM
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = searchParams.get('timeMax');

    const config = getGoogleCalendarConfig();
    const eventMap = new Map<string, any>();

    // 1.1 Ingest persistent CRM appointments from Supabase
    try {
      const { data: dbAppointments } = await supabaseAdmin()
        .from('appointments')
        .select('*')
        .neq('status', 'Cancelled')
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (Array.isArray(dbAppointments)) {
        for (const appt of dbAppointments) {
          if (!appt.date || !appt.time) continue;
          const { startIso, endIso } = parseAppointmentDateTime(appt.date, appt.time, 45);
          const directUrl = generateGoogleCalendarEventUrl({
            title: `Consultation: ${appt.patient_name}`,
            description: `Appointment for ${appt.patient_name} - ${appt.department || 'Clinical Consultation'}`,
            location: 'Road No.11 B, Jubilee hills, Hyderabad - 500045',
            startDate: appt.date,
            startTime: appt.time,
            patientName: appt.patient_name,
            patientPhone: appt.phone_number || '',
            doctorName: appt.doctor || 'Dr. Mrinalini',
            treatmentName: appt.department || 'Clinical Consultation',
            appointmentId: appt.id
          });

          const gcalObj = {
            id: appt.id,
            summary: `Consultation: ${appt.patient_name} - ${appt.department || 'Clinical Consultation'}`,
            description: [
              `🏥 Clinic: La Fleur Aesthetic & Wellness Clinic`,
              `👩‍⚕️ Doctor: ${appt.doctor || 'Dr. Mrinalini'}`,
              `👤 Patient: ${appt.patient_name}`,
              `📞 Phone: ${appt.phone_number || 'WhatsApp Confirmed'}`,
              `💉 Treatment: ${appt.department || 'Clinical Consultation'}`,
              `📅 Date: ${appt.date} at ${appt.time}`,
              `🔖 Status: ${appt.status || 'Confirmed'}`,
              `\n-- Real-Time WhatsApp CRM Booking --`
            ].join('\n'),
            location: 'Road No.11 B, Jubilee hills, Hyderabad - 500045',
            start: {
              dateTime: startIso,
              timeZone: config.syncTimezone || 'Asia/Kolkata'
            },
            end: {
              dateTime: endIso,
              timeZone: config.syncTimezone || 'Asia/Kolkata'
            },
            attendees: [
              { email: config.accountEmail || 'dr.mrinalini@lafleurwellness.com', displayName: appt.doctor || 'Dr. Mrinalini' }
            ],
            htmlLink: directUrl,
            directAddUrl: directUrl,
            status: appt.status === 'Completed' ? 'completed' : 'confirmed',
            created: appt.created_at || new Date().toISOString(),
            source: 'crm_database'
          };
          eventMap.set(appt.id, gcalObj);
        }
      }
    } catch (dbErr) {
      console.warn('[Google Events Supabase Fetch Notice]:', dbErr);
    }

    // 1.2 Ingest stored in-memory synced cache
    syncedEventsStore.forEach((evt, id) => {
      if (!eventMap.has(id)) {
        eventMap.set(id, evt);
      }
    });

    // 1.3 If Google API Key or OAuth token is available, query live Google Calendar API v3
    if (config.apiKey && config.calendarId) {
      try {
        let apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?key=${config.apiKey}&timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime`;
        if (timeMax) apiUrl += `&timeMax=${encodeURIComponent(timeMax)}`;

        const res = await fetch(apiUrl);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            data.items.forEach((item: any) => {
              eventMap.set(item.id || `gapi-${item.created}`, {
                ...item,
                source: 'google_calendar_live'
              });
            });
          }
        }
      } catch (e) {
        console.warn('[Google Calendar API fetch notice]:', e);
      }
    }

    const allEvents = Array.from(eventMap.values()).sort((a, b) => {
      const tA = new Date(a.start?.dateTime || a.start?.date || 0).getTime();
      const tB = new Date(b.start?.dateTime || b.start?.date || 0).getTime();
      return tA - tB;
    });

    return NextResponse.json({
      success: true,
      source: 'synchronized_calendar',
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

    // Sync to Supabase appointments table
    try {
      const dbUpdates: any = {};
      if (startDate) dbUpdates.date = startDate;
      if (startTime) dbUpdates.time = startTime;
      if (patientName) dbUpdates.patient_name = patientName;
      if (treatmentName) dbUpdates.department = treatmentName;
      if (doctorName) dbUpdates.doctor = doctorName;
      if (Object.keys(dbUpdates).length > 0) {
        await supabaseAdmin().from('appointments').update(dbUpdates).eq('id', eventId);
      }
    } catch {}

    // Push to Google Calendar API if configured
    if (config.apiKey && config.calendarId) {
      try {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}?key=${config.apiKey}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedEvent)
        });
      } catch {}
    }

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

    // Update in Supabase appointments table
    try {
      await supabaseAdmin().from('appointments').update({ status: 'Cancelled' }).eq('id', eventId);
    } catch {}

    const config = getGoogleCalendarConfig();
    if (config.apiKey && config.calendarId) {
      try {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}?key=${config.apiKey}`, {
          method: 'DELETE'
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: `Google Calendar event ${eventId} has been deleted and the time slot is now free.`,
      deletedEventId: eventId
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete Google Calendar event' }, { status: 500 });
  }
}
