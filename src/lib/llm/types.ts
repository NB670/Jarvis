/** Jarvis chat / tool surface — keep in sync with LLM system prompt */
export type JarvisSuggestedUpdate = {
  type:
    | "create_goal"
    | "update_goal"
    | "create_task"
    | "update_task"
    | "create_reflection";
  payload: Record<string, unknown>;
  reason: string;
};

export type JarvisChatJson = {
  message: string;
  suggested_updates: JarvisSuggestedUpdate[];
};

export type JarvisRecommendJson = {
  recommended_focus: string;
  why_it_matters: string;
  next_smallest_action: string;
  low_energy_fallback: string;
};

/** Jarvis memory system types */
export interface MemoryGoal {
  title: string
  horizon: 'long_term' | 'short_term'
  target?: string
  lastEngaged?: string
  priority?: 'low' | 'medium' | 'high'
}

export interface MemoryHabit {
  title: string
  frequency?: string
  lastMentioned?: string
}

export interface JarvisMemoryData {
  goals: MemoryGoal[]
  habits: MemoryHabit[]
  interests: string[]
  patterns: string[]
  keyFacts: string[]
  preferences: Record<string, string>
}

export const EMPTY_MEMORY: JarvisMemoryData = {
  goals: [],
  habits: [],
  interests: [],
  patterns: [],
  keyFacts: [],
  preferences: {},
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}
