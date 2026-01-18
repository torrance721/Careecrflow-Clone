import { getLoginUrl, getLogoutUrl, isGoogleOAuthConfigured } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

// Check if any OAuth is configured
const isOAuthConfigured = () => {
  return isGoogleOAuthConfigured() ||
    (!!import.meta.env.VITE_OAUTH_PORTAL_URL && !!import.meta.env.VITE_APP_ID);
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      // Call tRPC logout
      await logoutMutation.mutateAsync();

      // Also call REST logout endpoint for Google OAuth
      if (isGoogleOAuthConfigured()) {
        await fetch(getLogoutUrl(), {
          method: 'POST',
          credentials: 'include',
        });
      }
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      console.error("[Auth] Logout error:", error);
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      localStorage.removeItem("manus-runtime-user-info");

      // Redirect to login page after logout
      window.location.href = getLoginUrl();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    const user = meQuery.data ?? null;

    if (user) {
      localStorage.setItem(
        "manus-runtime-user-info",
        JSON.stringify(user)
      );
    }

    return {
      user,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(user),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;

    // Don't redirect if already on login-related pages
    const currentPath = window.location.pathname;
    if (currentPath === '/test-login' || currentPath === '/login') return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
    isOAuthConfigured: isOAuthConfigured(),
  };
}
