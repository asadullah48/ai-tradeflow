"use client";
import { useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { Field, Heading, Loading, Notice } from "@/components/Workspace";
import { useI18n } from "@/lib/i18n";
import { useResource } from "@/lib/use-resource";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

type Member = { id: string; name: string; phone: string; role: string };

const PERMISSIONS: { en: string; ur: string; owner: boolean; munshi: boolean }[] = [
  { en: "Record sales, purchases and payments", ur: "فروخت، خریداری اور ادائیگیاں درج کرنا", owner: true, munshi: true },
  { en: "Add parties and products", ur: "پارٹیاں اور مصنوعات شامل کرنا", owner: true, munshi: true },
  { en: "Ask Munshi AI, collections, statements", ur: "منشی AI، وصولی، اسٹیٹمنٹ", owner: true, munshi: true },
  { en: "Void a posted order", ur: "درج شدہ آرڈر منسوخ کرنا", owner: true, munshi: false },
  { en: "Approve a sale over a credit limit", ur: "کریڈٹ حد سے زیادہ فروخت کی اجازت", owner: true, munshi: false },
  { en: "Delete a party (only without history)", ur: "پارٹی حذف کرنا (صرف بغیر تاریخ)", owner: true, munshi: false },
  { en: "Add team members", ur: "ٹیم ممبر شامل کرنا", owner: true, munshi: false },
];

function Content() {
  const { t, lang } = useI18n();
  const role = useAuthStore((s) => s.user?.role);
  const { data, error, loading, reload } = useResource<Member[]>("/team");
  const [form, setForm] = useState({ name: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setSaved(false);
    try {
      await api.post("/team", form);
      setForm({ name: "", phone: "", password: "" });
      setSaved(true);
      await reload();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : t("loadFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Heading title={t("team")} description={t("teamSubtitle")} />
      {error && <Notice>{t("loadFailed")}</Notice>}
      <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
        <section>
          {loading && !data ? (
            <Loading />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("name")}</th>
                    <th>{t("phone")}</th>
                    <th>{t("role")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.map((m) => (
                    <tr key={m.id}>
                      <td className="font-medium">{m.name}</td>
                      <td className="number">{m.phone}</td>
                      <td>
                        <span className={`pill ${m.role === "owner" ? "" : "pill-warning"}`}>
                          {t(m.role === "owner" ? "ownerRole" : "munshiRole")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="panel mt-5">
            <h2 className="mb-4 font-semibold">{t("permissions")}</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th />
                    <th>{t("ownerRole")}</th>
                    <th>{t("munshiRole")}</th>
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((p) => (
                    <tr key={p.en}>
                      <td className="whitespace-normal">{lang === "ur" ? p.ur : p.en}</td>
                      <td aria-label={p.owner ? "yes" : "no"}>{p.owner ? "✓" : "—"}</td>
                      <td aria-label={p.munshi ? "yes" : "no"}>{p.munshi ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <section className="panel">
          <h2 className="mb-4 font-semibold">{t("addMember")}</h2>
          {role !== "owner" ? (
            <p className="muted text-sm">{t("ownerOnly")}</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {formError && <Notice>{formError}</Notice>}
              {saved && (
                <p role="status" className="rounded-xl bg-teal-50 p-4 text-sm text-teal-800">
                  {t("memberAdded")}
                </p>
              )}
              <Field label={t("name")}>
                <input required maxLength={120} value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label={t("phone")}>
                <input required type="tel" dir="ltr" placeholder="03xxxxxxxxx" pattern="\+?[0-9]{10,14}"
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label={`${t("password")} · ${t("passwordHint")}`}>
                <input required type="password" minLength={8} autoComplete="new-password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Field>
              <button disabled={busy} className="button-primary w-full" type="submit">
                {busy ? t("saving") : t("addMember")}
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <RequireAuth>
      <Content />
    </RequireAuth>
  );
}
