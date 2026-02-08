"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  CalendarDays,
  Clock,
  Target,
  Wallet,
  Phone,
  MessageSquare,
  Download,
  Check,
  Repeat,
  AlertTriangle,
  Flame,
  Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  mockSessions,
  mockBookings,
  mockActivities,
  mockGoals,
  mockBudgets,
  mockExpenses,
  type Session,
  type Booking,
  type Activity,
} from "@/lib/mock-data"
import { SessionDetailModal } from "@/components/session-detail-modal"

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string }> = {
    DRAFT: { className: "bg-muted text-muted-foreground", label: "Draft" },
    PENDING_CONFIRMATION: { className: "bg-warning/15 text-warning", label: "Pending" },
    CONFIRMED: { className: "bg-success/15 text-success", label: "Confirmed" },
    CANCELLED: { className: "bg-destructive/15 text-destructive", label: "Cancelled" },
    PLANNED: { className: "bg-primary/15 text-primary", label: "Planned" },
    DONE: { className: "bg-success/15 text-success", label: "Done" },
    SKIPPED: { className: "bg-muted text-muted-foreground", label: "Skipped" },
    SENT: { className: "bg-success/15 text-success", label: "Sent" },
    FAILED: { className: "bg-destructive/15 text-destructive", label: "Failed" },
  }
  const c = config[status] ?? { className: "bg-muted text-muted-foreground", label: status }
  return (
    <Badge variant="outline" className={cn("border-0 text-[11px] font-semibold", c.className)}>
      {c.label}
    </Badge>
  )
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function SummaryCards() {
  const upcomingBookings = mockBookings.filter(
    (b) => b.status !== "CANCELLED"
  ).length
  const upcomingActivities = mockActivities.filter(
    (a) => a.status === "PLANNED"
  ).length
  const topStreak = mockGoals.reduce((max, g) => Math.max(max, g.streakCount), 0)
  const budget = mockBudgets[0]

  const cards = [
    {
      label: "Upcoming Bookings",
      value: upcomingBookings,
      icon: CalendarDays,
      accent: "text-primary",
    },
    {
      label: "Upcoming Activities",
      value: upcomingActivities,
      icon: Clock,
      accent: "text-primary",
    },
    {
      label: "Goal Streak",
      value: `${topStreak} weeks`,
      icon: Target,
      accent: "text-warning",
    },
    {
      label: "Budget Remaining",
      value: budget ? `$${budget.remainingAmount} / $${budget.limitAmount}` : "N/A",
      icon: Wallet,
      accent: budget && budget.remainingAmount / budget.limitAmount < 0.3 ? "text-destructive" : "text-success",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <Card key={c.label} className="bg-card border-border">
            <CardContent className="flex items-center gap-4 p-4">
              <div className={cn("flex items-center justify-center h-10 w-10 rounded-lg bg-secondary shrink-0")}>
                <Icon className={cn("h-5 w-5", c.accent)} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{c.label}</p>
                <p className="text-lg font-bold text-foreground leading-tight">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function SessionsCard({ onViewSession }: { onViewSession: (s: Session) => void }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">Recent Sessions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {mockSessions.map((s) => (
          <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center justify-center h-8 w-8 rounded-md bg-secondary shrink-0 mt-0.5">
              {s.channel === "VOICE" ? (
                <Phone className="h-3.5 w-3.5 text-primary" />
              ) : (
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge variant="outline" className="border-0 bg-primary/10 text-primary text-[10px] px-1.5 py-0">
                  {s.channel}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {formatDateTime(s.startedAt)}
                </span>
              </div>
              <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">{s.summary}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs text-muted-foreground hover:text-foreground h-7 px-2"
              onClick={() => onViewSession(s)}
            >
              <Eye className="h-3 w-3 mr-1" />
              Details
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function BookingsCard() {
  const [bookings, setBookings] = useState<Booking[]>(mockBookings)

  const handleConfirm = (id: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "CONFIRMED" as const } : b))
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">Upcoming Bookings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {bookings.map((b) => (
          <div key={b.id} className="p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-foreground">{b.businessName}</h4>
              <StatusBadge status={b.status} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
              <span>{formatDateTime(b.datetimeLocal)}</span>
              <span>Party of {b.partySize}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`tel:${b.businessPhone}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 transition-colors"
              >
                <Phone className="h-3 w-3" />
                Transfer call
              </a>
              {b.status !== "CONFIRMED" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-success hover:text-success hover:bg-success/10"
                  onClick={() => handleConfirm(b.id)}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Mark Confirmed
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                <Download className="h-3 w-3 mr-1" />
                Download .ics
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ActivitiesCard() {
  const [activities, setActivities] = useState<Activity[]>(mockActivities)

  const markDone = (id: string) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "DONE" as const } : a))
    )
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">Upcoming Activities</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {activities.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-foreground">{a.title}</span>
                <StatusBadge status={a.status} />
                {a.recurrenceRule && (
                  <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(a.datetimeLocal)} &middot; {a.durationMin}min
              </p>
            </div>
            {a.status === "PLANNED" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-success hover:text-success hover:bg-success/10 shrink-0"
                onClick={() => markDone(a.id)}
              >
                <Check className="h-3 w-3 mr-1" />
                Done
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function GoalsCard() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-foreground">Goals / Streaks</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {mockGoals.map((g) => (
          <div key={g.id} className="p-3 rounded-lg bg-secondary/50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-foreground">{g.title}</h4>
              <div className="flex items-center gap-1 text-warning">
                <Flame className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">{g.streakCount}w streak</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Target: {g.targetValue} {g.metric} ({g.frequency.toLowerCase()})
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
            >
              Generate plan
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function BudgetCard() {
  const [budget, setBudget] = useState(mockBudgets[0])
  const [expenses, setExpenses] = useState(mockExpenses)
  const [merchant, setMerchant] = useState("")
  const [amount, setAmount] = useState("")

  const percentage = budget ? (budget.remainingAmount / budget.limitAmount) * 100 : 0
  const isLow = percentage < 30

  const addExpense = () => {
    if (!merchant || !amount || !budget) return
    const amt = parseFloat(amount)
    if (Number.isNaN(amt) || amt <= 0) return
    const newExpense = {
      id: `e${expenses.length + 1}`,
      budgetId: budget.id,
      amount: amt,
      merchant,
      datetimeLocal: new Date().toISOString(),
      note: "",
    }
    setExpenses((prev) => [...prev, newExpense])
    setBudget((prev) =>
      prev ? { ...prev, remainingAmount: Math.max(0, prev.remainingAmount - amt) } : prev
    )
    setMerchant("")
    setAmount("")
  }

  if (!budget) return null

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">Budget</CardTitle>
          {isLow && (
            <Badge variant="outline" className="border-0 bg-warning/15 text-warning text-[11px] font-semibold gap-1">
              <AlertTriangle className="h-3 w-3" />
              Low budget
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {budget.category} ({budget.period.toLowerCase()})
            </span>
            <span className={cn("text-sm font-bold", isLow ? "text-warning" : "text-foreground")}>
              ${budget.remainingAmount} / ${budget.limitAmount}
            </span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Recent Expenses</p>
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-secondary/50">
              <span className="text-foreground/80">{e.merchant}</span>
              <span className="font-medium text-foreground">${e.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Merchant"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-xs h-8"
          />
          <Input
            placeholder="$"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-secondary border-border text-foreground placeholder:text-muted-foreground text-xs h-8 w-20"
          />
          <Button
            size="sm"
            className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 text-xs shrink-0"
            onClick={addExpense}
          >
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardView() {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  return (
    <div className="p-4 lg:p-6 flex flex-col gap-6">
      <div>
        <p className="text-xs text-muted-foreground mb-1">
          After each message, the app updates instantly.
        </p>
      </div>

      <SummaryCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SessionsCard onViewSession={setSelectedSession} />
        <BookingsCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ActivitiesCard />
        <GoalsCard />
        <BudgetCard />
      </div>

      <SessionDetailModal
        session={selectedSession}
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  )
}
