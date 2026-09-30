"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type User = {
  id: string;
  name: string;
  phone: string;
  role: string;
  business_id?: string;
  business_name?: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: "tradeflow-auth" },
  ),
);

function subscribeHydration(callback: () => void) {
  return useAuthStore.persist.onFinishHydration(callback);
}
export function useAuthHydrated() {
  return useSyncExternalStore(subscribeHydration,
    () => useAuthStore.persist.hasHydrated(), () => false);
}
