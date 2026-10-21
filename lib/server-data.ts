import type { Entry, Reflection, ReflectionDraft } from "@/lib/types";

type ReflectionRow = Omit<Reflection, "main_emotions" | "repeated_worries" | "known_facts" | "guesses" | "theme_tags"> & {
  main_emotions: string;
  repeated_worries: string;
  known_facts: string;
  guesses: string;
  theme_tags: string;
};

export function parseReflection(row: ReflectionRow): Reflection {
  return {
    ...row,
    main_emotions: JSON.parse(row.main_emotions),
    repeated_worries: JSON.parse(row.repeated_worries),
    known_facts: JSON.parse(row.known_facts),
    guesses: JSON.parse(row.guesses),
    theme_tags: JSON.parse(row.theme_tags),
  };
}

export type { Entry, ReflectionDraft, ReflectionRow };
