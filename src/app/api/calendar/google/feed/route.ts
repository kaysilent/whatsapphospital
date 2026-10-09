import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { parseAppointmentDateTime, getGoogleCalendarConfig } from '@/lib/calendar/google-calendar';

export const runtime = 'nodejs';

/**
 * GET /api/calendar/google/feed
 * Official RFC 5545 iCalendar (.ics) subscription feed for Google Calendar.
 * Allows Google Calendar, Apple Calendar, and Outlook to subscribe and display
 * all clinic appointments in real-time.
 */
export async function GET(req: NextRequest) {
  try {
    const config = getGoogleCalendarConfig();
    const { data: appointments } = await supabaseAdmin()
      .from('appointments')
      .select('*')
      .neq('status', 'Cancelled')
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    const formatIcsDate = (isoStr: string) => {
      return isoStr.replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//La Fleur Aesthetic Clinic//Doctor Appointment Sync//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${config.calendarName || "Dr. Mrinalini's Clinical Appointments"}`,
      'X-WR-TIMEZONE:Asia/Kolkata',
      'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
      'X-PUBLISHED-TTL:PT15M',
    ];

    if (Array.isArray(appointments)) {
      for (const appt of appointments) {
        if (!appt.date || !appt.time) continue;
        const { startIso, endIso } = parseAppointmentDateTime(appt.date, appt.time, 45);
        const dtStamp = formatIcsDate(appt.created_at || new Date().toISOString());
        const dtStart = formatIcsDate(startIso);
        const dtEnd = formatIcsDate(endIso);
        const uid = `appt-${appt.id || appt.booking_id}@lafleurwellness.com`;
        const summary = `Consultation: ${appt.patient_name} - ${appt.department || 'Clinical Consultation'}`;
        const description = `Patient: ${appt.patient_name}\\nPhone: ${appt.phone_number}\\nTreatment: ${appt.department}\\nDoctor: ${appt.doctor || 'Dr. Mrinalini'}\\nStatus: ${appt.status || 'Confirmed'}`;
        const location = 'Road No.11 B, Jubilee hills, Hyderabad - 500045';

        icsContent.push(
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${dtStamp}`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:${summary}`,
          `DESCRIPTION:${description}`,
          `LOCATION:${location}`,
          'STATUS:CONFIRMED',
          'BEGIN:VALARM',
          'TRIGGER:-PT15M',
          'ACTION:DISPLAY',
          'DESCRIPTION:Upcoming Clinic Consultation in 15 Minutes',
          'END:VALARM',
          'END:VEVENT'
        );
      }
    }

    icsContent.push('END:VCALENDAR');

    return new NextResponse(icsContent.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="clinic-appointments.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
