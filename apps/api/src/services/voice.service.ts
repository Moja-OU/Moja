import twilio from 'twilio'; // Use the default import
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { PrismaClient } from '@prisma/client';
import { BookingService } from './booking.service';
import { AIOrchestrator } from './ai.orchestrator';
import { GoalService } from './goal.service';
import { CalendarService } from './calendar.service';
import { SessionService } from './session.service';

const prisma = new PrismaClient();

// Lazy-initialized Twilio client (created after dotenv.config() runs)
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


// State Machine for the Call
enum CallState {
  AUTHENTICATION = 'AUTHENTICATION',
  DISCOVERY = 'DISCOVERY',
  ACTION = 'ACTION',
  HANDOFF = 'HANDOFF'
}

// In-memory session store (maps Twilio CallSid -> session state)
interface VoiceSession {
  userId: string;
  dbSessionId: string; // ID of the persisted Session row
  state: CallState;
  tempData?: any; // To store things like "party size" before booking
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

const activeCalls: Record<string, VoiceSession> = {};

export class VoiceService {

  // 1. Handle Incoming Call
  static async handleIncomingCall(callSid: string, fromNumber: string): Promise<string> {
    const twiml = new VoiceResponse();

    // Look up the user by phone number
    const user = await prisma.user.findUnique({
      where: { phone: fromNumber }
    });

    if (!user) {
      console.log("User not found for number:", fromNumber);
      twiml.say("Phone number not recognized. Goodbye.");
      twiml.hangup();
      return twiml.toString();
    }

    // Create persisted session? 
    // NOTE: The VoiceRealtimeService will also try to create a session when the stream connects.
    // To avoid duplicates, we can let the WebSocket service handle session creation, 
    // OR create it here and pass the ID in custom params.
    // Let's pass user ID in custom params so WebSocket knows who it is.

    const webhookUrl = process.env.TWILIO_WEBHOOK_URL;
    const wssUrl = `wss://${webhookUrl?.replace('https://', '').replace('http://', '')}/voice/stream`;

    console.log(`WebSocket URL: ${wssUrl}`);

    const connect = twiml.connect();
    const stream = connect.stream({
      url: wssUrl
    });

    // Pass userId to the stream so we know who is calling
    stream.parameter({
      name: 'userId',
      value: user.id
    });

    return twiml.toString();
  }


