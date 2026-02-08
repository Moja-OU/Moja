import { AzureOpenAI } from 'openai';

// Azure OpenAI configuration
const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview',
});

export type ActionType =
  | 'CREATE_BOOKING'
  | 'CONFIRM_BOOKING'
  | 'CREATE_ACTIVITY'
  | 'CREATE_GOAL'
  | 'GENERATE_GOAL_PLAN'
  | 'SET_BUDGET'
  | 'ADD_EXPENSE'
  | 'CREATE_REMINDER'
  | 'EXPORT_CALENDAR_EVENT';

export interface AIAction {
  type: ActionType;
  payload: Record<string, any>;
}

export interface AIResponse {
  assistantMessage: string;
  missingFields: string[];
  actions: AIAction[];
}

export interface AIContext {
  recentMessages?: Array<{ role: string; content: string }>;
  userProfile?: {
    timezone: string;
    userId: string;
    preferences?: any;
  };
}

export class AIOrchestrator {
  /**
   * Interpret user message and return structured actions
   */
  static async interpretMessage(
    userMessage: string,
    context: AIContext
  ): Promise<AIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
      ];

      // Add recent conversation history
      if (context.recentMessages && context.recentMessages.length > 0) {
        messages.push(...context.recentMessages.slice(-5)); // Last 5 messages
      }

      // Add current user message
      messages.push({ role: 'user', content: userMessage });

      // Call OpenAI with function calling
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
        messages,
        tools: [
          {
            type: 'function',
            function: {
              name: 'execute_actions',
              description: 'Execute structured actions based on user commands',
              parameters: {
                type: 'object',
                properties: {
                  assistant_message: {
                    type: 'string',
                    description: 'Friendly response to user',
                  },
                  missing_fields: {
                    type: 'array',
                    description: 'List of required fields that are missing',
                    items: { type: 'string' },
                  },
                  actions: {
                    type: 'array',
                    description: 'List of actions to execute',
                    items: {
                      type: 'object',
                      properties: {
                        type: {
                          type: 'string',
                          enum: [
                            'CREATE_BOOKING',
                            'CONFIRM_BOOKING',
                            'CREATE_ACTIVITY',
                            'CREATE_GOAL',
                            'GENERATE_GOAL_PLAN',
                            'SET_BUDGET',
                            'ADD_EXPENSE',
                            'CREATE_REMINDER',
                            'EXPORT_CALENDAR_EVENT',
                          ],
                        },
                        payload: {
                          type: 'object',
                          description: 'Action-specific data',
                        },
                      },
                      required: ['type', 'payload'],
                    },
                  },
                },
                required: ['assistant_message', 'missing_fields', 'actions'],
              },
            },
          },
        ],
        tool_choice: {
          type: 'function',
          function: { name: 'execute_actions' },
        },
      });

      // Parse response
      const toolCall = response.choices[0].message.tool_calls?.[0];
      if (!toolCall) {
        throw new Error('No tool call returned from AI');
      }

      // Type guard: ensure it's a function tool call
      if (toolCall.type !== 'function') {
        throw new Error('Expected function tool call');
      }

      const result = JSON.parse(toolCall.function.arguments);

      return {
        assistantMessage: result.assistant_message,
        missingFields: result.missing_fields || [],
        actions: result.actions || [],
      };
    } catch (error) {
      console.error('AI Orchestrator error:', error);
      
      // Fallback response
      return {
        assistantMessage: "I'm having trouble understanding that. Could you rephrase?",
        missingFields: [],
        actions: [],
      };
    }
  }

  /**
   * Build system prompt with context
   */
  private static buildSystemPrompt(context: AIContext): string {
    const timezone = context.userProfile?.timezone || 'America/Chicago';
    const currentDate = new Date().toLocaleString('en-US', { timeZone: timezone });

    return `You are an AI call center assistant for Moja. Parse user commands into structured actions.

Current date/time (${timezone}): ${currentDate}

RULES:
1. If required information is missing, ask a clarifying question and return NO actions
2. Parse dates naturally ("tomorrow" = next day, "next Monday" = upcoming Monday)
3. For bookings: need businessName, datetimeLocal, partySize
4. For activities: need title, datetimeLocal
5. For goals: need title, metric, targetValue, frequency
6. For budgets: need category, period, limitAmount
7. For expenses: need amount, merchant
8. Always return valid JSON with assistant_message, missing_fields, and actions

EXAMPLES:
- "Book dinner tomorrow at 7pm for 2 at The Library" → CREATE_BOOKING
- "Schedule study session Wed 4pm" → CREATE_ACTIVITY
- "My goal is to run 3 times per week" → CREATE_GOAL + GENERATE_GOAL_PLAN
- "Set food budget $60/week" → SET_BUDGET
- "Add $18 Chipotle" → ADD_EXPENSE (assumes active budget)

Be conversational but precise. Confirm actions clearly.`;
  }

  /**
   * Validate action payload
   */
  static validateAction(action: AIAction): boolean {
    if (!action.payload) return false;

    switch (action.type) {
      case 'CREATE_BOOKING':
        return !!(
          action.payload.businessName &&
          action.payload.datetimeLocal &&
          action.payload.partySize
        );
      case 'CREATE_ACTIVITY':
        return !!(action.payload.title && action.payload.datetimeLocal);
      case 'CREATE_GOAL':
        return !!(
          action.payload.title &&
          action.payload.metric &&
          action.payload.targetValue &&
          action.payload.frequency
        );
      case 'SET_BUDGET':
        return !!(
          action.payload.category &&
          action.payload.period &&
          action.payload.limitAmount
        );
      case 'ADD_EXPENSE':
        return !!(action.payload.amount && action.payload.merchant);
      default:
        return true;
    }
  }
}
