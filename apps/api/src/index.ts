import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authMiddleware } from './middleware/auth';
import { AuthService } from './services/auth.service';
import { SessionService } from './services/session.service';
import { AIOrchestrator, AIAction } from './services/ai.orchestrator';
import { BookingService } from './services/booking.service';
import { SchedulingService } from './services/scheduling.service';
import { GoalService } from './services/goal.service';
import { BudgetService } from './services/budget.service';
import { CalendarService } from './services/calendar.service';
import { NotificationService } from './services/notification.service';
import { VoiceService } from './services/voice.service';

dotenv.config();

// Crash handlers — surface silent exits
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled rejection:', err);
});

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Moja API is running' });
});

// ============================================================================
// AUTH ROUTES
// ============================================================================

app.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone, timezone } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await AuthService.register({
      email,
      password,
      name,
      phone,
      timezone,
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Registration failed',
    });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await AuthService.login(email, password);
    res.json(result);
  } catch (error) {
    res.status(401).json({
      error: error instanceof Error ? error.message : 'Login failed',
    });
  }
});

app.post('/auth/demo', async (_req, res) => {
  try {
    const result = await AuthService.createDemoUser();
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Demo user creation failed',
    });
  }
});

// ============================================================================
// DASHBOARD ROUTE
// ============================================================================

app.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    // Fetch all dashboard data in parallel
    const [sessions, upcomingBookings, upcomingActivities, goals, budgets, recentExpenses] =
      await Promise.all([
        SessionService.getUserSessions(userId, 10),
        BookingService.getUpcoming(userId),
        SchedulingService.getUpcoming(userId),
        GoalService.getByUser(userId),
        BudgetService.getCurrentBudgets(userId),
        BudgetService.getRecentExpenses(userId, 10),
      ]);

    res.json({
      sessions,
      upcomingBookings,
      upcomingActivities,
      goals,
      budgetSnapshot: {
        budgets,
        recentExpenses,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to load dashboard',
    });
  }
});

// ============================================================================
// SESSION ROUTES
// ============================================================================

app.post('/sessions/start', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { channel } = req.body;

    if (!channel || !['VOICE', 'CHAT'].includes(channel)) {
      return res.status(400).json({ error: 'Valid channel (VOICE|CHAT) required' });
    }

    const session = await SessionService.startSession(userId, channel);
    res.status(201).json({ session });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start session',
    });
  }
});

app.post('/sessions/:id/append', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { userMessage, assistantMessage } = req.body;

    if (!userMessage || !assistantMessage) {
      return res.status(400).json({ error: 'Both userMessage and assistantMessage required' });
    }

    const session = await SessionService.appendToSession(id, userId, {
      userMessage,
      assistantMessage,
    });

    res.json({ session });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to append to session',
    });
  }
});

app.post('/sessions/:id/end', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { summary } = req.body;

    const session = await SessionService.endSession(id, userId, summary);
    res.json({ session });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to end session',
    });
  }
});

app.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const sessions = await SessionService.getUserSessions(userId);
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get sessions',
    });
  }
});

// ============================================================================
// AI EXECUTE ROUTE (CORE ENDPOINT)
// ============================================================================

app.post('/ai/execute', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { sessionId, userMessage, context } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage required' });
    }

    // Get user profile
    const user = await AuthService.getUserById(userId);

    // Interpret message
    const aiResponse = await AIOrchestrator.interpretMessage(userMessage, {
      recentMessages: context?.recentMessages || [],
      userProfile: {
        userId,
        timezone: user.timezone,
        preferences: context?.userProfile?.preferences,
      },
    });

    // Execute actions
    const executedActions: any[] = [];

    for (const action of aiResponse.actions) {
      // Validate action
      if (!AIOrchestrator.validateAction(action)) {
        console.warn('Invalid action skipped:', action);
        continue;
      }

      try {
        const result = await executeAction(userId, action, sessionId);
        executedActions.push({ ...action, result });
      } catch (error) {
        console.error('Action execution failed:', error);
        executedActions.push({
          ...action,
          error: error instanceof Error ? error.message : 'Execution failed',
        });
      }
    }

    // Append to session if sessionId provided
    if (sessionId) {
      await SessionService.appendToSession(sessionId, userId, {
        userMessage,
        assistantMessage: aiResponse.assistantMessage,
      });
    }

    // Get updated dashboard snapshot
    const [upcomingBookings, upcomingActivities, goals, budgets] = await Promise.all([
      BookingService.getUpcoming(userId),
      SchedulingService.getUpcoming(userId),
      GoalService.getByUser(userId),
      BudgetService.getCurrentBudgets(userId),
    ]);

    res.json({
      assistantMessage: aiResponse.assistantMessage,
      missingFields: aiResponse.missingFields,
      actions: executedActions,
      dashboardSnapshot: {
        upcomingBookings,
        upcomingActivities,
        goals,
        budgets,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'AI execution failed',
    });
  }
});

