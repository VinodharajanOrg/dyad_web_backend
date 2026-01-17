import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  authApi,
  AuthResponse,
  LoginParams,
} from "../endpoints/auth";
import * as apiClientModule from "../client";

// Mock apiClient
vi.mock("../client", () => ({
  apiClient: {
    get: vi.fn(),
    getRaw: vi.fn(),
    post: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
    isAuthenticated: vi.fn(),
    redirectToLogin: vi.fn(),
  },
}));

describe("authApi - Complete Test Suite", () => {
  const mockApiClient = apiClientModule.apiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.location.href for logout test
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper: Mock AuthResponse
  const createMockAuthResponse = (
    overrides?: Partial<AuthResponse>
  ): AuthResponse => ({
    user: {
      id: 1,
      email: "test@example.com",
      name: "Test User",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
      ...overrides?.user,
    },
    accessToken: "access123",
    refreshToken: "refresh123",
    expiresAt: 1234567890,
    ...overrides,
  });

  // LOGIN
  describe("login()", () => {
    it("should login user and set tokens", async () => {
      const params: LoginParams = { email: "u@test.com", password: "pass" };
      const mockResponse = createMockAuthResponse();

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await authApi.login(params);

      expect(mockApiClient.post).toHaveBeenCalledWith("/auth/login", params);
      expect(mockApiClient.setTokens).toHaveBeenCalledWith(
        mockResponse.accessToken,
        mockResponse.refreshToken,
        mockResponse.expiresAt
      );
      expect(result.accessToken).toBe("access123");
    });

    it("should throw error on login failure", async () => {
      vi.mocked(mockApiClient.post).mockRejectedValueOnce(
        new Error("Invalid credentials")
      );

      await expect(
        authApi.login({ email: "bad", password: "wrong" })
      ).rejects.toThrow("Invalid credentials");
    });
  });

  // LOGOUT
  describe("logout()", () => {
    it("should clear tokens and redirect on logout", async () => {
      await authApi.logout();

      expect(mockApiClient.clearTokens).toHaveBeenCalled();
      expect(mockApiClient.redirectToLogin).toHaveBeenCalled();
    });

    it("should clear tokens even if logout is called multiple times", async () => {
      await authApi.logout();
      await authApi.logout();

      expect(mockApiClient.clearTokens).toHaveBeenCalledTimes(2);
      expect(mockApiClient.redirectToLogin).toHaveBeenCalledTimes(2);
    });
  });

  describe("getUserInfo()", () => {
    it("should return current user info", async () => {
      const mockUserInfoResponse = {
        data: {
          sub: "10",
          email: "current@example.com",
          name: "Current User",
          email_verified: true,
          preferred_username: "current",
          given_name: "Current",
          family_name: "User",
        },
        roles: ['user'],
      };

      vi.mocked(mockApiClient.getRaw).mockResolvedValueOnce(mockUserInfoResponse);

      const result = await authApi.getUserInfo();

      expect(mockApiClient.getRaw).toHaveBeenCalledWith("/auth/userinfo");
      expect(result.data.email).toBe("current@example.com");
    });

    it("should throw error if /userinfo fails", async () => {
      vi.mocked(mockApiClient.getRaw).mockRejectedValueOnce(new Error("Unauthorized"));

      await expect(authApi.getUserInfo()).rejects.toThrow("Unauthorized");
    });
  });

  // REFRESH TOKEN
  describe("refresh()", () => {
    it("should refresh tokens and set new tokens", async () => {
      const mockResponse = createMockAuthResponse({
        accessToken: "newAccess",
        refreshToken: "newRefresh",
        expiresAt: 9876543210,
      });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await authApi.refresh("refreshToken123");

      expect(mockApiClient.post).toHaveBeenCalledWith("/auth/refresh", {
        refreshToken: "refreshToken123",
      });

      expect(mockApiClient.setTokens).toHaveBeenCalledWith(
        "newAccess",
        "newRefresh",
        9876543210
      );

      expect(result.accessToken).toBe("newAccess");
    });

    it("should throw error when refresh fails", async () => {
      vi.mocked(mockApiClient.post).mockRejectedValueOnce(
        new Error("Refresh failed")
      );

      await expect(authApi.refresh("xx")).rejects.toThrow("Refresh failed");
    });
  });

  // isAuthenticated()
  describe("isAuthenticated()", () => {
    it("should return true when tokens exist", () => {
      vi.mocked(mockApiClient.isAuthenticated).mockReturnValueOnce(true);

      const result = authApi.isAuthenticated();
      expect(result).toBe(true);
    });

    it("should return false when no token", () => {
      vi.mocked(mockApiClient.isAuthenticated).mockReturnValueOnce(false);

      expect(authApi.isAuthenticated()).toBe(false);
    });
  });

  // INTEGRATION-STYLE SEQUENCES
  describe("Integration scenarios", () => {
    it("should login → getUserInfo", async () => {
      const loginResponse = createMockAuthResponse({
        user: { id: 1, email: "l@test.com", name: "Login User", createdAt: new Date(), updatedAt: new Date() },
      });
      const userInfoResponse = {
        data: {
          sub: '1',
          email: "l@test.com",
          name: "Login User",
          email_verified: true,
          preferred_username: 'loginuser',
          given_name: 'Login',
          family_name: 'User'
        },
        roles: ['user']
      };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(loginResponse);
      vi.mocked(mockApiClient.getRaw).mockResolvedValueOnce(userInfoResponse);

      const loggedIn = await authApi.login({
        email: "l@test.com",
        password: "123",
      });
      expect(loggedIn.user.email).toBe("l@test.com");

      const userInfo = await authApi.getUserInfo();
      expect(userInfo.data.name).toBe("Login User");
    });

    it("should login → refresh token → getUserInfo", async () => {
      const loginRes = createMockAuthResponse({
        accessToken: "oldAccess",
        refreshToken: "oldRefresh",
        expiresAt: 1111111111,
      });
      const refreshRes = createMockAuthResponse({
        accessToken: "newAccess",
        refreshToken: "newRefresh",
        expiresAt: 2222222222,
      });
      const userInfoRes = {
        data: {
          sub: '1',
          email: "test@example.com",
          name: "Test User",
          email_verified: true,
          preferred_username: 'testuser',
          given_name: 'Test',
          family_name: 'User'
        },
        roles: ['user']
      };

      vi.mocked(mockApiClient.post)
        .mockResolvedValueOnce(loginRes) // login
        .mockResolvedValueOnce(refreshRes); // refresh

      vi.mocked(mockApiClient.getRaw).mockResolvedValueOnce(userInfoRes);

      const login = await authApi.login({ email: "x", password: "y" });
      expect(login.accessToken).toBe("oldAccess");

      const refresh = await authApi.refresh("oldRefresh");
      expect(refresh.accessToken).toBe("newAccess");

      const userInfo = await authApi.getUserInfo();
      expect(userInfo.data.email).toBe("test@example.com");
    });
  });
});
