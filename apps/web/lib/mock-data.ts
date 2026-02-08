export interface Session {
  id: string
  channel: "VOICE" | "CHAT"
  startedAt: string
  summary: string
  transcript: string[]
  intentTags: string[]
}

export interface Booking {
  id: string
  businessName: string
  businessPhone: string
  datetimeLocal: string
  partySize: number
  status: "DRAFT" | "PENDING_CONFIRMATION" | "CONFIRMED" | "CANCELLED"
}

export interface Activity {
  id: string
  title: string
  datetimeLocal: string
  durationMin: number
  recurrenceRule: string | null
  status: "PLANNED" | "DONE" | "SKIPPED"
  goalId: string | null
}

export interface Goal {
  id: string
  title: string
  metric: string
  targetValue: number
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY"
  streakCount: number
}

export interface Budget {
  id: string
  category: string
  period: "WEEKLY" | "MONTHLY"
  limitAmount: number
  remainingAmount: number
}

export interface Expense {
  id: string
  budgetId: string
  amount: number
  merchant: string
  datetimeLocal: string
  note: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  actions?: string[]
  missingFields?: string[]
}

export const mockSessions: Session[] = [
  {
    id: "s1",
    channel: "VOICE",
    startedAt: "2026-02-07T14:23:00",
    summary: "Booked dinner at The Library for 2 at 7pm tomorrow. Calendar event created.",
    transcript: [
      "User: Book dinner at The Library tomorrow at 7pm for 2",
      "Agent: Got it! I'll book a dinner reservation at The Library for tomorrow at 7:00 PM, party of 2. Shall I proceed?",
      "User: Yes please",
      "Agent: Booking created! I can transfer you to The Library to confirm. Would you like that?",
      "User: Yes, transfer me",
      "Agent: Here's the number for The Library: +1 (555) 234-5678. Click to call when ready.",
      "User: Confirmed",
      "Agent: Great! Your reservation is confirmed. I've generated a calendar event for you to download.",
    ],
    intentTags: ["booking", "restaurant", "calendar"],
  },
  {
    id: "s2",
    channel: "CHAT",
    startedAt: "2026-02-07T10:05:00",
    summary: "Set running goal 3x/week and generated a weekly plan with Mon/Wed/Fri sessions.",
    transcript: [
      "User: My goal is to run 3 times a week. Can you help me plan?",
      "Agent: I'll set up a goal to run 3 times per week and create a plan for you. What days work best?",
      "User: Monday, Wednesday, and Friday mornings",
      "Agent: Perfect! I've created your running goal and scheduled sessions for Mon/Wed/Fri at 7:00 AM. Your streak tracker is active!",
    ],
    intentTags: ["goal", "fitness", "scheduling"],
  },
  {
    id: "s3",
    channel: "CHAT",
    startedAt: "2026-02-06T16:30:00",
    summary: "Created food budget of $60/week and added $18 Chipotle expense.",
    transcript: [
      "User: Set my food budget to $60 per week",
      "Agent: Done! Your weekly food budget is set to $60. I'll alert you when it gets low.",
      "User: Add $18 for Chipotle",
      "Agent: Added $18 Chipotle expense. You have $42 remaining this week (70%). I'll notify you if it drops below 20%.",
    ],
    intentTags: ["budget", "expense", "food"],
  },
]

export const mockBookings: Booking[] = [
  {
    id: "b1",
    businessName: "The Library",
    businessPhone: "+15552345678",
    datetimeLocal: "2026-02-08T19:00:00",
    partySize: 2,
    status: "PENDING_CONFIRMATION",
  },
  {
    id: "b2",
    businessName: "Sushi Zen",
    businessPhone: "+15559876543",
    datetimeLocal: "2026-02-10T12:30:00",
    partySize: 4,
    status: "CONFIRMED",
  },
]

export const mockActivities: Activity[] = [
  {
    id: "a1",
    title: "Morning Run",
    datetimeLocal: "2026-02-09T07:00:00",
    durationMin: 45,
    recurrenceRule: "WEEKLY;BYDAY=MO,WE,FR",
    status: "PLANNED",
    goalId: "g1",
  },
  {
    id: "a2",
    title: "Study Session",
    datetimeLocal: "2026-02-08T16:00:00",
    durationMin: 90,
    recurrenceRule: null,
    status: "PLANNED",
    goalId: null,
  },
  {
    id: "a3",
    title: "Morning Run",
    datetimeLocal: "2026-02-07T07:00:00",
    durationMin: 45,
    recurrenceRule: "WEEKLY;BYDAY=MO,WE,FR",
    status: "DONE",
    goalId: "g1",
  },
]

export const mockGoals: Goal[] = [
  {
    id: "g1",
    title: "Run 3x/week",
    metric: "runs/week",
    targetValue: 3,
    frequency: "WEEKLY",
    streakCount: 4,
  },
  {
    id: "g2",
    title: "Read 2 books/month",
    metric: "books/month",
    targetValue: 2,
    frequency: "MONTHLY",
    streakCount: 1,
  },
]

export const mockBudgets: Budget[] = [
  {
    id: "bu1",
    category: "Food",
    period: "WEEKLY",
    limitAmount: 60,
    remainingAmount: 42,
  },
]

export const mockExpenses: Expense[] = [
  {
    id: "e1",
    budgetId: "bu1",
    amount: 18,
    merchant: "Chipotle",
    datetimeLocal: "2026-02-07T12:30:00",
    note: "Lunch burrito bowl",
  },
]

export const mockChatMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "assistant",
    content: "Welcome to the AI Call Center. I can help you book restaurants, schedule activities, track goals, and manage budgets. How can I help you today?",
  },
  {
    id: "m2",
    role: "user",
    content: "Book dinner at The Library tomorrow at 7pm for 2",
  },
  {
    id: "m3",
    role: "assistant",
    content: "Got it! I'll book a dinner reservation at The Library for tomorrow at 7:00 PM, party of 2. Creating your booking now...",
    actions: ["CREATE_BOOKING"],
  },
  {
    id: "m4",
    role: "assistant",
    content: "Your booking at The Library is set! Would you like me to transfer you to the restaurant to confirm? You can click the \"Transfer to Restaurant\" button below.",
    actions: ["CREATE_BOOKING"],
  },
]
