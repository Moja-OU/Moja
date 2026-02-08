import { PrismaClient } from '@prisma/client';
import webpush from 'web-push';

const prisma = new PrismaClient();

// Initialize web push with VAPID keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:demo@moja.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export class NotificationService {
  /**
   * Subscribe user to push notifications
   */
  static async subscribe(
    userId: string,
    subscription: {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    }
  ) {
    // Check if subscription already exists
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint: subscription.endpoint },
    });

    if (existing) {
      return existing;
    }

    // Create new subscription
    return await prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  /**
   * Schedule a notification
   */
  static async scheduleNotification(
    userId: string,
    type: 'UPCOMING_ACTIVITY' | 'LOW_BUDGET' | 'BOOKING_REMINDER',
    payload: Record<string, any>,
    scheduledFor: Date
  ) {
    return await prisma.notification.create({
      data: {
        userId,
        type,
        payload: JSON.stringify(payload),
        scheduledFor,
        status: 'SCHEDULED',
      },
    });
  }

  /**
   * Send push notification to user
   */
  static async sendPushNotification(
    userId: string,
    data: {
      title: string;
      body: string;
      icon?: string;
      badge?: string;
      data?: Record<string, any>;
    }
  ) {
    // Get user's push subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      console.log('No push subscriptions found for user:', userId);
      return { sent: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title: data.title,
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: data.badge || '/badge-72x72.png',
      data: data.data || {},
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
        sent++;
      } catch (error) {
        console.error('Failed to send push notification:', error);
        failed++;

        // Remove invalid subscriptions
        if ((error as any).statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }

    return { sent, failed };
  }

  /**
   * Check and send notifications for upcoming activities
   */
  static async checkUpcomingActivities() {
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    // Find activities starting in the next 30 minutes
    const upcomingActivities = await prisma.activity.findMany({
      where: {
        status: 'PLANNED',
        datetimeLocal: {
          gte: now,
          lte: thirtyMinutesFromNow,
        },
      },
      include: { user: true },
    });

    for (const activity of upcomingActivities) {
      // Check if notification already exists
      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId: activity.userId,
          type: 'UPCOMING_ACTIVITY',
          payload: { contains: activity.id },
        },
      });

      if (existingNotif) continue;

      // Create and send notification
      const minutesUntil = Math.round(
        (activity.datetimeLocal.getTime() - now.getTime()) / 60000
      );

      await this.sendPushNotification(activity.userId, {
        title: 'Upcoming Activity',
        body: `${activity.title} starting in ${minutesUntil} minutes`,
        data: { activityId: activity.id },
      });

      // Record notification
      await this.scheduleNotification(
        activity.userId,
        'UPCOMING_ACTIVITY',
        { activityId: activity.id, title: activity.title },
        now
      );

      await prisma.notification.updateMany({
        where: {
          userId: activity.userId,
          type: 'UPCOMING_ACTIVITY',
          payload: { contains: activity.id },
        },
        data: { status: 'SENT', sentAt: now },
      });
    }

    return { checked: upcomingActivities.length };
  }

  /**
   * Check and send notifications for low budgets
   */
  static async checkLowBudgets() {
    // Fetch all budgets and filter in-memory (simpler for SQLite)
    const allBudgets = await prisma.budget.findMany();
    
    const budgets = allBudgets.filter(
      (b) => b.remainingAmount <= b.limitAmount * 0.2 && b.remainingAmount > 0
    );

    let sent = 0;

    for (const budget of budgets) {
      // Check if already notified recently
      const recentNotif = await prisma.notification.findFirst({
        where: {
          userId: budget.userId,
          type: 'LOW_BUDGET',
          payload: { contains: budget.id },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24h
        },
      });

      if (recentNotif) continue;

      // Send notification
      await this.sendPushNotification(budget.userId, {
        title: 'Budget Alert',
        body: `${budget.category} budget low: $${budget.remainingAmount.toFixed(2)} remaining of $${budget.limitAmount.toFixed(2)}`,
        data: { budgetId: budget.id },
      });

      await this.scheduleNotification(
        budget.userId,
        'LOW_BUDGET',
        {
          budgetId: budget.id,
          category: budget.category,
          remaining: budget.remainingAmount,
          limit: budget.limitAmount,
        },
        new Date()
      );

      sent++;
    }

    return { sent };
  }

  /**
   * Send test notification
   */
  static async sendTestNotification(userId: string) {
    return await this.sendPushNotification(userId, {
      title: 'Test Notification',
      body: 'Your notifications are working! 🎉',
    });
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(userId: string, limit = 20) {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { scheduledFor: 'desc' },
      take: limit,
    });
  }
}
