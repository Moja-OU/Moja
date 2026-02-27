/* this file is the brain of the application */

import { GoogleGenAI, Type } from '@google/genai';
import { tavily } from "@tavily/core";

// --- Lazy-initialized SDK clients (created after dotenv.config() runs) ---
let _gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!_gemini) {
    _gemini = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return _gemini;
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
   * Returns the Gemini function declarations for tools (Search + Actions).
   */
  private static getGeminiTools(): any[] {
    return [
      // 1. SEARCH TOOL (Tavily)
      {
        name: 'perform_search',
        description: 'Search the web for real-time information. Use this for weather, checking if a restaurant is open, finding addresses, or looking up current events.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: {
              type: Type.STRING,
              description: 'The search query (e.g., "Weather in Miami", "The Library restaurant address St. Louis", "Movies playing near me")'
            }
          },
          required: ['query']
        }
      },

      // 2. ACTION EXECUTION TOOL (The "Doer")
      {
        name: 'execute_actions',
        description: 'Call this ONLY when the user explicitly requests an action (e.g., "Book this", "Add expense", "Set budget"). Do NOT use for general questions.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            assistant_message: {
              type: Type.STRING,
              description: 'A natural, human-like confirmation message to the user. (e.g. "I\'ve created a booking request for The Library at 7 PM.")'
            },
            missing_fields: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of fields that are still needed to complete the action (e.g., ["partySize", "time"]). Leave empty if all info is present.'
            },
            actions: {
              type: Type.ARRAY,
              description: 'The list of actions to perform.',
              items: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    description: 'The specific type of action: CREATE_BOOKING, CONFIRM_BOOKING, CREATE_ACTIVITY, CREATE_GOAL, GENERATE_GOAL_PLAN, SET_BUDGET, ADD_EXPENSE, CREATE_REMINDER, or EXPORT_CALENDAR_EVENT'
                  },
                  payload: {
                    type: Type.OBJECT,
                    description: `The data required for the action. 
                      - CREATE_BOOKING: { businessName, datetimeLocal (ISO string), partySize, notes }
                      - CREATE_ACTIVITY: { name, datetime (ISO string), type (EXERCISE/SOCIAL/WORK/GENERAL), duration (minutes) }
                      - SET_BUDGET: { category, amount, period (MONTHLY/WEEKLY) }
                      - ADD_EXPENSE: { merchant, amount, category, date }
                      - CREATE_REMINDER: { title, datetime (ISO string), priority }
                      - CREATE_GOAL: { title, targetDate, targetAmount }
                      - GENERATE_GOAL_PLAN: { goalId, milestones }
                    `,
                    properties: {}
                  }
                },
                required: ['type', 'payload']
              }
            }
          },
          required: ['assistant_message', 'missing_fields', 'actions']
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
      const model = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';

      // Build conversation contents for Gemini
      const contents: any[] = [];

      // Add recent messages as conversation history
      if (context.recentMessages) {
        for (const msg of context.recentMessages.slice(-5)) {
          const role = msg.role === 'assistant' ? 'model' : 'user';
          contents.push({ role, parts: [{ text: msg.content }] });
        }
      }

      // Add the current user message
      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      // Helper: retry with backoff for 429 rate-limit errors
      const callWithRetry = async (callContents: any[]) => {
        const MAX_RETRIES = 3;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            return await getGemini().models.generateContent({
              model,
              contents: callContents,
              config: {
                systemInstruction: systemPrompt,
                tools: [{ functionDeclarations: this.getGeminiTools() }],
              },
            });
          } catch (err: any) {
            if (err?.status === 429 && attempt < MAX_RETRIES - 1) {
              const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s
              console.warn(`⏳ Rate limited (429). Retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${MAX_RETRIES})`);
              await new Promise(r => setTimeout(r, delay));
              continue;
            }
            throw err;
          }
        }
        throw new Error('Max retries exceeded');
      };

      // --- PASS 1: Let AI decide (Search vs Talk vs Act) ---
      let response = await callWithRetry(contents);

      let candidate = response.candidates?.[0];
      let parts = candidate?.content?.parts || [];

      // Check for function calls
      let functionCall = parts.find((p: any) => p.functionCall)?.functionCall;

      // --- BRANCH A: Handle Search (if applicable) ---
      if (functionCall && functionCall.name === 'perform_search') {
        const searchArgs = functionCall.args as any;
        console.log(`[Search] query: ${searchArgs.query}`);

        // 1. Execute Search
        const searchData = await getTavily().search(searchArgs.query, { maxResults: 5 });

        // 2. Feed results back — add the model's function call and our tool response
        contents.push({
          role: 'model',
          parts: [{ functionCall: { name: 'perform_search', args: searchArgs } }]
        });
        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: 'perform_search',
              response: { results: searchData.results }
            }
          }]
        });

        // 3. PASS 2: AI processes results -> Decides to Talk or Act
        response = await callWithRetry(contents);

        candidate = response.candidates?.[0];
        parts = candidate?.content?.parts || [];
        functionCall = parts.find((p: any) => p.functionCall)?.functionCall;
      }

      // --- BRANCH B: Handle Actions ---
      if (functionCall && functionCall.name === 'execute_actions') {
        const result = functionCall.args as any;
        console.log(`\n[AI] tool call: execute_actions`);
        console.log(`   message: ${result.assistant_message}`);
        console.log(`   missing_fields: ${JSON.stringify(result.missing_fields)}`);
        console.log(`   actions (${(result.actions || []).length}):`, JSON.stringify(result.actions, null, 2));
        return {
          assistantMessage: result.assistant_message,
          missingFields: result.missing_fields || [],
          actions: result.actions || [],
        };
      }

      // --- Plain text response (no tool call) ---
      const textContent = parts.find((p: any) => p.text)?.text || '';
      console.log(`\n[AI] plain text response (no tool call). Content: ${textContent.substring(0, 100)}...`);
      return {
        assistantMessage: textContent || "I'm here to help! What's on your mind?",
        missingFields: [],
        actions: []
      };

    } catch (error: any) {
      console.error('AI Orchestrator error:', error?.message || error);
      console.error('   Stack:', error?.stack);
      console.error('   Status:', error?.status);
      console.error('   Code:', error?.code);
      // Write to debug file
      const fs = require('fs');
      fs.appendFileSync('debug_ai.log', `[${new Date().toISOString()}] AI Error:\n  Message: ${error?.message}\n  Status: ${error?.status}\n  Code: ${error?.code}\n  Stack: ${error?.stack}\n  Full: ${JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2)}\n\n`);

      // Return user-friendly messages based on error type
      let userMessage = "I'm sorry, I encountered an unexpected error. Please try again.";
      if (error?.status === 429) {
        userMessage = "I'm experiencing high demand right now. Please try again in a moment.";
      } else if (error?.status === 404) {
        userMessage = "AI service configuration error. Please contact support.";
      }
      return { assistantMessage: userMessage, missingFields: [], actions: [] };
    }
  }
  private static buildSystemPrompt(context: AIContext): string {
    const timezone = context.userProfile?.timezone || 'America/Chicago';
    let currentDate: string;
    try {
      currentDate = new Date().toLocaleString('en-US', { timeZone: timezone });
    } catch {
      // Fallback if timezone is invalid (e.g., "America/Oklahoma_City")
      console.warn(`⚠️ Invalid timezone "${timezone}", falling back to America/Chicago`);
      currentDate = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
    }

    return `
You are Moja, a smart, friendly AI concierge and personal assistant.

Current date/time (${timezone}): ${currentDate}

LANGUAGE
- Always detect the language the user is writing in.
- Reply in the SAME language the user uses.
- If the user switches languages mid-conversation, switch with them.
- If unsure, default to English.

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
- "Find", "near me", "open now"
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