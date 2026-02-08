"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Bell, Globe, CalendarDays } from "lucide-react"
import { toast } from "sonner"

const timezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
]

export function SettingsView() {
  const [pushEnabled, setPushEnabled] = useState(false)
  const [timezone, setTimezone] = useState("America/New_York")

  const handleTestNotification = () => {
    toast("Reminder: Dinner at The Library in 30 minutes", {
      description: "Tomorrow at 7:00 PM - Party of 2",
      duration: 5000,
    })
    setTimeout(() => {
      toast.warning("Low Budget Alert", {
        description: "Food budget is below 30% ($42 / $60 remaining)",
        duration: 5000,
      })
    }, 1500)
    setTimeout(() => {
      toast.success("Calendar .ics Ready", {
        description: "Your booking calendar event is ready for download",
        duration: 5000,
      })
    }, 3000)
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl">
      <div className="flex flex-col gap-6">
        {/* Push Notifications */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold text-foreground">Push Notifications</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              Get alerts for upcoming activities, bookings, and low budget warnings.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="push-toggle" className="text-sm text-foreground">
                Enable web push
              </Label>
              <Switch
                id="push-toggle"
                checked={pushEnabled}
                onCheckedChange={setPushEnabled}
              />
            </div>
            <Button
              variant="outline"
              className="w-fit border-border text-foreground hover:bg-secondary bg-transparent"
              onClick={handleTestNotification}
            >
              Send test notification
            </Button>
          </CardContent>
        </Card>

        {/* Timezone */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold text-foreground">Timezone</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              Set your timezone for accurate scheduling and reminders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-full max-w-xs bg-secondary border-border text-foreground">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz} className="text-foreground">
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Default Availability */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold text-foreground">Default Availability</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              Set your default available hours for scheduling suggestions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-secondary/50">
                <span className="text-sm text-foreground w-24">Weekdays</span>
                <span className="text-sm text-muted-foreground">9:00 AM - 6:00 PM</span>
              </div>
              <div className="flex items-center gap-4 px-3 py-2 rounded-lg bg-secondary/50">
                <span className="text-sm text-foreground w-24">Weekends</span>
                <span className="text-sm text-muted-foreground">10:00 AM - 4:00 PM</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Editable availability coming soon. The AI uses these defaults for scheduling.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
