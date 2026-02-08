import { prisma } from '../config/database';

export interface TranscriptEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export class SessionService {
  /**
   * Start a new session
   */
  static async startSession(userId: string, channel: 'VOICE' | 'CHAT', twilioCallSid?: string) {
    const session = await prisma.session.create({
      data: {
        userId,
        channel,
        startedAt: new Date(),
        transcript: JSON.stringify([]), // Initialize empty JSON array
        twilioCallSid,
      },
    });
    return session;
  }

  /**
   * Append messages to session transcript (structured JSON)
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

    // Parse existing transcript or start fresh
    let transcript: TranscriptEntry[] = [];
    try {
      transcript = session.transcript ? JSON.parse(session.transcript) : [];
    } catch {
      // If legacy plain-text format, wrap it
      transcript = [];
    }

    const now = new Date().toISOString();
    transcript.push({ role: 'user', content: data.userMessage, timestamp: now });
    transcript.push({ role: 'assistant', content: data.assistantMessage, timestamp: now });

    return await prisma.session.update({
      where: { id: sessionId },
      data: { transcript: JSON.stringify(transcript) },
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

  /**
   * Get recent transcripts for AI context (so AI can reference past conversations)
   */
  static async getRecentTranscripts(userId: string, limit = 3): Promise<TranscriptEntry[]> {
    const sessions = await prisma.session.findMany({
      where: { userId, transcript: { not: null } },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: { transcript: true, startedAt: true, channel: true },
    });

    const allEntries: TranscriptEntry[] = [];
    for (const s of sessions.reverse()) {
      try {
        const entries: TranscriptEntry[] = s.transcript ? JSON.parse(s.transcript) : [];
        allEntries.push(...entries);
      } catch {
        // skip unparseable
      }
    }
    return allEntries;
  }

  /**
   * Find session by Twilio Call SID
   */
  static async findByCallSid(callSid: string) {
    return await prisma.session.findFirst({
      where: { twilioCallSid: callSid },
    });
  }
}
