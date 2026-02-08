import { AzureOpenAI } from 'openai';
import { tavily } from "@tavily/core";

// --- Lazy-initialized SDK clients (created after dotenv.config() runs) ---
let _openai: AzureOpenAI | null = null;
function getOpenAI(): AzureOpenAI {
  if (!_openai) {
    _openai = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview',
    });
  }
  return _openai;
}

let _tvly: ReturnType<typeof tavily> | null = null;
function getTavily() {
  if (!_tvly) {
    _tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
  }
  return _tvly;
}



// --- Types ---
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

// --- The Orchestrator ---
export class AIOrchestrator {
  
  /**
   * Main entry point: Interpret user message, searching if necessary, 
   * and returning structured actions.
   */

  /**
   * Returns the definitions for all available tools (Search + Actions).
   */
  private static getTools() {
    return [
      // 1. SEARCH TOOL (Tavily)
      {
        type: 'function',
        function: {
          name: 'perform_search',
          description: 'Search the web for real-time information. Use this for weather, checking if a restaurant is open, finding addresses, or looking up current events.',
          parameters: {
            type: 'object',
            properties: {
              query: { 
                type: 'string', 
                description: 'The search query (e.g., "Weather in Miami", "The Library restaurant address St. Louis", "Movies playing near me")' 
              }
            },
            required: ['query']
          }
        }
      },

      // 2. ACTION EXECUTION TOOL (The "Doer")
      {
        type: 'function',
        function: {
          name: 'execute_actions',
          description: 'Call this ONLY when the user explicitly requests an action (e.g., "Book this", "Add expense", "Set budget"). Do NOT use for general questions.',
          parameters: {
            type: 'object',
            properties: {
              assistant_message: { 
                type: 'string', 
                description: 'A natural, human-like confirmation message to the user. (e.g. "I\'ve created a booking request for The Library at 7 PM.")' 
              },
              missing_fields: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'List of fields that are still needed to complete the action (e.g., ["partySize", "time"]). Leave empty if all info is present.'
              },
              actions: {
                type: 'array',
                description: 'The list of actions to perform.',
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
                        'EXPORT_CALENDAR_EVENT'
                      ],
                      description: 'The specific type of action to execute.'
                    },
                    payload: { 
                      type: 'object',
                      description: `The data required for the action. 
                        - CREATE_BOOKING: { businessName, address, datetimeLocal (ISO string), partySize, specialRequests }
                        - SET_BUDGET: { category, amount, period (MONTHLY/WEEKLY) }
                        - ADD_EXPENSE: { merchant, amount, category, date }
                        - CREATE_REMINDER: { title, datetime, priority }
                        - CREATE_GOAL: { title, targetDate, targetAmount }
                        - GENERATE_GOAL_PLAN: { goalId, milestones }
                      `
                    }
                  },
                  required: ['type', 'payload']
                }
              }
            },
            required: ['assistant_message', 'missing_fields', 'actions']
          }
        }
      }
    ];
  }

  static validateAction(action: AIAction): boolean {
  if (!action.type || !action.payload) return false;

  switch (action.type) {
    case 'CREATE_BOOKING':
      return !!(action.payload.businessName && action.payload.datetimeLocal);
    case 'SET_BUDGET':
      return !!(action.payload.category && action.payload.amount);
    default:
      return true; 
  }
}
  static async interpretMessage(
    userMessage: string,
    context: AIContext
  ): Promise<AIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      
      let messages: any[] = [{ role: 'system', content: systemPrompt }];
      if (context.recentMessages) messages.push(...context.recentMessages.slice(-5));
      messages.push({ role: 'user', content: userMessage });

      // --- PASS 1: Let AI decide (Search vs Talk vs Act) ---
      let response = await getOpenAI().chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
        messages,
        tools: this.getTools() as any, // Cast to 'any' to avoid strict union mismatch issues
        tool_choice: 'auto', 
      });

      let responseMessage = response.choices[0].message;
      let toolCalls = responseMessage.tool_calls;

      // --- BRANCH A: Handle Search (if applicable) ---
      // TS FIX: We first check if toolCalls exists, then grab the first one.
      if (toolCalls && toolCalls.length > 0) {
        const firstTool = toolCalls[0];

        // TS FIX: STRICT TYPE GUARD
        // We must check firstTool.type === 'function' before accessing .function
        if (firstTool.type === 'function' && firstTool.function.name === 'perform_search') {
          
          const searchArgs = JSON.parse(firstTool.function.arguments);
          console.log(`🕵️ Searching for: ${searchArgs.query}`);
          
          // 1. Execute Search
          const searchData = await getTavily().search(searchArgs.query, { maxResults: 5 });
          
          // 2. Feed results back to history
          messages.push(responseMessage);
          messages.push({
            role: 'tool',
            tool_call_id: firstTool.id,
            content: `Search Results: ${JSON.stringify(searchData.results)}`
          });

          // 3. PASS 2: AI processes results -> Decides to Talk or Act
          response = await getOpenAI().chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
            messages,
            tools: this.getTools() as any,
            tool_choice: 'auto' 
          });
          
          // Update the response message for the next step
          responseMessage = response.choices[0].message;
          toolCalls = responseMessage.tool_calls;
        }
      }

      // --- BRANCH B: Handle Actions ---
      // TS FIX: Re-check toolCalls for the final response
      if (toolCalls && toolCalls.length > 0) {
        const finalTool = toolCalls[0];

        // TS FIX: Again, strict check for 'function' type
        if (finalTool.type === 'function' && finalTool.function.name === 'execute_actions') {
          const result = JSON.parse(finalTool.function.arguments);
          return {
            assistantMessage: result.assistant_message,
            missingFields: result.missing_fields || [],
            actions: result.actions || [],
          };
        }
      }


      return {
        assistantMessage: responseMessage.content || "I'm here to help! What's on your mind?",
        missingFields: [],
        actions: []
      };

    } catch (error) {
      console.error('AI Orchestrator error:', error);
      return { assistantMessage: "I encountered a system error.", missingFields: [], actions: [] };
    }
  }
  private static buildSystemPrompt(context: AIContext): string {
  const timezone = context.userProfile?.timezone || 'America/Chicago';
  const currentDate = new Date().toLocaleString('en-US', { timeZone: timezone });

  return `
You are Moja, a smart, friendly AI concierge and personal assistant.

Current date/time (${timezone}): ${currentDate}

PERSONALITY
- Natural, conversational, and helpful
- Speak like a human assistant
- Do NOT sound robotic or scripted

MEMORY
- You have access to recent conversation history from past sessions.
- If the user asks "what did we talk about last time?" or references a past conversation, use the message history provided to answer.
- Summarize past interactions naturally when asked.

CORE BEHAVIOR (VERY IMPORTANT)

Default behavior: NORMAL CONVERSATION.

Only use tools when necessary.

Decision priority:
1) Conversation (default)
2) perform_search → for real-world information
3) execute_actions → ONLY for explicit commands

---

WHEN TO USE perform_search

Use perform_search if the user asks about:
- Weather
- Restaurants or places
- Business hours
- Addresses or phone numbers
- “Find”, “near me”, “open now”
- Events, news, or real-time info

Examples:
User: "What's the weather today?"
→ perform_search

User: "Find open restaurants near me"
→ perform_search

User: "Is Olive Garden open?"
→ perform_search

---

WHEN TO USE execute_actions

Only if the user explicitly asks to create or change something.

Examples:
"Book a table at 7"
"Set a grocery budget of $300"
"Add a $20 expense"
"Remind me tomorrow at 9"
"Create a goal"

If the user is only asking for information → DO NOT call execute_actions.

---

CRITICAL RULES

- NEVER create bookings unless the user clearly asks to book.
- NEVER assume intent.
- NEVER hallucinate addresses or business details.
- If required information is missing → ask the user instead of acting.
- If search results are unclear → ask for clarification.
- If the user is chatting casually → just respond normally.

---

ACTION MESSAGE RULE

When using execute_actions:
Say:
"I have generated a request"
NOT:
"I have booked it"

---

AVAILABLE ACTION TYPES

CREATE_BOOKING  
CONFIRM_BOOKING  
CREATE_ACTIVITY  
CREATE_GOAL  
GENERATE_GOAL_PLAN  
SET_BUDGET  
ADD_EXPENSE  
CREATE_REMINDER  
EXPORT_CALENDAR_EVENT  

Be helpful, natural, and precise.
`;
}

}