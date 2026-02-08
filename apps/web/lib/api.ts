const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class APIClient {
  private static token: string | null = null;

  static setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('moja_token', token);
    }
  }

  static getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('moja_token');
    }
    return this.token;
  }

  static clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('moja_token');
    }
  }

  private static async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Handle token expiration - auto logout
      if (response.status === 401) {
        this.clearToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
        throw new Error('Session expired. Please login again.');
      }

      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  static async login(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  static async register(email: string, password: string, name: string, phone?: string) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, phone }),
    });
    this.setToken(data.token);
    return data;
  }

  // Dashboard
  static async getDashboard() {
    return this.request('/dashboard');
  }

  // Sessions
  static async startSession(channel: 'VOICE' | 'CHAT') {
    return this.request('/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ channel }),
    });
  }

  static async endSession(sessionId: string, summary?: string) {
    return this.request(`/sessions/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({ summary }),
    });
  }

  // AI
  static async executeAI(userMessage: string, sessionId?: string, context?: any) {
    return this.request('/ai/execute', {
      method: 'POST',
      body: JSON.stringify({ userMessage, sessionId, context }),
    });
  }

  // Bookings
  static async confirmBooking(bookingId: string) {
    return this.request(`/bookings/${bookingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CONFIRMED' }),
    });
  }

  static async cancelBooking(bookingId: string) {
    return this.request(`/bookings/${bookingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
  }

  // Activities
  static async markActivityDone(activityId: string) {
    return this.request(`/activities/${activityId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'DONE' }),
    });
  }

  static async markActivitySkipped(activityId: string) {
    return this.request(`/activities/${activityId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'SKIPPED' }),
    });
  }

  // Expenses
  static async addExpense(budgetId: string, data: { amount: number; merchant: string; note?: string }) {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify({ budgetId, ...data }),
    });
  }

  // Sessions
  static async getSessionDetails(sessionId: string) {
    return this.request(`/sessions/${sessionId}`);
  }

  static async getSessions() {
    return this.request('/sessions');
  }

  // Goals
  static async generateGoalPlan(goalId: string, preferences?: any) {
    return this.request(`/goals/${goalId}/plan`, {
      method: 'POST',
      body: JSON.stringify({ preferences }),
    });
  }

  // Calendar Export
  static async exportBookingCalendar(bookingId: string): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/calendar/booking/${bookingId}.ics`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to export calendar');
    }

    return response.blob();
  }

  static async exportActivityCalendar(activityId: string): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/calendar/activity/${activityId}.ics`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to export calendar');
    }

    return response.blob();
  }
}
