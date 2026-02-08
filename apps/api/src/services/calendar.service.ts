import { prisma } from '../config/database';

export class CalendarService {
  /**
   * Generate .ics file content for a booking
   */
  static async generateBookingICS(bookingId: string, userId: string): Promise<string> {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    const startTime = new Date(booking.datetimeLocal);
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours default

    return this.buildICS({
      uid: `booking-${booking.id}`,
      start: startTime,
      end: endTime,
      summary: `${booking.businessName} - Party of ${booking.partySize}`,
      description: booking.notes || `Reservation at ${booking.businessName}`,
      location: booking.businessName,
    });
  }

  /**
   * Generate .ics file content for an activity
   */
  static async generateActivityICS(activityId: string, userId: string): Promise<string> {
    const activity = await prisma.activity.findFirst({
      where: { id: activityId, userId },
      include: { goal: true },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    const startTime = new Date(activity.datetimeLocal);
    const endTime = new Date(startTime.getTime() + activity.durationMin * 60 * 1000);

    const description = activity.goal
      ? `Part of goal: ${activity.goal.title}`
      : activity.name;

    return this.buildICS({
      uid: `activity-${activity.id}`,
      start: startTime,
      end: endTime,
      summary: activity.name,
      description,
      recurrence: activity.recurrenceRule || undefined,
    });
  }

  /**
   * Build iCalendar format string
   */
  private static buildICS(data: {
    uid: string;
    start: Date;
    end: Date;
    summary: string;
    description?: string;
    location?: string;
    recurrence?: string;
  }): string {
    const formatDate = (date: Date): string => {
      return date
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    };

    const now = formatDate(new Date());
    const dtstart = formatDate(data.start);
    const dtend = formatDate(data.end);

    let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Moja AI Call Center//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${data.uid}@moja.com
DTSTAMP:${now}
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${this.escapeICS(data.summary)}`;

    if (data.description) {
      ics += `\nDESCRIPTION:${this.escapeICS(data.description)}`;
    }

    if (data.location) {
      ics += `\nLOCATION:${this.escapeICS(data.location)}`;
    }

    if (data.recurrence) {
      ics += `\nRRULE:FREQ=${data.recurrence}`;
    }

    ics += `\nSTATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

    return ics;
  }

  /**
   * Escape special characters for iCalendar format
   */
  private static escapeICS(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  /**
   * Update calendar event ID on booking
   */
  static async updateBookingCalendarId(bookingId: string, calendarEventId: string) {
    return await prisma.booking.update({
      where: { id: bookingId },
      data: { calendarEventId },
    });
  }

  /**
   * Update calendar event ID on activity
   */
  static async updateActivityCalendarId(activityId: string, calendarEventId: string) {
    return await prisma.activity.update({
      where: { id: activityId },
      data: { calendarEventId },
    });
  }
}
