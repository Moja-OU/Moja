import twilio from 'twilio'; // Use the default import
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { PrismaClient } from '@prisma/client';
import { BookingService } from './booking.service';
import { Budget } from '@prisma/client';
import { AIOrchestrator } from './ai.orchestrator';
import { GoalService } from './goal.service';
import { CalendarService } from './calendar.service';
import { User } from '@prisma/client';
import { Reminder } from '@prisma/client';
import { Expense } from '@prisma/client';


const prisma = new PrismaClient();


const client = twilio(
  "AC2de570e2a0d0d4ddabd1b808af366700", 
  "ce5cfbe2b04c99169168ec8262e87a5b"
);


// State Machine for the Call
enum CallState {
  AUTHENTICATION = 'AUTHENTICATION',
  DISCOVERY = 'DISCOVERY',
  ACTION = 'ACTION',
  HANDOFF = 'HANDOFF'
}

// In-memory session store (In production, use Redis)
interface VoiceSession {
  userId: string;
  state: CallState;
  tempData?: any; // To store things like "party size" before booking
}

const activeCalls: Record<string, VoiceSession> = {};

export class VoiceService {

// 1. Handle Incoming Call
static async handleIncomingCall(callSid: string, fromNumber: string): Promise<string> {
  const twiml = new VoiceResponse();

  // Look up the user by phone number
  const user = await prisma.user.findUnique({
    where: { phone: fromNumber } // Use the unique phone column
  });

  if (!user) {
    console.log("❌ User not found for number:", fromNumber);
    twiml.say("Phone number not recognized. Goodbye.");
    twiml.hangup();
    return twiml.toString();
  }

  // Initialize session
  activeCalls[callSid] = {
    userId: user.id,
    state: CallState.AUTHENTICATION
  };

  const gather = twiml.gather({
    input: ['dtmf', 'speech'],
    numDigits: 4,
    action: '/voice/process',
    timeout: 3
  });

  gather.say(`Hello ${user.name}. Please enter or say your four-digit security PIN.`);

  return twiml.toString();
}


  // 2. Process User Input
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
      // ✅ Use DB passwordHash (temporary PIN) for validation
      if (user.passwordHash === input) {
        session.state = CallState.DISCOVERY;
        twiml.say("Identity verified. Would you like to make a booking, check your budget, or speak to an agent?");
      } else {
        twiml.say("Incorrect PIN. Please try again.");
        twiml.gather({ input: ['dtmf', 'speech'], action: '/voice/process' });
        return twiml.toString();
      }
      break;

case CallState.DISCOVERY:
            try {
                // 1. Send speech to AI (AI Orchestrator decides if it's talk, search, or action)
                const aiResponse = await AIOrchestrator.interpretMessage(input, {
                    userProfile: {
                        userId: session.userId,
                        timezone: user.timezone || 'America/Chicago'
                    },
                    recentMessages: session.history // Pass conversation history if available
                });

                // 2. Speak AI response (This handles standard conversation AND search results)
                if (aiResponse.assistantMessage) {
                    twiml.say(aiResponse.assistantMessage);
                }

                // 3. Execute actions (Only if the AI explicitly determined a task was needed)
                if (aiResponse.actions && aiResponse.actions.length > 0) {
                    for (const action of aiResponse.actions) {
                        console.log(`🚀 Executing Action: ${action.type}`);

                        switch (action.type) {
                            
                            // --- BOOKING & LIFESTYLE ---
                            case 'CREATE_BOOKING':
                                await BookingService.createBooking(session.userId, action.payload);
                                break;

                            case 'CONFIRM_BOOKING':
                                await BookingService.confirmBooking(session.userId, action.payload.bookingId);
                                break;

                            case 'CREATE_ACTIVITY':
                                await prisma.activity.create({
                                    data: {
                                        userId: session.userId,
                                        name: action.payload.activityName,
                                        type: action.payload.type, // e.g. 'GYM', 'MEDITATION'
                                        durationMinutes: action.payload.duration,
                                        scheduledFor: new Date(action.payload.datetime)
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
                                        merchant: action.payload.merchant,
                                        amount: action.payload.amount,
                                        category: action.payload.category,
                                        date: new Date(action.payload.date)
                                    }
                                });
                                break;

                            // --- GOALS & PRODUCTIVITY ---
                            case 'CREATE_GOAL':
                                await prisma.goal.create({
                                    data: {
                                        userId: session.userId,
                                        title: action.payload.title,
                                        targetAmount: action.payload.targetAmount,
                                        targetDate: new Date(action.payload.targetDate),
                                        status: 'ACTIVE'
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
                                        priority: action.payload.priority || 'NORMAL',
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
                                console.warn(`⚠️ Unhandled action type: ${action.type}`);
                                break;
                        }
                    }
                }
            } catch (error) {
                console.error("Error in CallState.DISCOVERY:", error);
                twiml.say("I'm sorry, I had a bit of trouble processing that request. Could you say it again?");
            }
            break;

    case CallState.ACTION:
      const businessName = input;

      await BookingService.createBooking(session.userId, {
        businessName,
        datetimeLocal: new Date().toISOString(),
        partySize: 2
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

}

