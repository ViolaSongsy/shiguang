export const MOODS = ["😊", "😌", "🥰", "🤩", "😐", "😔", "😢", "😟", "😤", "😴"] as const;

export type Mood = (typeof MOODS)[number];

export type Entry = {
  id: string;
  user_id: string;
  content: string;
  mood: Mood | null;
  context: string | null;
  intensity: number;
  created_at: string;
};

export type Reflection = {
  id: string;
  user_id: string;
  reflection_date: string;
  title: string;
  what_happened: string;
  main_emotions: string[];
  repeated_worries: string[];
  trigger: string;
  known_facts: string[];
  guesses: string[];
  fear_meaning: string;
  anxiety_story: string;
  kinder_interpretation: string;
  companion_note: string;
  next_step: string;
  theme_tags: string[];
  intensity: number;
  created_at: string;
};

export type ReflectionDraft = Omit<Reflection, "id" | "user_id" | "reflection_date" | "created_at">;