  // 2. Process User Input
  static async processInput(callSid: string, speechResult: string, digits: string): Promise<string> {
    const session = activeCalls[callSid];
    const twiml = new VoiceResponse();
    const input = digits || speechResult || '';

    if (!session) {
      twiml.say("Session expired.");
      twiml.hangup();
      return twiml.toString();
    }

    // Load the user from DB for verification
    const user = await prisma.user.findUnique({ where: { id: session.userId } });

    if (!user) {
      twiml.say("User not found. Goodbye.");
      twiml.hangup();
      return twiml.toString();
    }

    switch (session.state) {
      case CallState.AUTHENTICATION:
        // ✅ Use voicePin field for voice authentication
        console.log('🔐 PIN Authentication attempt:');
        console.log('   Expected (voicePin):', user.voicePin, 'Type:', typeof user.voicePin);
        console.log('   Received (input):', input, 'Type:', typeof input);
        console.log('   Match:', user.voicePin === input);

        if (user.voicePin && user.voicePin === input) {
          session.state = CallState.DISCOVERY;
          const greeting = 'Identity verified. How can I help you today?';
          twiml.say(greeting);

          // Persist the greeting to DB
          await SessionService.appendToSession(session.dbSessionId, session.userId, {
            userMessage: '[PIN entered]',
            assistantMessage: greeting,
          });
        } else {
          twiml.say("Incorrect PIN. Please try again.");
          twiml.gather({ input: ['dtmf', 'speech'], action: '/voice/process' });
          return twiml.toString();
        }
        break;

      case CallState.DISCOVERY:
        try {
          // Track user message in history
          session.history.push({ role: 'user', content: input });

          // Get past session context so AI can reference previous conversations
          const pastTranscripts = await SessionService.getRecentTranscripts(session.userId, 3);

          // Merge past context with current conversation
          const contextMessages = [
            ...pastTranscripts.map((t) => ({ role: t.role, content: t.content })),
            ...session.history,
          ];

          // Send to AI Orchestrator
          const aiResponse = await AIOrchestrator.interpretMessage(input, {
            userProfile: {
              userId: session.userId,
              timezone: user.timezone || 'America/Chicago'
            },
            recentMessages: contextMessages
          });

          const assistantMsg = aiResponse.assistantMessage || "I'm here to help!";

          // Speak the response
          twiml.say(assistantMsg);

          // Track in memory
          session.history.push({ role: 'assistant', content: assistantMsg });

          // Persist to DB
          await SessionService.appendToSession(session.dbSessionId, session.userId, {
            userMessage: input,
            assistantMessage: assistantMsg,
          });

          // Execute any actions the AI decided on
          if (aiResponse.actions && aiResponse.actions.length > 0) {
            for (const action of aiResponse.actions) {
              console.log(`Executing Action: ${action.type}`);

              try {
                switch (action.type) {

                  // --- BOOKING & LIFESTYLE ---
                  case 'CREATE_BOOKING':
                    // FIX: Cast the payload so TypeScript stops complaining
                    const bookingData = {
                      businessName: action.payload.businessName,
                      datetimeLocal: new Date(action.payload.datetimeLocal).toISOString(),
                      partySize: Number(action.payload.partySize) || 2,
                      notes: action.payload.notes,
                      sessionId: session.dbSessionId,
                    } as any; // Force cast to satisfy Service

                    await BookingService.createBooking(session.userId, bookingData);
                    break;

                  case 'CONFIRM_BOOKING':
                    await BookingService.confirmBooking(session.userId, action.payload.bookingId);
                    break;

                  case 'CREATE_ACTIVITY':
                    const activityName = action.payload?.name || action.payload?.title || action.payload?.activityName || "New Activity";
                    const activityDateTime = action.payload?.datetime ? new Date(action.payload.datetime) : new Date();

                    await prisma.activity.create({
                      data: {
                        userId: session.userId,
                        sessionId: session.dbSessionId,
                        name: activityName,
                        type: action.payload?.type || 'GENERAL',
                        durationMin: action.payload?.duration || action.payload?.durationMin || 60,
                        datetimeLocal: activityDateTime
                      }
                    });


                    break;

                  // --- FINANCE ---
                  case 'SET_BUDGET':
                    await prisma.budget.create({
                      data: {
                        userId: session.userId,
                        category: action.payload.category,
                        limitAmount: action.payload.amount,
                        period: action.payload.period || 'MONTHLY'
                      }
                    });
                    break;

                  case 'ADD_EXPENSE':
                    await prisma.expense.create({
                      data: {
                        userId: session.userId,
                        budgetId: action.payload.budgetId, // required
                        merchant: action.payload.merchant,
                        amount: action.payload.amount,
                        datetimeLocal: new Date(action.payload.date)
                      }
                    });
                    break;

                  // --- GOALS & PRODUCTIVITY ---
                  case 'CREATE_GOAL':
                    await prisma.goal.create({
                      data: {
                        userId: session.userId,
                        title: action.payload.title,
                        metric: action.payload.metric || "general",
                        targetAmount: action.payload.targetAmount,
                        frequency: action.payload.frequency || "MONTHLY",
                        category: action.payload.category || "GENERAL"
                      }
                    });

                    break;

                  case 'GENERATE_GOAL_PLAN':
                    // Complex logic -> Delegate to a dedicated service
                    await GoalService.generateGoalPlan(session.userId, action.payload.goalId);
                    break;

                  case 'CREATE_REMINDER':
                    await prisma.reminder.create({
                      data: {
                        userId: session.userId,
                        title: action.payload.title,
                        remindAt: new Date(action.payload.datetime),
                        isSent: false
                      }
                    });

                    break;

                  /*  case 'EXPORT_CALENDAR_EVENT':
                        await CalendarService.addToUserCalendar(session.userId, {
                            title: action.payload.title,
                            start: new Date(action.payload.startDatetime),
                            end: new Date(action.payload.endDatetime),
                            location: action.payload.location
                        });
                        break;
                        */

                  default:
                    console.warn(`Unhandled action type: ${action.type}`);
                    break;
                }
              } catch (actionErr) {
                console.error(`Action ${action.type} failed:`, actionErr);
              }
            }
          }
        } catch (error) {
          console.error("Error in CallState.DISCOVERY:", error);
          twiml.say("I'm sorry, I had trouble processing that. Could you say it again?");
        }
        break;

      case CallState.ACTION:
        const businessName = input;

        await BookingService.createBooking(session.userId, {
          businessName,
          datetimeLocal: new Date().toISOString(),
          partySize: 2,
          sessionId: session.dbSessionId,
        });

        twiml.say(`I have created a draft booking for ${businessName}. Check your app to confirm the time.`);
        session.state = CallState.DISCOVERY;
        break;
    }

    if (session.state !== CallState.HANDOFF) {
      twiml.gather({ input: ['speech'], action: '/voice/process', timeout: 5 });
    }

    return twiml.toString();
  }

  // 3. Handle call end (cleanup + persist)
  static async handleCallEnd(callSid: string): Promise<void> {
    const session = activeCalls[callSid];
    if (!session) return;

    try {
      await SessionService.endSession(session.dbSessionId, session.userId, 'Voice call ended');
    } catch (err) {
      console.error('Error ending voice session:', err);
    }

    delete activeCalls[callSid];
  }

}

