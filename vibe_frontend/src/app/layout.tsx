"use client";
import "@/styles/globals.css";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "../contexts/ThemeContext";
import { DeepLinkProvider } from "../contexts/DeepLinkContext";
import { Toaster } from "sonner";
import { TitleBar } from "./TitleBar";
import { usePathname } from "next/navigation";
import { Providers } from "./providers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { VISIBLE_TOASTS, TOAST_POSITION, PUBLIC_ROUTES } from "@/lib/constants";
import { apiClient } from "@/api/client";
import { AuthGuard } from "@/components/AuthGuard";

function LayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Restore tokens from cookies on mount and route changes (after SSO redirect)
  useEffect(() => {
    apiClient.restoreTokensFromCookiesPublic();
  }, [pathname]);

  // Check if current route is a public route (login)
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  return (
    <AuthGuard>
      <ThemeProvider>
        <DeepLinkProvider>
          {isPublicRoute ? (
            // Public routes: no sidebar, no titlebar
            <>
              {children}
              <Toaster
                position={TOAST_POSITION}
                expand
                richColors
                closeButton
                visibleToasts={VISIBLE_TOASTS}
              />
            </>
          ) : (
            // Protected routes: with sidebar and titlebar
            <SidebarProvider>
              <TitleBar />
              <AppSidebar />
              <div
                id="layout-main-content-container"
                className="flex h-screenish w-full overflow-x-hidden mt-12 mb-4 mr-4 border-t border-l border-border rounded-lg bg-background"
              >
                {children}
              </div>
              <Toaster
                position={TOAST_POSITION}
                expand
                richColors
                closeButton
                visibleToasts={VISIBLE_TOASTS}
              />
            </SidebarProvider>
          )}
        </DeepLinkProvider>
      </ThemeProvider>
    </AuthGuard>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="UTF-8" />
        <title>Vibe Coding</title>
      </head>
      <body>
        <Providers>
          <LayoutContent>{children}</LayoutContent>
        </Providers>
      </body>
    </html>
  );
}
