"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AppUser } from "@/lib/auth";
import type { Entry, Mood, Reflection, ReflectionDraft } from "@/lib/types";

type DataContextValue = {
  loading: boolean;
  user: AppUser | null;
  entries: Entry[];
  reflections: Reflection[];
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  addEntry: (input: { content: string; mood: Mood | null }) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  addReflection: (draft: ReflectionDraft, date: string) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

async function readError(response: Response) {
  const body = await response.json().catch(() => ({}));
  return body.error ?? "出了一点问题，请再试一次。";
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);

  async function loadJournal() {
    const response = await fetch("/api/journal", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setEntries(data.entries);
    setReflections(data.reflections);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then(async (body) => {
        if (!active) return;
        setUser(body.user);
        if (body.user) {
          const journal = await fetch("/api/journal", { cache: "no-store" });
          if (journal.ok && active) {
            const data = await journal.json();
            setEntries(data.entries);
            setReflections(data.reflections);
          }
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function authenticate(endpoint: "login" | "signup", email: string, password: string) {
    const response = await fetch(`/api/auth/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) return readError(response);
    const body = await response.json();
    setUser(body.user);
    await loadJournal();
    return null;
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setEntries([]);
    setReflections([]);
  }

  async function addEntry(input: { content: string; mood: Mood | null }) {
    const response = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(await readError(response));
    const { entry } = await response.json();
    setEntries((current) => [entry as Entry, ...current]);
  }

  async function deleteEntry(id: string) {
    const response = await fetch(`/api/entries/${id}`, { method: "DELETE" });
    if (!response.ok) throw new Error(await readError(response));
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  async function addReflection(draft: ReflectionDraft, date: string) {
    const response = await fetch("/api/reflections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, reflection_date: date }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const { reflection } = await response.json();
    setReflections((current) => [reflection as Reflection, ...current.filter((item) => item.reflection_date !== date)]);
  }

  return (
    <DataContext.Provider value={{
      loading, user, entries, reflections,
      signIn: (email, password) => authenticate("login", email, password),
      signUp: (email, password) => authenticate("signup", email, password),
      signOut, addEntry, deleteEntry, addReflection,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useJournal() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useJournal must be used inside DataProvider");
  return context;
}
