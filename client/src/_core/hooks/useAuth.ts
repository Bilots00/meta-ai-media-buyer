import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

// Auto-authenticated — no redirect to login needed
export function useAuth() {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout-simple", { method: "POST", credentials: "include" });
    } catch {}
    window.location.href = "/";
  }, []);

  const state = useMemo(() => ({
    user: meQuery.data ?? { id: 1, name: "Andrea Bilotta", email: "andrea.bilotta00@gmail.com", role: "admin" },
    loading: false,
    error: null,
    isAuthenticated: true,
  }), [meQuery.data]);

  return { ...state, refresh: () => meQuery.refetch(), logout };
}
