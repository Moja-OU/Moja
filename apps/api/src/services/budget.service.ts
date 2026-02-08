import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class BudgetService {
  /**
   * Create a new budget
   */
  static async createBudget(
    userId: string,
    data: {
      category: 'FOOD' | 'FUN' | 'GENERAL';
      period: 'WEEKLY' | 'MONTHLY';
      limitAmount: number;
    }
  ) {
    const budget = await prisma.budget.create({
      data: {
        userId,
        category: data.category,
        period: data.period,
        limitAmount: data.limitAmount,
        remainingAmount: data.limitAmount, // Start with full amount
        startDate: new Date(),
      },
    });

    return budget;
  }

  /**
   * Add an expense to a budget
   */
  static async addExpense(
    userId: string,
    budgetId: string,
    data: {
      amount: number;
      merchant: string;
      note?: string;
    }
  ) {
    // Verify budget exists and belongs to user
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });

    if (!budget) {
      throw new Error('Budget not found');
    }

    // Create expense
    const expense = await prisma.expense.create({
      data: {
        userId,
        budgetId,
        amount: data.amount,
        merchant: data.merchant,
        note: data.note,
        datetimeLocal: new Date(),
      },
    });

    // Update budget remaining amount
    const newRemaining = budget.remainingAmount - data.amount;
    const updatedBudget = await prisma.budget.update({
      where: { id: budgetId },
      data: { remainingAmount: newRemaining },
    });

    // Check if low budget threshold reached (20%)
    const threshold = budget.limitAmount * 0.2;
    if (newRemaining <= threshold && newRemaining > 0) {
      await this.createLowBudgetNotification(userId, updatedBudget);
    }

    return { expense, budget: updatedBudget };
  }

  /**
   * Get current budgets for a user
   */
  static async getCurrentBudgets(userId: string) {
    const budgets = await prisma.budget.findMany({
      where: { userId },
      include: {
        expenses: {
          orderBy: { datetimeLocal: 'desc' },
          take: 10,
        },
      },
      orderBy: { startDate: 'desc' },
    });

    return budgets;
  }

  /**
   * Get budget by ID
   */
  static async getById(budgetId: string, userId: string) {
    const budget = await prisma.budget.findFirst({
      where: { id: budgetId, userId },
      include: {
        expenses: {
          orderBy: { datetimeLocal: 'desc' },
        },
      },
    });

    if (!budget) {
      throw new Error('Budget not found');
    }

    return budget;
  }

  /**
   * Get recent expenses for a user
   */
  static async getRecentExpenses(userId: string, limit = 20) {
    return await prisma.expense.findMany({
      where: { userId },
      include: {
        budget: {
          select: {
            category: true,
            period: true,
          },
        },
      },
      orderBy: { datetimeLocal: 'desc' },
      take: limit,
    });
  }

  /**
   * Create low budget notification
   */
  private static async createLowBudgetNotification(
    userId: string,
    budget: any
  ) {
    const payload = {
      budgetId: budget.id,
      category: budget.category,
      remaining: budget.remainingAmount,
      limit: budget.limitAmount,
      message: `${budget.category} budget low: $${budget.remainingAmount.toFixed(2)} remaining of $${budget.limitAmount.toFixed(2)}`,
    };

    await prisma.notification.create({
      data: {
        userId,
        type: 'LOW_BUDGET',
        payload: JSON.stringify(payload),
        scheduledFor: new Date(),
        status: 'SCHEDULED',
      },
    });
  }

  /**
   * Check all budgets for low threshold
   */
  static async checkLowBudgets(userId: string) {
    const budgets = await prisma.budget.findMany({
      where: { userId },
    });

    const lowBudgets = budgets.filter(
      (b) => b.remainingAmount <= b.limitAmount * 0.2 && b.remainingAmount > 0
    );

    return lowBudgets;
  }
}