// Helper function to execute actions
async function executeAction(userId: string, action: AIAction, sessionId?: string) {
  switch (action.type) {
    case 'CREATE_BOOKING':
      return await BookingService.createBooking(userId, {
        businessName: action.payload.businessName,
        businessPhone: action.payload.businessPhone,
        datetimeLocal: action.payload.datetimeLocal,
        partySize: action.payload.partySize,
        notes: action.payload.notes,
        sessionId,
      });

    case 'CONFIRM_BOOKING':
      return await BookingService.confirmBooking(action.payload.bookingId, userId);

    case 'CREATE_ACTIVITY':
      return await SchedulingService.createActivity(userId, {
        name: action.payload.title,
        datetimeLocal: action.payload.datetimeLocal,
        durationMin: action.payload.durationMin,
        recurrenceRule: action.payload.recurrenceRule,
        goalId: action.payload.goalId,
        sessionId,
        type: action.payload.type,
      });

    case 'CREATE_GOAL':
      return await GoalService.createGoal(userId, {
        title: action.payload.title,
        metric: action.payload.metric,
        targetAmount: action.payload.targetAmount,
        frequency: action.payload.frequency,
      });

    case 'GENERATE_GOAL_PLAN':
      return await GoalService.generateGoalPlan(action.payload.goalId, action.payload.preferences);

    case 'SET_BUDGET':
      return await BudgetService.createBudget(userId, {
        category: action.payload.category,
        period: action.payload.period,
        limitAmount: action.payload.limitAmount,
      });

    case 'ADD_EXPENSE':
      return await BudgetService.addExpense(userId, action.payload.budgetId, {
        amount: action.payload.amount,
        merchant: action.payload.merchant,
        note: action.payload.note,
      });

    case 'EXPORT_CALENDAR_EVENT':
      // Return event ID for calendar download
      return { eventId: action.payload.eventId, type: action.payload.type };

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

// ============================================================================
// BOOKING ROUTES
// ============================================================================

app.post('/bookings', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const booking = await BookingService.createBooking(userId, req.body);
    res.status(201).json({ booking });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create booking',
    });
  }
});

app.patch('/bookings/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { status } = req.body;

    let booking;
    if (status === 'CONFIRMED') {
      booking = await BookingService.confirmBooking(id, userId);
    } else if (status === 'CANCELLED') {
      booking = await BookingService.cancelBooking(id, userId);
    } else {
      return res.status(400).json({ error: 'Invalid status' });
    }

    res.json({ booking });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update booking',
    });
  }
});

app.get('/bookings/upcoming', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const bookings = await BookingService.getUpcoming(userId);
    res.json({ bookings });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get bookings',
    });
  }
});

// ============================================================================
// ACTIVITY ROUTES
// ============================================================================

app.post('/activities', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const activity = await SchedulingService.createActivity(userId, req.body);
    res.status(201).json({ activity });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create activity',
    });
  }
});

app.patch('/activities/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { status } = req.body;

    let activity;
    if (status === 'DONE') {
      activity = await SchedulingService.markDone(id, userId);
    } else if (status === 'SKIPPED') {
      activity = await SchedulingService.markSkipped(id, userId);
    } else {
      return res.status(400).json({ error: 'Invalid status' });
    }

    res.json({ activity });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update activity',
    });
  }
});

