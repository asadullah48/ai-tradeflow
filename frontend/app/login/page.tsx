"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Field, Notice } from "@/components/Workspace";
export default function Page() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<{ access_token: string }>("/auth/login", {
        phone,
        password,
      });
      useAuthStore
        .getState()
        .setAuth(result.access_token, { id: "", name: phone, phone, role: "" });
      const user = await api.get<{
        id: string;
        name: string;
        phone: string;
        role: string;
      }>("/auth/me");
      useAuthStore.getState().setAuth(result.access_token, user);
      router.replace("/dashboard");
    } catch (e) {
      useAuthStore.getState().clearAuth();
      setError(e instanceof ApiError ? e.message : t("loginError"));
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="mx-auto grid min-h-[80dvh] max-w-5xl items-center gap-10 lg:grid-cols-2">
      <section className="rounded-3xl bg-[#102f3a] p-8 text-white lg:p-12">
        <span className="inline-flex rounded-lg bg-[#b3ead7] px-3 py-2 font-bold text-[#102f3a]">
          AI TradeFlow
        </span>
        <h1 className="mt-10 text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
          {t("loginTitle")}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[#b4cbd2]">
          {t("loginSubtitle")}
        </p>
        <div className="mt-12 grid grid-cols-3 gap-4 border-t border-white/15 pt-6 text-sm">
          {["products", "khata", "munshi"].map((k, i) => (
            <div key={k}>
              <span className="font-mono text-xs text-[#80b4b4]">0{i + 1}</span>
              <p className="mt-2">{t(k as "products" | "khata" | "munshi")}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-xs leading-relaxed text-[#b4cbd2]">
          {t("auditNote")}
        </p>
      </section>
      <section className="panel !p-7 lg:!p-10">
        <div className="mb-7 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{t("welcomeBack")}</h2>
          <button
            className="button-secondary"
            onClick={() => setLang(lang === "en" ? "ur" : "en")}
          >
            {lang === "en" ? "اردو" : "English"}
          </button>
        </div>
        <p className="muted mb-6 text-sm">{t("signInToContinue")}</p>
        {error && <Notice>{error}</Notice>}
        <form onSubmit={submit} className="space-y-5">
          <Field label={t("phone")}>
            <input
              autoComplete="username"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03xxxxxxxxx"
              dir="ltr"
            />
          </Field>
          <Field label={t("password")}>
            <input
              autoComplete="current-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button
            disabled={loading}
            className="button-primary w-full"
            type="submit"
          >
            {loading ? t("loading") : t("login")}
          </button>
        </form>
        <div className="mt-7 border-t border-slate-200 pt-5">
          <button
            onClick={() => {
              setPhone("03000000000");
              setPassword("tradeflow123");
            }}
            className="button-secondary w-full"
          >
            {t("demo")}
          </button>
          <p className="muted mt-3 text-xs leading-relaxed">{t("demoNote")}</p>
        </div>
      </section>
    </div>
  );
}
