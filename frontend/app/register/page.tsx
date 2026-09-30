"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, BROWSER_DEMO } from "@/lib/api";
import { signIn } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { Field, Notice } from "@/components/Workspace";

export default function Page() {
  const router = useRouter();
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", business_name: "", city: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/register", { ...form, city: form.city || null });
      await signIn(form.phone, form.password);
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("loginError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl py-6">
      <section className="panel !p-7 lg:!p-10">
        <p className="eyebrow mb-2">AI TradeFlow</p>
        <h1 className="text-2xl font-semibold">{t("registerTitle")}</h1>
        <p className="muted mt-2 text-sm leading-relaxed">{t("registerSubtitle")}</p>
        {BROWSER_DEMO ? (
          <div className="mt-6">
            <Notice>{t("demoLoginNote")}</Notice>
            <Link href="/login" className="button-primary">{t("demoOwner")}</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && <Notice>{error}</Notice>}
            <Field label={t("fullName")}>
              <input required maxLength={120} value={form.name} onChange={set("name")} autoComplete="name" />
            </Field>
            <Field label={t("businessName")}>
              <input required maxLength={160} value={form.business_name} onChange={set("business_name")}
                autoComplete="organization" />
            </Field>
            <Field label={t("city")}>
              <input maxLength={80} value={form.city} onChange={set("city")} />
            </Field>
            <Field label={t("phone")}>
              <input required type="tel" dir="ltr" placeholder="03xxxxxxxxx" pattern="\+?[0-9]{10,14}"
                value={form.phone} onChange={set("phone")} autoComplete="username" />
            </Field>
            <Field label={`${t("password")} · ${t("passwordHint")}`}>
              <input required type="password" minLength={8} value={form.password} onChange={set("password")}
                autoComplete="new-password" />
            </Field>
            <button disabled={busy} className="button-primary w-full" type="submit">
              {busy ? t("saving") : t("register")}
            </button>
            <Link href="/login" className="block text-center text-sm text-teal-700 underline">
              {t("haveAccount")}
            </Link>
          </form>
        )}
      </section>
    </div>
  );
}
