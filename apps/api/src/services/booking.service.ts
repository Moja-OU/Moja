import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class BookingService {
  /**
   * Create a new booking
   */
  static async createBooking(
    userId: string,
    data: {
      businessName: string;
      businessPhone?: string;
      datetimeLocal: Date | string;
      partySize: number;
      notes?: string;
      sessionId?: string;
    }
  ) {
    const booking = await prisma.booking.create({
      data: {
        userId,
        businessName: data.businessName,
        businessPhone: data.businessPhone,
        datetimeLocal: new Date(data.datetimeLocal),
        partySize: data.partySize,
        notes: data.notes,
        sessionId: data.sessionId,
        status: 'DRAFT',
      },
    });

    return booking;
  }

  /**
   * Confirm a booking
   */
  static async confirmBooking(bookingId: string, userId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    return await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
    });
  }

  /**
   * Cancel a booking
   */
  static async cancelBooking(bookingId: string, userId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    return await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Get upcoming bookings for a user
   */
  static async getUpcoming(userId: string) {
    const now = new Date();

    return await prisma.booking.findMany({
      where: {
        userId,
        datetimeLocal: { gte: now },
        status: { not: 'CANCELLED' },
      },
      orderBy: { datetimeLocal: 'asc' },
      take: 20,
    });
  }

  /**
   * Get booking by ID
   */
  static async getById(bookingId: string, userId: string) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    return booking;
  }
}
