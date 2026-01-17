import axios, { type AxiosInstance, type AxiosError } from "axios";
import {
  HTTP_TIMEOUT,
  MAX_HTTP_REDIRECTS,
  TOKEN_REFRESH_BUFFER,
} from "@/lib/constants";

// API client connects to Express server on port 3001
// Replaces Electron IPC with REST API calls
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRefreshing: boolean = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    // Clean up any legacy tokens from localStorage
    this.cleanupLegacyTokens();

    // Restore tokens from cookies on initialization (if browser environment)
    this.restoreTokensFromCookies();

    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest", // CSRF protection indicator
      },
      timeout: HTTP_TIMEOUT,
      maxRedirects: MAX_HTTP_REDIRECTS,
      withCredentials: true, // Include cookies in requests
      validateStatus: (status) => {
        // Allow 2xx and 3xx as success
        // Throw error for 401 (to trigger refresh interceptor) and 5xx
        if (status === 401) return false; // Trigger error interceptor for token refresh
        return status >= 200 && status < 500;
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor - handle 401 and token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        // If error is 401 and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest?._retry && originalRequest) {
          // Mark as retried to prevent infinite loops
          originalRequest._retry = true;

          // Try to restore tokens from cookies if not in memory
          if (!this.refreshToken) {
            await this.restoreTokensFromCookies();
          }

          // If still no refresh token available after restore, redirect immediately
          if (!this.refreshToken) {
            this.handleAuthFailure();
            return Promise.reject(error);
          }

          if (this.isRefreshing) {
            // If already refreshing, queue this request
            return new Promise((resolve, reject) => {
              this.refreshSubscribers.push((token: string) => {
                if (token) {
                  if (!originalRequest.headers) {
                    originalRequest.headers = {};
                  }
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                  resolve(this.client(originalRequest));
                } else {
                  reject(error);
                }
              });
            });
          }

          this.isRefreshing = true;

          try {
            const { accessToken, refreshToken, expiresIn } = await this.callRefreshTokenAPI(this.refreshToken);

            this.setTokens(accessToken, refreshToken, expiresIn);
            
            // Notify queued requests of success
            this.refreshSubscribers.forEach((callback) =>
              callback(accessToken),
            );
            this.refreshSubscribers = [];

            // Retry the original request with new token
            if (!originalRequest.headers) {
              originalRequest.headers = {};
            }
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            
            // Return the retried request (if it fails with 401 again, _retry flag will prevent loop)
            return this.client(originalRequest);
          } catch (refreshError: any) {
            // Refresh failed - clear tokens and redirect
            // Notify queued requests of failure
            this.refreshSubscribers.forEach((callback) => callback(""));
            this.refreshSubscribers = [];

            this.handleAuthFailure();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        // If 401 but already retried (originalRequest._retry is true), call handleAuthFailure
        if (error.response?.status === 401 && originalRequest?._retry) {
          this.handleAuthFailure();
        }

        return Promise.reject(error);
      },
    );
  }

  /**
   * Clean up legacy tokens from localStorage only
   * Cookies are managed by the backend and should not be cleared here
   */
  private cleanupLegacyTokens(): void {
    if (typeof window !== "undefined") {
      const legacyKeys = [
        "accessToken",
        "refreshToken",
        "token",
        "auth_token",
        "jwt_token",
        "session",
      ];

      legacyKeys.forEach((key) => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
        }
      });
    }
  }

  /**
   * Get a cookie value by name
   */
  private getCookie(name: string): string | null {
    if (typeof window === "undefined") return null;
    const match = document.cookie.match(
      new RegExp("(^| )" + name + "=([^;]+)"),
    );
    return match ? decodeURIComponent(match[2]) : null;
  }

  /**
   * Clear all authentication cookies
   */
  private clearAuthCookies(): void {
    // Guard against SSR/test environments where window or document is undefined
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const cookieKeys = [
      "accessToken",
      "refreshToken",
      "idToken",
      "expiresAt",
    ];
    
    cookieKeys.forEach((key) => {
      document.cookie = `${key}=; Max-Age=0; path=/;`;
      document.cookie = `${key}=; Max-Age=0; path=/; domain=${window.location.hostname}`;
      document.cookie = `${key}=; Max-Age=0; path=/; domain=.${window.location.hostname}`;
    });
  }

  /**
   * Clear all authentication data from both localStorage and cookies
   */
  private clearAllAuthStorage(): void {
    this.cleanupLegacyTokens(); // Clear localStorage
    this.clearAuthCookies();     // Clear cookies
  }

  /**
   * Extract tokens from refresh token API response
   * Backend returns snake_case format (access_token, refresh_token, expires_in)
   */
  private extractTokensFromResponse(response: any): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } | null {
    const data = response.data.data || response.data;

    const accessToken = data?.access_token;
    const refreshToken = data?.refresh_token;
    const expiresIn = data?.expires_in;

    if (!accessToken || !refreshToken) {
      return null;
    }

    return { accessToken, refreshToken, expiresIn };
  }

  /**
   * Call refresh token API
   * Returns tokens or throws error
   */
  private async callRefreshTokenAPI(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    userData?: any;
  }> {
    const response = await axios.post(
      `${API_BASE_URL}/auth/refreshToken`,
      { refreshToken },
      {
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
        validateStatus: (status) => status >= 200 && status < 300,
      },
    );

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(
        `Token refresh failed with status ${response.status}`,
      );
    }

    const tokens = this.extractTokensFromResponse(response);
    if (!tokens) {
      throw new Error("Token refresh failed: no tokens returned");
    }

    const data = response.data.data || response.data;
    return {
      ...tokens,
      userData: data.user,
    };
  }

  /**
   * Restore tokens from cookies on initialization
   * This allows ApiClient to self-initialize without needing SessionProvider
   */
  private async restoreTokensFromCookies(): Promise<void> {
    if (typeof window === "undefined") return;

    // Backend sets individual cookies: accessToken, refreshToken, expiresAt (duration in seconds)
    const accessToken = this.getCookie("accessToken");
    const refreshToken = this.getCookie("refreshToken");
    const expiresAtStr = this.getCookie("expiresAt");

    if (accessToken && refreshToken && expiresAtStr) {
      const expiresAt = expiresAtStr;
      // Backend sets expiresAt as duration in seconds (e.g., 360 for 6 minutes)
      const durationSeconds = parseInt(expiresAt, 10);

      // Check if duration is invalid or zero
      if (durationSeconds <= 0) {
        // Clear expired cookies
        this.clearAuthCookies();
        // Don't restore expired tokens
        return;
      }

      this.setTokens(accessToken, refreshToken, durationSeconds);
    } else if (!accessToken && refreshToken) {
      // If we have refresh token but no access token, try to refresh
      try {
        const { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn } = 
          await this.callRefreshTokenAPI(refreshToken);
        
        this.setTokens(newAccessToken, newRefreshToken, expiresIn);
      } catch {
        // Refresh failed, clear tokens
        this.clearTokens();
      }
    }
  }

  /**
   * Public method to restore tokens from cookies
   * Call this after SSO redirect to pick up new session cookies
   */
  public async restoreTokensFromCookiesPublic(): Promise<void> {
    await this.restoreTokensFromCookies();
  }

  /**
   * Handle authentication failure - clear session and redirect
   * Clears all auth data similar to logout
   */
  private handleAuthFailure(): void {
    this.clearTokens(); // This already clears cookies, localStorage, and memory

    // Clear all session-related data from localStorage
    localStorage.removeItem("session_metadata");

    // Redirect to login page
    this.redirectToLogin();
  }

  /**
   * Redirect to login page
   * Public method that can be called from logout or auth failure
   */
  public redirectToLogin(): void {
    if (typeof window === 'undefined') {
      return;
    }
    setTimeout(() => {
      window.location.href = "/login";
    }, 100);
  }

  /**
   * Schedule automatic token refresh based on expiry duration
   * If duration < 600 seconds, refresh at expiresIn/2
   * Otherwise, refresh TOKEN_REFRESH_BUFFER (5 minutes) before expiry
   */
  private scheduleTokenRefresh(durationSeconds: number): void {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!this.expiresAt || !this.refreshToken) {
      return;
    }

    const now = Date.now();
    const timeUntilExpiry = this.expiresAt - now;

    let refreshIn: number;

    // If duration is less than 600 seconds (10 minutes), refresh at half the duration
    if (durationSeconds < 600) {
      refreshIn = (durationSeconds * 1000) / 2;
    } else {
      // Otherwise, refresh TOKEN_REFRESH_BUFFER (5 minutes) before expiry
      refreshIn = timeUntilExpiry - TOKEN_REFRESH_BUFFER;
    }

    if (refreshIn <= 0) {
      // Token already expired or should refresh immediately
      this.performTokenRefresh();
      return;
    }

    this.refreshTimer = setTimeout(() => {
      this.performTokenRefresh();
    }, refreshIn);
  }

  /**
   * Perform token refresh and reschedule next refresh
   */
  private async performTokenRefresh(): Promise<void> {
    if (!this.refreshToken) {
      return;
    }

    if (this.isRefreshing) {
      return;
    }

    try {
      this.isRefreshing = true;

      const { accessToken, refreshToken, expiresIn, userData } = 
        await this.callRefreshTokenAPI(this.refreshToken);

      this.setTokens(accessToken, refreshToken, expiresIn);
      
      // Update metadata for display purposes only
      if (userData && expiresIn) {
        const metadata = {
          user: userData,
          expiresIn: expiresIn,
        };
        localStorage.setItem("session_metadata", JSON.stringify(metadata));
      }
    } catch {
      // On refresh failure, clear everything and redirect to login
      this.handleAuthFailure();
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Set tokens in memory with expiry time and schedule auto-refresh
   * Tokens are stored in instance variables and will be lost on page refresh
   * Backend session cookie is the source of truth
   */
  public setTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn?: number | string,
  ): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    // Convert to absolute timestamp in milliseconds and store duration for scheduling
    if (expiresIn) {
      const durationSeconds =
        typeof expiresIn === "string" ? parseInt(expiresIn, 10) : expiresIn;
      this.expiresAt = Date.now() + durationSeconds * 1000;

      // Schedule refresh based on duration
      if (this.expiresAt) {
        this.scheduleTokenRefresh(durationSeconds);
      }
    } else {
      this.expiresAt = null;
    }
  }

  /**
   * Clear tokens from memory and stop refresh timer
   * Also clears all auth data from localStorage and cookies
   */
  public clearTokens(): void {
    // Clear timer first
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Clear memory
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;

    // Clear both localStorage and cookies
    this.clearAllAuthStorage();
  }

  /**
   * Get current access token (for debugging only)
   */
  public getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Check if client has token in memory
   */
  public isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // Helper to unwrap backend response format { data: ... }
  private unwrapResponse<T>(responseData: any): T {
    // If response has a 'data' property, unwrap it
    if (
      responseData &&
      typeof responseData === "object" &&
      "data" in responseData
    ) {
      return responseData.data;
    }
    // Otherwise return as-is
    return responseData;
  }

  // HTTP methods
  public async get<T>(url: string, config?: any): Promise<T> {
    const response = await this.client.get(url, config);
    return this.unwrapResponse<T>(response.data);
  }

  public async getRaw<T>(url: string, config?: any): Promise<T> {
    const response = await this.client.get(url, config);
    return response.data as T;
  }

  public async post<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.post(url, data, config);
    return this.unwrapResponse<T>(response.data);
  }

  public async put<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.put(url, data, config);
    return this.unwrapResponse<T>(response.data);
  }

  public async delete<T>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete(url, config);
    return this.unwrapResponse<T>(response.data);
  }

  public async patch<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.patch(url, data, config);
    return this.unwrapResponse<T>(response.data);
  }
}

// Singleton instance
export const apiClient = new ApiClient();
