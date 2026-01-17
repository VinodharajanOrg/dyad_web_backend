import { atom } from "jotai";
import type { UserInfoResponse } from "@/api/endpoints/auth";

/**
 * User info atom - stores current user information including roles
 * This is populated after successful authentication via getUserInfo API
 */
export const userInfoAtom = atom<UserInfoResponse | null>(null);

/**
 * Derived atom to check if user is admin
 * Checks if user has 'admin' role in their roles array
 */
export const isAdminAtom = atom((get) => {
  const userInfo = get(userInfoAtom);
  const hasAdmin = userInfo?.roles?.includes("admin") ?? false;
  return hasAdmin;
});

/**
 * Derived atom to get user roles
 * Returns empty array if no user info is available
 */
export const userRolesAtom = atom((get) => {
  const userInfo = get(userInfoAtom);
  return userInfo?.roles ?? [];
});
