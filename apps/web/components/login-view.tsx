"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Headphones } from "lucide-react"
import { APIClient } from "@/lib/api"

interface LoginViewProps {
  onLogin: () => void
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error("Please enter email and password")
      return
    }

    // Basic email validation
    if (!email.includes('@')) {
      toast.error("Please enter a valid email address")
      return
    }

    setIsLoading(true)
    try {
      const response = await APIClient.login(email, password)
      toast.success("Login successful!")
      onLogin()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setIsLoading(true)
    try {
      // Use test credentials
      await APIClient.login("test@moja.com", "1234")
      toast.success("Demo login successful!")
      onLogin()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Demo login failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleLogin()
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <Card className="w-full max-w-sm bg-card border-border">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mx-auto mb-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/15">
              <Headphones className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl text-foreground">UmojaLife</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to your account or try the demo
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-foreground">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="test@moja.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password" className="text-foreground">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              className="bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <Button
            variant="outline"
            className="w-full border-border text-foreground hover:bg-secondary bg-transparent"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Login"}
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            onClick={handleDemoLogin}
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Demo Login"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Fast demo mode (no real PSTN)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
