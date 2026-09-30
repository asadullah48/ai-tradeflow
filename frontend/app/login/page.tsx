"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, BROWSER_DEMO } from "@/lib/api";
import { DEMO_ACCOUNTS, signIn } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { Field, Notice } from "@/components/Workspace";
export default function Page() {
  const router = useRouter();
  const { t, lang, setLang } = useI18n();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function enter(p: string, pw: string) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(p, pw);
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("loginError"));
    } finally {
      setLoading(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await enter(phone, password);
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
        {BROWSER_DEMO && (
          <div className="mb-7 rounded-xl border border-teal-200 bg-[#e8f3ef] p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                className="button-primary"
                disabled={loading}
                onClick={() => enter(DEMO_ACCOUNTS.owner.phone, DEMO_ACCOUNTS.owner.password)}
              >
                {t("demoOwner")}
              </button>
              <button
                className="button-secondary"
                disabled={loading}
                onClick={() => enter(DEMO_ACCOUNTS.munshi.phone, DEMO_ACCOUNTS.munshi.password)}
              >
                {t("demoMunshi")}
              </button>
            </div>
            <p className="muted mt-3 text-xs leading-relaxed">{t("demoLoginNote")}</p>
          </div>
        )}
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
              setPhone(DEMO_ACCOUNTS.owner.phone);
              setPassword(DEMO_ACCOUNTS.owner.password);
            }}
            className="button-secondary w-full"
          >
            {t("demo")}
          </button>
          <p className="muted mt-3 text-xs leading-relaxed">
            {BROWSER_DEMO ? t("demoLoginNote") : t("demoNote")}
          </p>
          {!BROWSER_DEMO && (
            <Link href="/register" className="mt-4 inline-block text-sm text-teal-700 underline">
              {t("noAccount")}
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
