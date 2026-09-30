"use client";
import { api } from "./api";
import { useAuthStore, type User } from "./store";

/** Sign in, then load the real identity (name, role, business) from /auth/me. */
export async function signIn(phone: string, password: string): Promise<User> {
  const { access_token } = await api.post<{ access_token: string }>("/auth/login", { phone, password });
  useAuthStore.getState().setAuth(access_token, { id: "", name: phone, phone, role: "" });
  try {
    const user = await api.get<User>("/auth/me");
    useAuthStore.getState().setAuth(access_token, user);
    return user;
  } catch (e) {
    useAuthStore.getState().clearAuth();
    throw e;
  }
}

export const DEMO_ACCOUNTS = {
  owner: { phone: "03000000000", password: "tradeflow123" },
  munshi: { phone: "03000000001", password: "tradeflow123" },
} as const;
