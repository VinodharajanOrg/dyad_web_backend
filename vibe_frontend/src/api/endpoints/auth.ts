import { apiClient } from "../client";

export interface User {
  id: number;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: number | string;
}

export interface UserInfo {
  sub: string;
  email_verified: boolean;
  name: string;
  preferred_username: string;
  given_name: string;
  family_name: string;
  email: string;
}

export interface UserInfoResponse {
  data: UserInfo;
  roles: string[];
}

export interface LoginParams {
  email: string;
  password: string;
}

export const authApi = {
  /**
   * Login user
   * POST /api/auth/login
   */
  login: async (params: LoginParams): Promise<AuthResponse> => {
    const data = await apiClient.post<AuthResponse>("/auth/login", params);
    apiClient.setTokens(data.accessToken, data.refreshToken, data.expiresAt);
    return data;
  },

  /**
   * Logout user
   * POST /api/auth/logout
   */
  logout: async (): Promise<void> => {
    // Temporarily disabled backend logout call
    // try {
    //   const getCookie = (name: string): string | null => {
    //     if (typeof window === 'undefined') return null;
    //     const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    //     return match ? decodeURIComponent(match[2]) : null;
    //   };

    //   const idToken = getCookie('idToken');
    //   await apiClient.post('/auth/logout', { idToken }, { withCredentials: true });
    // } finally {
    apiClient.clearTokens();
    apiClient.redirectToLogin();
    // }
  },

  /**
   * Refresh access token
   * POST /api/auth/refresh
   * Used automatically by apiClient when access token expires
   */
  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const data = await apiClient.post<AuthResponse>("/auth/refresh", {
      refreshToken,
    });
    apiClient.setTokens(data.accessToken, data.refreshToken, data.expiresAt);
    return data;
  },

  /**
   * Check if user is authenticated
   * Client-side check only - validates if JWT token exists in localStorage
   * Does not call backend API
   */
  isAuthenticated: (): boolean => {
    return apiClient.isAuthenticated();
  },

  /**
   * Get user info with roles
   * GET /api/auth/userinfo
   * Returns user information from Keycloak including roles
   * NOTE: Uses getRaw() to get full response with both 'data' and 'roles' properties
   */
  getUserInfo: async (): Promise<UserInfoResponse> => {
    return apiClient.getRaw<UserInfoResponse>("/auth/userinfo");
  },
};
