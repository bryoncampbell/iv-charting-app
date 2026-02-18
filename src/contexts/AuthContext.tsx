"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Profile, AppRole } from "@/types/profile";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isAdmin: boolean;
  isActive: boolean;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);
      setUser(s?.user ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
    if (!isSupabaseConfigured() || !supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [loadSession]);

  const loadProfile = useCallback(async (uid: string) => {
    if (!supabase) return;
    const { data } = await supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
    setProfile(data as Profile | null);
  }, []);

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured() || !supabase) {
      setProfile(null);
      return;
    }
    loadProfile(user.id);
  }, [user?.id, loadProfile]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error("Supabase not configured") };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ?? null };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) return { error: new Error("Supabase not configured") };
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    return { error: error ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const role = profile?.role ?? null;
  const isAdmin = profile?.role === "admin" && (profile?.is_active ?? false);
  const isActive = profile?.is_active ?? true;

  const value: AuthContextValue = {
    user,
    session,
    profile,
    role,
    isAdmin,
    isActive,
    loading,
    signInWithPassword,
    signInWithMagicLink,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
