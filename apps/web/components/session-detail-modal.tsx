"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Phone, MessageSquare } from "lucide-react"
import type { Session } from "@/lib/mock-data"

interface SessionDetailModalProps {
  session: Session | null
  open: boolean
  onClose: () => void
}

export function SessionDetailModal({ session, open, onClose }: SessionDetailModalProps) {
  if (!session) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {session.channel === "VOICE" ? (
              <Phone className="h-4 w-4 text-primary" />
            ) : (
              <MessageSquare className="h-4 w-4 text-primary" />
            )}
            <DialogTitle className="text-foreground">Session Details</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground">
            {session.channel} session &middot;{" "}
            {new Date(session.startedAt).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* AI Summary */}
          <div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5">
              AI Summary
            </p>
            <p className="text-sm text-foreground/90 leading-relaxed">{session.summary}</p>
          </div>

          {/* Intent Tags */}
          <div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5">
              Intent Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(session.intentTags || []).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="border-0 bg-primary/10 text-primary text-[11px] px-2 py-0.5"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Transcript */}
          <div>
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5">
              Transcript
            </p>
            <ScrollArea className="h-52 rounded-lg bg-secondary/50 p-3">
              <div className="flex flex-col gap-2">
                {(session.transcript || []).map((line: any, i) => {
                  // Handle both string (legacy) and object (new) formats
                  const isString = typeof line === "string"
                  const content = isString ? line : line.content
                  const isUser = isString
                    ? line.startsWith("User:")
                    : line.role === "user"

                  return (
                    <p
                      key={`line-${i}`}
                      className={
                        isUser
                          ? "text-xs text-primary font-medium"
                          : "text-xs text-foreground/70"
                      }
                    >
                      {content}
                    </p>
                  )
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
