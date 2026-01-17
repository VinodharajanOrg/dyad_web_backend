"use client";

import { useEffect } from "react";
import { PostHogProvider } from "posthog-js/react";
import posthog from "posthog-js";
import { getTelemetryUserId, isTelemetryOptedIn } from "@/hooks/useSettings";
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
  MutationCache,
} from "@tanstack/react-query";
import { showError } from "@/lib/toast";
import { Toaster } from "sonner";
import { VISIBLE_TOASTS, TOAST_POSITION } from "@/lib/constants";
import "@/styles/globals.css";
import { useUserInfo } from "@/hooks/useUserInfo";
import { usePathname } from "next/navigation";
import { PUBLIC_ROUTES } from "@/lib/constants";

interface MyMeta extends Record<string, unknown> {
  showErrorToast: boolean;
}

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: MyMeta;
    mutationMeta: MyMeta;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.showErrorToast) {
        showError(error);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.showErrorToast) {
        showError(error);
      }
    },
  }),
});

// NOTE: Initialize user info once at app level for authenticated routes
function UserInfoInit() {
  const pathname = usePathname();

  // Check if current route is a public route
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  // Only fetch user info on protected routes
  useUserInfo({ enabled: !isPublicRoute });

  return null;
}

function PostHogInit() {
  useEffect(() => {
    const init = async () => {
      if (isTelemetryOptedIn()) {
        try {
          const userId = await getTelemetryUserId();
          posthog.init("phc_yIk4uTRdwLYtoaXm7LQq2o8W8v3DPfQwO5KfxCGLxc8", {
            api_host: "https://us.i.posthog.com",
            person_profiles: "identified_only",
            capture_pageview: false,
            capture_pageleave: true,
          });

          if (userId) {
            posthog.identify(userId);
          }
        } catch (error) {
          console.error("Failed to initialize PostHog:", error);
        }
      }
    };

    init();
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Suppress React DevTools disconnected port errors in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const originalError = console.error;
      console.error = (...args: any[]) => {
        if (
          typeof args[0] === "string" &&
          args[0].includes("disconnected port object")
        ) {
          return; // Suppress this specific error
        }
        originalError.apply(console, args);
      };

      return () => {
        console.error = originalError;
      };
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PostHogProvider client={posthog}>
        <UserInfoInit />
        <PostHogInit />
        {children}
        <Toaster
          position={TOAST_POSITION}
          expand
          richColors
          closeButton
          visibleToasts={VISIBLE_TOASTS}
        />
      </PostHogProvider>
    </QueryClientProvider>
  );
}
