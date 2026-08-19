"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Party = {
  id: string; name: string; name_ur: string | null; type: string;
  phone: string | null; city: string | null; credit_limit: number;
};

function PartiesContent() {
  const { t } = useI18n();
  const [parties, setParties] = useState<Party[]>([]);
  const [form, setForm] = useState({ name: "", name_ur: "", type: "customer", phone: "", city: "" });
  const [query, setQuery] = useState("");

  function load(q = "") {
    api.get<Party[]>(`/parties${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(setParties).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    await api.post("/parties", form);
    setForm({ name: "", name_ur: "", type: "customer", phone: "", city: "" });
    load(query);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("parties")}</h1>

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("name")} className="rounded border border-black/10 px-2 py-1 dark:border-white/20" />
        <input value={form.name_ur} onChange={(e) => setForm({ ...form, name_ur: e.target.value })} placeholder={t("nameUr")} dir="rtl" className="rounded border border-black/10 px-2 py-1 dark:border-white/20" />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="rounded border border-black/10 px-2 py-1 dark:border-white/20">
          <option value="customer">{t("customer")}</option>
          <option value="supplier">{t("supplier")}</option>
          <option value="both">{t("both")}</option>
        </select>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t("phone")} className="rounded border border-black/10 px-2 py-1 dark:border-white/20" />
        <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder={t("city")} className="rounded border border-black/10 px-2 py-1 dark:border-white/20" />
        <button type="submit" className="rounded-full bg-black px-4 py-1 text-white dark:bg-white dark:text-black">{t("add")}</button>
      </form>

      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); load(e.target.value); }}
        placeholder="Search..."
        className="mt-4 w-full rounded border border-black/10 px-3 py-2 dark:border-white/20"
      />

      <ul className="mt-4 space-y-2">
        {parties.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-lg border border-black/10 p-3 dark:border-white/10">
            <div>
              <p className="font-medium">{p.name} {p.name_ur && <span dir="rtl" className="text-black/50 dark:text-white/50">({p.name_ur})</span>}</p>
              <p className="text-xs text-black/50 dark:text-white/50">{p.type} - {p.city ?? "-"} - {p.phone ?? "-"}</p>
            </div>
            <Link href={`/khata/${p.id}`} className="text-sm text-blue-600 hover:underline dark:text-blue-400">{t("khata")}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PartiesPage() {
  return (
    <RequireAuth>
      <PartiesContent />
    </RequireAuth>
  );
}