app.get('/activities/upcoming', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const activities = await SchedulingService.getUpcoming(userId);
    res.json({ activities });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get activities',
    });
  }
});

// ============================================================================
// GOAL ROUTES
// ============================================================================

app.post('/goals', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const goal = await GoalService.createGoal(userId, req.body);
    res.status(201).json({ goal });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create goal',
    });
  }
});

app.post('/goals/:id/plan', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id as string;
    const result = await GoalService.generateGoalPlan(id, req.body.preferences);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate goal plan',
    });
  }
});

app.get('/goals', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const goals = await GoalService.getByUser(userId);
    res.json({ goals });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get goals',
    });
  }
});

// ============================================================================
// BUDGET & EXPENSE ROUTES
// ============================================================================

app.post('/budgets', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const budget = await BudgetService.createBudget(userId, req.body);
    res.status(201).json({ budget });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create budget',
    });
  }
});

app.post('/expenses', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { budgetId, amount, merchant, note } = req.body;

    if (!budgetId || !amount || !merchant) {
      return res.status(400).json({ error: 'budgetId, amount, and merchant required' });
    }

    const result = await BudgetService.addExpense(userId, budgetId, {
      amount,
      merchant,
      note,
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to add expense',
    });
  }
});

app.get('/budgets/current', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const budgets = await BudgetService.getCurrentBudgets(userId);
    res.json({ budgets });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get budgets',
    });
  }
});

// ============================================================================
// CALENDAR ROUTES
// ============================================================================

app.get('/calendar/booking/:id.ics', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const icsContent = await CalendarService.generateBookingICS(id, userId);

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="booking-${id}.ics"`);
    res.send(icsContent);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate calendar file',
    });
  }
});

app.get('/calendar/activity/:id.ics', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const icsContent = await CalendarService.generateActivityICS(id, userId);

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="activity-${id}.ics"`);
    res.send(icsContent);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate calendar file',
    });
  }
});

// ============================================================================
// NOTIFICATION ROUTES
// ============================================================================

app.post('/push/subscribe', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Valid push subscription required' });
    }

    const subscription = await NotificationService.subscribe(userId, {
      endpoint,
      keys,
    });

    res.status(201).json({ subscription });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to subscribe',
    });
  }
});

app.post('/notify/test', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const result = await NotificationService.sendTestNotification(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to send test notification',
    });
  }
});

app.post('/notify/check', authMiddleware, async (_req, res) => {
  try {
    const [activities, budgets] = await Promise.all([
      NotificationService.checkUpcomingActivities(),
      NotificationService.checkLowBudgets(),
    ]);

    res.json({
      activitiesChecked: activities.checked,
      budgetAlertsSent: budgets.sent,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to check notifications',
    });
  }
});

app.post(['/voice/incoming', '/voice/incoming/'], async (req, res) => {
  try {
    const { CallSid, From } = req.body;
    console.log(`📞 Incoming call from ${From}`);

    // Generate TwiML instructions for Twilio
    const twiml = await VoiceService.handleIncomingCall(CallSid, From);

    // Send XML response back to Twilio
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error("Voice Error:", error);
    res.status(500).send('<Response><Say>System error.</Say></Response>');
  }
});

app.post('/voice/process', async (req, res) => {
  try {
    const { CallSid, SpeechResult, Digits } = req.body;
    const xmlResponse = await VoiceService.processInput(CallSid, SpeechResult, Digits);

    res.type('text/xml');
    res.send(xmlResponse);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error processing speech');
  }
});

// Handle Twilio call status updates (hangup, etc.)
app.post('/voice/status', async (req, res) => {
  try {
    const { CallSid, CallStatus } = req.body;
    console.log(`📞 Call ${CallSid} status: ${CallStatus}`);

    if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'canceled') {
      await VoiceService.handleCallEnd(CallSid);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Voice status error:', error);
    res.sendStatus(500);
  }
});

// ============================================================================
// START SERVER
// ============================================================================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Moja API running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
});
