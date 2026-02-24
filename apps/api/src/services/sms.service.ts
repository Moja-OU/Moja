/**
 * SMS Service — Handles incoming SMS messages and routes them through the AI Orchestrator.
 * 
 * This is the "ChatGPT via text message" experience for Moja.
 * Users text the Twilio number, authenticate with a PIN, and then have an
 * open-ended AI conversation (chat + web search) — no internet or app needed.
 */

import twilio from 'twilio';
import { PrismaClient } from '@prisma/client';
import { AIOrchestrator } from './ai.orchestrator';
import { SessionService } from './session.service';

const prisma = new PrismaClient();

// Lazy-initialized Twilio client
let _twilioClient: ReturnType<typeof twilio> | null = null;
function getTwilioClient() {
    if (!_twilioClient) {
        _twilioClient = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );
    }
    return _twilioClient;
}

// ── In-memory SMS session store (maps phone number → session state) ──
// We key by phone number since SMS doesn't have a "call SID" equivalent.
// Sessions persist until the user texts "BYE" or after 30 min of inactivity.

interface SmsSession {
    userId: string;
    dbSessionId: string;
    authenticated: boolean;
    history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    lastActivity: number; // timestamp for timeout
}

const activeSessions: Record<string, SmsSession> = {};

// Auto-expire sessions after 30 minutes of inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function cleanExpiredSessions() {
    const now = Date.now();
    for (const phone of Object.keys(activeSessions)) {
        if (now - activeSessions[phone].lastActivity > SESSION_TIMEOUT_MS) {
            console.log(`🕐 SMS session expired for ${phone}`);
            delete activeSessions[phone];
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanExpiredSessions, 5 * 60 * 1000);

// SMS character limit (Twilio auto-splits, but we keep replies concise)
const SMS_MAX_LENGTH = 1600;

function truncateForSms(text: string): string {
    if (text.length <= SMS_MAX_LENGTH) return text;
    return text.substring(0, SMS_MAX_LENGTH - 3) + '...';
}

export class SmsService {

    /**
     * Handle an incoming SMS message from Twilio.
     * Returns the text to send back to the user.
     */
    static async handleIncomingSms(fromNumber: string, body: string): Promise<string> {
        const input = body.trim();
        const inputLower = input.toLowerCase();

        // ── Handle special commands ──
        if (inputLower === 'bye' || inputLower === 'quit' || inputLower === 'exit') {
            return this.handleEndSession(fromNumber);
        }

        if (inputLower === 'help' || inputLower === '?') {
            return this.getHelpText();
        }

        // ── Check for existing session ──
        let session = activeSessions[fromNumber];

        // ── No session? Start the auth flow ──
        if (!session) {
            return this.handleNewUser(fromNumber, input);
        }

        // ── Session exists but not authenticated? Verify PIN ──
        if (!session.authenticated) {
            return this.handlePinVerification(fromNumber, input, session);
        }

        // ── Authenticated — route to AI ──
        session.lastActivity = Date.now();
        return this.handleAiMessage(fromNumber, input, session);
    }


    /**
     * Handle a brand new SMS conversation (no active session).
     */
    private static async handleNewUser(fromNumber: string, input: string): Promise<string> {
        // Look up user by phone number
        const user = await prisma.user.findUnique({
            where: { phone: fromNumber }
        });

        if (!user) {
            return `👋 Welcome to Moja!\n\nYour phone number isn't registered yet. Sign up at our website or call our hotline to get started.\n\nText HELP for more info.`;
        }

        // Check if user has a voicePin set
        if (!user.voicePin) {
            return `👋 Hi ${user.name}! You don't have a PIN set yet.\n\nPlease set your PIN on the Moja website or by calling our hotline, then text us again!`;
        }

        // Create a session and ask for PIN
        const dbSession = await SessionService.startSession(user.id, 'SMS');

        activeSessions[fromNumber] = {
            userId: user.id,
            dbSessionId: dbSession.id,
            authenticated: false,
            history: [],
            lastActivity: Date.now(),
        };

        return `👋 Welcome to Moja, ${user.name}!\n\nPlease reply with your 4-digit PIN to verify your identity.`;
    }


    /**
     * Verify the user's PIN.
     */
    private static async handlePinVerification(
        fromNumber: string,
        input: string,
        session: SmsSession
    ): Promise<string> {
        const user = await prisma.user.findUnique({
            where: { id: session.userId }
        });

        if (!user || !user.voicePin) {
            delete activeSessions[fromNumber];
            return `❌ Account error. Please try again later.`;
        }

        if (user.voicePin === input) {
            session.authenticated = true;
            session.lastActivity = Date.now();

            // Log the auth event
            await SessionService.appendToSession(session.dbSessionId, session.userId, {
                userMessage: '[PIN verified]',
                assistantMessage: 'Identity verified via SMS.',
            });

            return `✅ Verified! Hi ${user.name} 🌟\n\nYou can now ask me anything — I'm your AI assistant.\n\n💬 Chat with me\n🔍 Search the web\n📅 (More features coming soon!)\n\nJust type your question!`;
        } else {
            return `❌ Incorrect PIN. Please try again.\n\nReply with your 4-digit PIN.`;
        }
    }


    /**
     * The core AI conversation handler.
     * Routes the user's message through the AI Orchestrator and returns the response.
     */
    private static async handleAiMessage(
        fromNumber: string,
        input: string,
        session: SmsSession
    ): Promise<string> {
        try {
            // Add user message to in-memory history
            session.history.push({ role: 'user', content: input });

            // Load user profile
            const user = await prisma.user.findUnique({
                where: { id: session.userId }
            });

            if (!user) {
                return `❌ Account error. Text BYE and start over.`;
            }

            // Get past session context for richer conversations
            const pastTranscripts = await SessionService.getRecentTranscripts(session.userId, 3);

            // Merge past context with current conversation
            const contextMessages = [
                ...pastTranscripts.map((t) => ({ role: t.role, content: t.content })),
                ...session.history,
            ];

            // Route to AI Orchestrator — the same brain that powers voice & web chat
            const aiResponse = await AIOrchestrator.interpretMessage(input, {
                userProfile: {
                    userId: session.userId,
                    timezone: user.timezone || 'America/Chicago',
                },
                recentMessages: contextMessages,
            });

            const assistantMsg = aiResponse.assistantMessage || "I'm here to help! Try asking me a question.";

            // Track in memory
            session.history.push({ role: 'assistant', content: assistantMsg });

            // Persist to DB (shows up on the web dashboard!)
            await SessionService.appendToSession(session.dbSessionId, session.userId, {
                userMessage: input,
                assistantMessage: assistantMsg,
            });

            // Log actions if any (for future expansion)
            if (aiResponse.actions && aiResponse.actions.length > 0) {
                console.log(`📱 SMS actions for ${fromNumber}:`, aiResponse.actions.map(a => a.type).join(', '));
            }

            return truncateForSms(assistantMsg);

        } catch (error) {
            console.error(`❌ SMS AI error for ${fromNumber}:`, error);
            return `⚠️ Sorry, I had trouble processing that. Could you try rephrasing?`;
        }
    }


    /**
     * End the SMS session gracefully.
     */
    private static async handleEndSession(fromNumber: string): Promise<string> {
        const session = activeSessions[fromNumber];

        if (session) {
            try {
                await SessionService.endSession(session.dbSessionId, session.userId, 'SMS session ended by user');
            } catch (err) {
                console.error('Error ending SMS session:', err);
            }
            delete activeSessions[fromNumber];
        }

        return `👋 Goodbye! Your conversation has been saved.\n\nText anytime to start a new chat. 🌟`;
    }


    /**
     * Help text for new or confused users.
     */
    private static getHelpText(): string {
        return `🌟 Moja — AI Assistant via SMS\n\n` +
            `Just text me naturally! Examples:\n` +
            `• "What's the weather in Lagos?"\n` +
            `• "What causes earthquakes?"\n` +
            `• "Translate hello to Spanish"\n` +
            `• "What time does Walmart close?"\n\n` +
            `Commands:\n` +
            `• HELP — Show this message\n` +
            `• BYE — End your session\n\n` +
            `No internet needed. Just text! 📱`;
    }


    /**
     * Send an outbound SMS to a user (for future proactive features).
     */
    static async sendSms(toNumber: string, message: string): Promise<void> {
        try {
            const client = getTwilioClient();
            await client.messages.create({
                body: truncateForSms(message),
                from: process.env.TWILIO_PHONE_NUMBER,
                to: toNumber,
            });
            console.log(`📤 SMS sent to ${toNumber}`);
        } catch (error) {
            console.error(`❌ Failed to send SMS to ${toNumber}:`, error);
            throw error;
        }
    }
}
