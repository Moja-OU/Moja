import { prisma } from '../config/database';

export class SessionService {
  /**
   * Start a new session
   */
  static async startSession(userId: string, channel: 'VOICE' | 'CHAT') {
    const session = await prisma.session.create({
      data: {
        userId,
        channel,
        startedAt: new Date(),
      },
    });

    return session;
  }

  /**
   * Append messages to session transcript
   */
  static async appendToSession(
    sessionId: string,
    userId: string,
    data: {
      userMessage: string;
      assistantMessage: string;
    }
  ) {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Append to transcript
    const existingTranscript = session.transcript || '';
    const newTranscript = `${existingTranscript}\nUser: ${data.userMessage}\nAssistant: ${data.assistantMessage}`;

    return await prisma.session.update({
      where: { id: sessionId },
      data: { transcript: newTranscript },
    });
  }

  /**
   * End a session
   */
  static async endSession(
    sessionId: string,
    userId: string,
    summary?: string
  ) {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return await prisma.session.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        summary: summary || 'Session ended',
      },
    });
  }

  /**
   * Get user sessions
   */
  static async getUserSessions(userId: string, limit = 20) {
    return await prisma.session.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        bookings: true,
        activities: true,
      },
    });
  }

  /**
   * Get session by ID
   */
  static async getById(sessionId: string, userId: string) {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
      include: {
        bookings: true,
        activities: true,
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    return session;
  }
}
