"use client"

import { useState } from "react"
import { Toaster } from "sonner"
import { AppShell, type ViewType } from "@/components/app-shell"
import { LoginView } from "@/components/login-view"
import { DashboardView } from "@/components/dashboard-view"
import { CallView } from "@/components/call-view"
import { SettingsView } from "@/components/settings-view"

export default function Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentView, setCurrentView] = useState<ViewType>("dashboard")

  if (!isLoggedIn) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <LoginView onLogin={() => setIsLoggedIn(true)} />
      </>
    )
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <AppShell currentView={currentView} onViewChange={setCurrentView}>
        {currentView === "dashboard" && <DashboardView />}
        {currentView === "call" && <CallView />}
        {currentView === "settings" && <SettingsView />}
      </AppShell>
    </>
  )
}
