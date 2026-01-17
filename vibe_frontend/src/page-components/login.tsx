"use client";

import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function LoginPage() {
  const handleSSOLogin = () => {
    // Redirect to backend SSO login - backend handles Keycloak and sets session cookie
    window.location.href = `${API_URL}/auth/login`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg border bg-card p-8 shadow-lg">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Welcome to Vibe Coding</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your organization account
          </p>
        </div>

        <div className="space-y-6">
          <Button
            onClick={handleSSOLogin}
            className="w-full h-12 text-base font-medium"
            size="lg"
          >
            Login with SSO
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-muted-foreground/20" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Secure Sign-In
              </span>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            You will be redirected to your organization's login page. Your
            credentials are never stored on this device.
          </p>
        </div>
      </div>
    </div>
  );
}
