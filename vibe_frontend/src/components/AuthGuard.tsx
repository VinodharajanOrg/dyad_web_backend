"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { PUBLIC_ROUTES } from "@/lib/constants";

/**
 * AuthGuard component - Protects routes by checking for valid authentication
 * Redirects to /login if no access token is found in cookies
 * Runs on every route change to ensure protection
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if current route is public
    const isPublicRoute = PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    );

    // Skip auth check for public routes
    if (isPublicRoute) {
      setIsChecking(false);
      return;
    }

    // Check if user has valid access token in cookies
    const checkAuth = () => {
      // Try to restore tokens from cookies
      apiClient.restoreTokensFromCookiesPublic();

      // Check if authenticated (has access token in memory)
      const isAuthenticated = apiClient.isAuthenticated();

      if (!isAuthenticated) {
        // No valid token found, redirect to login
        console.warn(
          "[AuthGuard] No valid authentication token found, redirecting to /login",
        );
        router.replace("/login");
        return;
      }

      setIsChecking(false);
    };

    checkAuth();
  }, [pathname, router]);

  // Show nothing while checking (prevents flash of protected content)
  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
