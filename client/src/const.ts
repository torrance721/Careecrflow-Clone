export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Get API base URL
export const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || '';
};

// Check if Google OAuth is configured
export const isGoogleOAuthConfigured = () => {
  return !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
};

// Generate login URL at runtime
export const getLoginUrl = () => {
  // If Google OAuth is configured, use Google login
  if (isGoogleOAuthConfigured()) {
    const apiUrl = getApiUrl();
    return `${apiUrl}/api/auth/google`;
  }

  // Legacy Manus OAuth
  if (import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID) {
    const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
    const appId = import.meta.env.VITE_APP_ID;
    const redirectUri = `${window.location.origin}/api/oauth/callback`;
    const state = btoa(redirectUri);

    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");

    return url.toString();
  }

  // Fallback to test login page in development
  return '/test-login';
};

// Get logout URL
export const getLogoutUrl = () => {
  const apiUrl = getApiUrl();
  return `${apiUrl}/api/auth/logout`;
};
