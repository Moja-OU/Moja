"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Send,
  Mic,
  Phone,
  CalendarDays,
  CheckCircle2,
  Zap,
  AlertCircle,
  BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { type ChatMessage } from "@/lib/mock-data"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { APIClient } from "@/lib/api"

const quickReplies = [
  "Book dinner at The Library tomorrow at 7pm for 2",
  "My goal is to run 3x/week",
  "Set food budget $60/week",
  "Add $18 Chipotle",
  "Confirmed",
]

const sampleActions = [
  { type: "CREATE_BOOKING", status: "executed" as const },
  { type: "EXPORT_CALENDAR_EVENT", status: "pending" as const },
]

const sampleMissing: string[] = []

const snapshotItems = [
  { label: "Bookings", value: "2 upcoming" },
  { label: "Activities", value: "2 planned" },
  { label: "Streak", value: "4 weeks" },
  { label: "Budget", value: "$42 / $60" },
]

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-secondary text-foreground rounded-bl-sm"
        )}
      >
        {message.content}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.actions.map((a) => (
              <Badge
                key={a}
                variant="outline"
                className="border-0 bg-primary/20 text-primary text-[10px] font-mono px-1.5 py-0"
              >
                {a}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TransferCTA() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-xl bg-secondary p-4 flex flex-col gap-3 rounded-bl-sm">
        <p className="text-sm text-foreground">
          Ready to transfer to The Library to confirm your reservation?
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="tel:+15552345678"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Phone className="h-3.5 w-3.5" />
            Transfer to Restaurant
          </a>
          <Button
            variant="outline"
            size="sm"
            className="border-success/30 text-success hover:bg-success/10 hover:text-success bg-transparent"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Confirmed
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          The Library: +1 (555) 234-5678
        </p>
      </div>
    </div>
  )
}

