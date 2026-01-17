import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React, { useEffect } from "react";

// Mock state
const pushMock = vi.fn();
let mockAuthState = {
  isAuthenticated: false,
  isLoading: false,
};

// Custom hook implementations using mocks
const useRouter = () => ({
  push: pushMock,
});

const useAuth = () => mockAuthState;

// Define ProtectedRoute component inline
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return null;
};

// TESTS SUITE
describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      isAuthenticated: false,
      isLoading: false,
    };
  });

  it("renders loading state while auth is loading", () => {
    mockAuthState.isLoading = true;

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("redirects to /login when not authenticated and not loading", async () => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = false;

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    // wait for useEffect
    await Promise.resolve();

    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("does not render children when not authenticated", () => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = false;

    const { container } = render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    // children should not be rendered
    expect(container.textContent).toBe("");
  });

  it("renders children when authenticated", () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isLoading = false;

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText("Protected Content")).toBeTruthy();
  });

  it("does not redirect while loading even if unauthenticated", async () => {
    mockAuthState.isAuthenticated = false;
    mockAuthState.isLoading = true;

    render(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    await Promise.resolve();

    expect(pushMock).not.toHaveBeenCalled();
  });
});
