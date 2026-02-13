"use client"

import { useState, useEffect } from "react"
import { toast, Toaster } from "sonner"
import { AppShell, type ViewType } from "@/components/app-shell"
import { LoginView } from "@/components/login-view"
import { DashboardView } from "@/components/dashboard-view"
import { CallView } from "@/components/call-view"
import { SettingsView } from "@/components/settings-view"
import { APIClient } from "@/lib/api"

export default function Page() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentView, setCurrentView] = useState<ViewType>("dashboard")
  const [isChecking, setIsChecking] = useState(true)
  const [user, setUser] = useState<{ name: string; email: string } | undefined>(undefined)

  // Check for existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = APIClient.getToken()
      if (token) {
        try {
          // Validate token by attempting to fetch dashboard
          const dashboardData = await APIClient.getDashboard()
          setUser(dashboardData.user)
          setIsLoggedIn(true)
        } catch (error) {
          // Token invalid or expired
          APIClient.clearToken()
        }
      }
      setIsChecking(false)
    }
    checkAuth()
  }, [])

  const handleLogout = () => {
    APIClient.clearToken()
    setUser(undefined)
    setIsLoggedIn(false)
    setCurrentView("dashboard")
    toast.success("Logged out successfully")
  }

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <LoginView onLogin={(user) => {
          setUser(user)
          setIsLoggedIn(true)
        }} />
      </>
    )
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <AppShell
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
        user={user}
      >
        {currentView === "dashboard" && <DashboardView />}
        {currentView === "call" && <CallView />}
        {currentView === "settings" && <SettingsView />}
      </AppShell>
    </>
  )
}
