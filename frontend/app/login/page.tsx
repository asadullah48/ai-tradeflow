"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { t } = useI18n();

  const [phone, setPhone] = useState("03000000000");
  const [password, setPassword] = useState("tradeflow123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const tokenResp = await api.post<{ access_token: string }>("/auth/login", { phone, password });
      // Store the token immediately so the /parties call below is authenticated,
      // then fetch "who am I" indirectly via a lightweight parties call is
      // unnecessary - decode isn't needed, we just need name/role for the nav.
      useAuthStore.getState().setAuth(tokenResp.access_token, { id: "", name: phone, phone, role: "owner" });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="text-2xl font-bold">{t("appName")}</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">{t("signInToContinue")}</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("phone")}
          className="rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("password")}
          className="rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20"
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? t("loading") : t("login")}
        </button>
      </form>

      <p className="mt-4 text-xs text-black/50 dark:text-white/50">
        Demo login pre-filled: 03000000000 / tradeflow123 (after running{" "}
        <code>python seed.py</code> in backend/)
      </p>
    </div>
  );
}
