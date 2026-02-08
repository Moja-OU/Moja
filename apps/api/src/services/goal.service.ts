import { prisma } from '../config/database';
import { SchedulingService } from './scheduling.service';

export class GoalService {
  /**
   * Create a new goal
   */
  static async createGoal(
    userId: string,
    data: {
      title: string;
      metric: string;
      targetAmount: number;
      frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
    }
  ) {
    const goal = await prisma.goal.create({
      data: {
        userId,
        title: data.title,
        metric: data.metric,
        targetAmount: data.targetAmount,
        frequency: data.frequency,
        streakCount: 0,
      },
    });

    return goal;
  }

  /**
   * Generate activity plan for a goal
   * Uses heuristic: Mon/Wed/Fri at 6pm for 3x/week goals
   */
  static async generateGoalPlan(
    goalId: string,
    preferences?: {
      preferredTimes?: string[];
      preferredDays?: string[];
      weeksToGenerate?: number;
    }
  ) {
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: { user: true },
    });

    if (!goal) {
      throw new Error('Goal not found');
    }

    const activities = [];
    const weeksToGenerate = preferences?.weeksToGenerate || 4;
    const defaultTime = '18:00'; // 6:00 PM

    // Determine schedule based on target value and frequency
    let scheduleDays: number[]; // 0 = Sunday, 1 = Monday, etc.

    if (goal.frequency === 'WEEKLY') {
      if (goal.targetAmount === 3) {
        scheduleDays = [1, 3, 5]; // Mon, Wed, Fri
      } else if (goal.targetAmount === 2) {
        scheduleDays = [1, 4]; // Mon, Thu
      } else if (goal.targetAmount === 7) {
        scheduleDays = [0, 1, 2, 3, 4, 5, 6]; // Every day
      } else {
        // Default: spread evenly
        scheduleDays = this.spreadDaysEvenly(goal.targetAmount);
      }
    } else {
      // For now, just use 3x/week for other frequencies
      scheduleDays = [1, 3, 5];
    }

    // Generate activities for next N weeks
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Go to Sunday

    for (let week = 0; week < weeksToGenerate; week++) {
      for (const dayOfWeek of scheduleDays) {
        const activityDate = new Date(startOfWeek);
        activityDate.setDate(startOfWeek.getDate() + week * 7 + dayOfWeek);

        // Skip past dates
        if (activityDate < now) continue;

        // Set time
        const [hours, minutes] = defaultTime.split(':');
        activityDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        const activity = await SchedulingService.createActivity(goal.userId, {
          name: goal.title,
          datetimeLocal: activityDate,
          durationMin: 60,
          recurrenceRule: this.buildRecurrenceRule(scheduleDays),
          goalId: goal.id,
        });

        activities.push(activity);
      }
    }

    return { goal, activities };
  }

  /**
   * Update goal streak based on completions
   */
  static async updateStreak(goalId: string) {
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: {
        activities: {
          where: { status: 'DONE' },
          orderBy: { datetimeLocal: 'desc' },
        },
      },
    });

    if (!goal) {
      throw new Error('Goal not found');
    }

    // Calculate streak based on frequency
    const now = new Date();
    let periodStart: Date;

    if (goal.frequency === 'WEEKLY') {
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 7);
    } else if (goal.frequency === 'BIWEEKLY') {
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 14);
    } else {
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - 30);
    }

    const completionsInPeriod = goal.activities.filter(
      (a) => a.datetimeLocal >= periodStart
    ).length;

    await prisma.goal.update({
      where: { id: goalId },
      data: { streakCount: completionsInPeriod },
    });

    return completionsInPeriod;
  }

  /**
   * Get goal progress
   */
  static async getProgress(goalId: string) {
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: {
        activities: {
          where: { status: 'DONE' },
        },
      },
    });

    if (!goal) {
      throw new Error('Goal not found');
    }

    return {
      goal,
      completed: goal.streakCount,
      target: goal.targetAmount,
      percentage: goal.targetAmount > 0 ? (goal.streakCount / goal.targetAmount) * 100 : 0,
    };
  }

  /**
   * Get all goals for a user
   */
  static async getByUser(userId: string) {
    return await prisma.goal.findMany({
      where: { userId },
      include: {
        activities: {
          where: { status: { in: ['PLANNED', 'DONE'] } },
          orderBy: { datetimeLocal: 'asc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Helper: Spread days evenly across week
   */
  private static spreadDaysEvenly(count: number): number[] {
    if (count >= 7) return [0, 1, 2, 3, 4, 5, 6];

    const days: number[] = [];
    const interval = Math.floor(7 / count);

    for (let i = 0; i < count; i++) {
      days.push((i * interval + 1) % 7); // Start from Monday
    }

    return days;
  }

  /**
   * Helper: Build iCalendar recurrence rule
   */
  private static buildRecurrenceRule(dayNumbers: number[]): string {
    const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const days = dayNumbers.map((d) => dayMap[d]).join(',');
    return `WEEKLY;BYDAY=${days}`;
  }
}
