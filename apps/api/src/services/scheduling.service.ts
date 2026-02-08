import { prisma } from '../config/database';

export class SchedulingService {
  /**
   * Create a new activity
   */
  static async createActivity(
    userId: string,
    data: {
      name: string;
      datetimeLocal: Date | string;
      durationMin?: number;
      recurrenceRule?: string;
      goalId?: string;
      sessionId?: string;
    }
  ) {
    const activity = await prisma.activity.create({
      data: {
        userId,
        name: data.name,
        datetimeLocal: new Date(data.datetimeLocal),
        durationMin: data.durationMin || 60,
        recurrenceRule: data.recurrenceRule,
        goalId: data.goalId,
        sessionId: data.sessionId,
        status: 'PLANNED',
      },
    });

    return activity;
  }

  /**
   * Mark activity as done
   */
  static async markDone(activityId: string, userId: string) {
    const activity = await prisma.activity.findFirst({
      where: { id: activityId, userId },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    const updated = await prisma.activity.update({
      where: { id: activityId },
      data: { status: 'DONE' },
    });

    // Update goal streak if activity is linked to a goal
    if (activity.goalId) {
      await this.updateGoalProgress(activity.goalId);
    }

    return updated;
  }

  /**
   * Mark activity as skipped
   */
  static async markSkipped(activityId: string, userId: string) {
    const activity = await prisma.activity.findFirst({
      where: { id: activityId, userId },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    return await prisma.activity.update({
      where: { id: activityId },
      data: { status: 'SKIPPED' },
    });
  }

  /**
   * Get upcoming activities for a user
   */
  static async getUpcoming(userId: string) {
    const now = new Date();

    return await prisma.activity.findMany({
      where: {
        userId,
        datetimeLocal: { gte: now },
        status: { not: 'SKIPPED' },
      },
      orderBy: { datetimeLocal: 'asc' },
      include: {
        goal: true,
      },
      take: 20,
    });
  }

  /**
   * Get activity by ID
   */
  static async getById(activityId: string, userId: string) {
    const activity = await prisma.activity.findFirst({
      where: { id: activityId, userId },
      include: { goal: true },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    return activity;
  }

  /**
   * Update goal progress based on completed activities
   */
  private static async updateGoalProgress(goalId: string) {
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: {
        activities: {
          where: { status: 'DONE' },
          orderBy: { datetimeLocal: 'desc' },
        },
      },
    });

    if (!goal) return;

    // Simple streak calculation: count recent completions
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentCompletions = goal.activities.filter(
      (a) => a.datetimeLocal >= weekAgo
    ).length;

    await prisma.goal.update({
      where: { id: goalId },
      data: { streakCount: recentCompletions },
    });
  }
}