function ActionsPanel({ 
  actions = [],
  missingFields = [],
  dashboardSnapshot 
}: { 
  actions?: any[]
  missingFields?: string[]
  dashboardSnapshot?: any
}) {
  const [isOpen, setIsOpen] = useState(true)
  
  const snapshotItems = dashboardSnapshot ? [
    { label: "Bookings", value: `${dashboardSnapshot.upcomingBookings?.length || 0} upcoming` },
    { label: "Activities", value: `${dashboardSnapshot.upcomingActivities?.length || 0} planned` },
    { label: "Goals", value: `${dashboardSnapshot.goals?.length || 0} active` },
    { label: "Budget", value: dashboardSnapshot.budgets?.[0] ? 
      `$${dashboardSnapshot.budgets[0].remainingAmount} / $${dashboardSnapshot.budgets[0].limitAmount}` : "N/A" },
  ] : [
    { label: "Bookings", value: "Loading..." },
    { label: "Activities", value: "Loading..." },
    { label: "Goals", value: "Loading..." },
    { label: "Budget", value: "Loading..." },
  ]
  
  return (
    <div
      className={cn(
        "border-l border-border bg-card flex flex-col transition-all",
        isOpen ? "w-72" : "w-0 overflow-hidden border-l-0"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Actions Panel</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-muted-foreground"
          onClick={() => setIsOpen(false)}
        >
          Hide
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-5">
          {/* Actions Executed */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="h-3 w-3 text-primary" />
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Actions Executed
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {actions.length === 0 ? (
                <p className="text-xs text-muted-foreground/70 italic px-2.5">No actions yet</p>
              ) : (
                actions.map((a, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-secondary/70 text-xs"
                  >
                    <span className="font-mono text-foreground/80">{a.type}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-0 text-[10px]",
                        a.error ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"
                      )}
                    >
                      {a.error ? "failed" : "executed"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Missing Fields */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle className="h-3 w-3 text-warning" />
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Missing Fields
              </p>
            </div>
            {missingFields.length === 0 ? (
              <p className="text-xs text-muted-foreground/70 italic px-2.5">None - all clear</p>
            ) : (
              <div className="flex flex-col gap-1">
                {missingFields.map((f, idx) => (
                  <span key={idx} className="text-xs text-warning px-2.5">{f}</span>
                ))}
              </div>
            )}
          </div>

          {/* Dashboard Snapshot */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <BarChart3 className="h-3 w-3 text-primary" />
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Dashboard Snapshot
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              {snapshotItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between px-2.5 py-1 text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

export function CallView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your Moja AI assistant. I can help you book reservations, plan activities, set goals, and manage your budget. What would you like to do today?"
    }
  ])
  const [input, setInput] = useState("")
  const [showTransfer, setShowTransfer] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [actions, setActions] = useState<any[]>([])
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [dashboardSnapshot, setDashboardSnapshot] = useState<any>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const response = await APIClient.startSession('CHAT')
        setSessionId(response.session.id)
      } catch (error) {
        toast.error("Failed to start session")
        console.error(error)
      }
    }
    initSession()

    // Cleanup: end session on unmount
    return () => {
      if (sessionId) {
        APIClient.endSession(sessionId, "User left chat view").catch(console.error)
      }
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return
    
    const userMsg: ChatMessage = {
      id: `m${Date.now()}`,
      role: "user",
      content: input.trim(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsLoading(true)

    try {
      const response = await APIClient.executeAI(userMsg.content, sessionId || undefined, {
        recentMessages: messages.slice(-5).map(m => ({ role: m.role, content: m.content }))
      })

      const assistantMsg: ChatMessage = {
        id: `m${Date.now() + 1}`,
        role: "assistant",
        content: response.assistantMessage,
        actions: response.actions?.map((a: any) => a.type)
      }
      
      setMessages((prev) => [...prev, assistantMsg])
      setActions(response.actions || [])
      setMissingFields(response.missingFields || [])
      setDashboardSnapshot(response.dashboardSnapshot)
      
      // Show transfer CTA if booking was created
      if (response.actions?.some((a: any) => a.type === 'CREATE_BOOKING')) {
        setShowTransfer(true)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message")
      const errorMsg: ChatMessage = {
        id: `m${Date.now() + 1}`,
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again."
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickReply = (text: string) => {
    setInput(text)
  }

  return (
    <div className="flex h-full">
      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            {messages.map((m) => (
              <ChatBubble key={m.id} message={m} />
            ))}
            {showTransfer && <TransferCTA />}
          </div>
        </div>

        {/* Quick replies */}
        <div className="px-4 lg:px-6 pb-2">
          <div className="max-w-2xl mx-auto flex flex-wrap gap-1.5">
            {quickReplies.map((qr) => (
              <button
                key={qr}
                type="button"
                onClick={() => handleQuickReply(qr)}
                className="px-3 py-1 rounded-full bg-secondary text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                {qr}
              </button>
            ))}
          </div>
        </div>

        {/* Input dock */}
        <div className="p-4 lg:px-6 border-t border-border bg-card shrink-0">
          <div className="max-w-2xl mx-auto flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 border-border text-muted-foreground shrink-0 bg-transparent"
                    disabled
                  >
                    <Mic className="h-4 w-4" />
                    <span className="sr-only">Voice input (optional)</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-popover text-popover-foreground">
                  <p>Optional in MVP - Voice input</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Input
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && sendMessage()}
              disabled={isLoading}
              className="flex-1 bg-secondary border-border text-foreground placeholder:text-muted-foreground h-10"
            />
            <Button
              size="icon"
              className="h-10 w-10 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
              onClick={sendMessage}
              disabled={isLoading}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Actions panel - hidden on mobile */}
      <div className="hidden lg:flex">
        <ActionsPanel 
          actions={actions}
          missingFields={missingFields}
          dashboardSnapshot={dashboardSnapshot}
        />
      </div>
    </div>
  )
}
