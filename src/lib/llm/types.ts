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
