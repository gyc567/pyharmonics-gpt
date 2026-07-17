"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, AuthError, AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { UserProfile } from "@/types";

const MOCK_PROFILE: UserProfile = {
  id: "",
  email: "",
  role: "user",
  status: "active",
  daily_quota: 5,
  used_quota: 0,
};

export function useAuth() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    if (session?.user) {
      setProfile({
        ...MOCK_PROFILE,
        id: session.user.id,
        email: session.user.email || "",
      });
    } else {
      setProfile(null);
    }
  }, [supabase]);

  useEffect(() => {
    refreshSession().finally(() => setLoading(false));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setProfile({
          ...MOCK_PROFILE,
          id: session.user.id,
          email: session.user.email || "",
        });
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, refreshSession]);

  const signInWithOtp = useCallback(
    async (email: string) => {
      const redirectTo = `${window.location.origin}/dashboard`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      return { error };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  const getToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, [supabase]);

  return {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    signInWithOtp,
    signOut,
    getToken,
  };
}
