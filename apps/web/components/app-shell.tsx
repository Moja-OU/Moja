"use client"

import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Phone,
  Settings,
  Menu,
  X,
  Headphones,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

export type ViewType = "dashboard" | "call" | "settings"

const navItems: { id: ViewType; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "call", label: "Call AI Agent", icon: Phone },
  { id: "settings", label: "Settings", icon: Settings },
]

interface AppShellProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  onLogout?: () => void
  children: ReactNode
}

function SidebarContent({
  currentView,
  onViewChange,
  onItemClick,
  onLogout,
}: {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  onItemClick?: () => void
  onLogout?: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/15">
          <Headphones className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground leading-tight">UmojaLife</h1>
          <p className="text-[11px] text-muted-foreground leading-tight">Plan. Budget. Achieve</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2" aria-label="Main navigation">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentView === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onViewChange(item.id)
                    onItemClick?.()
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-4 py-4 border-t border-border">
        {onLogout && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="w-full justify-start text-muted-foreground hover:text-foreground mb-2"
          >
            Logout
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground">Fast demo mode (no real PSTN)</p>
      </div>
    </div>
  )
}

export function AppShell({ currentView, onViewChange, onLogout, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 flex-col border-r border-border bg-card">
        <SidebarContent currentView={currentView} onViewChange={onViewChange} onLogout={onLogout} />
      </aside>

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0 bg-card">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            currentView={currentView}
            onViewChange={onViewChange}
            onItemClick={() => setMobileOpen(false)}
            onLogout={onLogout}
          />
        </SheetContent>
      </Sheet>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <h2 className="text-sm font-semibold text-foreground capitalize">
              {currentView === "call" ? "Call AI Agent" : currentView}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
              <span>Demo User</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="text-[11px] text-muted-foreground hidden sm:inline">Online</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
