import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl, isGoogleOAuthConfigured } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, loading, setLocation]);

  // Check for error in URL params
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get("error");

  const handleGoogleLogin = () => {
    window.location.href = getLoginUrl();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-primary">C</span>
          </div>
          <CardTitle className="text-2xl">Welcome to Careerflow</CardTitle>
          <CardDescription>
            Sign in to access your personalized job search dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error === "auth_failed" && "Authentication failed. Please try again."}
              {error === "no_code" && "No authorization code received."}
              {error === "not_configured" && "OAuth is not configured."}
              {error !== "auth_failed" && error !== "no_code" && error !== "not_configured" && `Error: ${error}`}
            </div>
          )}

          {isGoogleOAuthConfigured() ? (
            <Button
              onClick={handleGoogleLogin}
              className="w-full h-12 text-base"
              size="lg"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>
          ) : (
            <div className="text-center text-sm text-muted-foreground p-4 bg-secondary rounded-lg">
              <p>OAuth is not configured.</p>
              <p className="mt-2">Please set up Google OAuth credentials to enable login.</p>
            </div>
          )}

          <div className="text-center text-xs text-muted-foreground mt-6">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
