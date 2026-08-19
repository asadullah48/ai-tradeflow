"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Product = {
  id: string; sku: string; name: string; name_ur: string | null; category: string | null;
  unit: string; cost_price: number; sale_price: number; min_stock_level: number; current_stock: number;
};

const UNITS = ["piece", "dozen", "carton", "kg", "meter"];

function ProductsContent() {
  const { t } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({ sku: "", name: "", name_ur: "", category: "", unit: "piece", cost_price: 0, sale_price: 0, min_stock_level: 0 });
  const [query, setQuery] = useState("");

  function load(q = "") {
    api.get<Product[]>(`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(setProducts).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) return;
    await api.post("/products", form);
    setForm({ sku: "", name: "", name_ur: "", category: "", unit: "piece", cost_price: 0, sale_price: 0, min_stock_level: 0 });
    load(query);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("products")}</h1>

      <form onSubmit={handleAdd} className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10 md:grid-cols-4">
        <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder={t("sku")} className="rounded border border-black/10 px-2 py-1 dark:border-white/20" />
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("name")} className="rounded border border-black/10 px-2 py-1 dark:border-white/20" />
        <input value={form.name_ur} onChange={(e) => setForm({ ...form, name_ur: e.target.value })} placeholder={t("nameUr")} dir="rtl" className="rounded border border-black/10 px-2 py-1 dark:border-white/20" />
        <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={t("category")} className="rounded border border-black/10 px-2 py-1 dark:border-white/20" />
        <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="rounded border border-black/10 px-2 py-1 dark:border-white/20">
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <input type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} placeholder={t("costPrice")} className="rounded border border-black/10 px-2 py-1 dark:border-white/20" />
        <input type="number" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} placeholder={t("salePrice")} className="rounded border border-black/10 px-2 py-1 dark:border-white/20" />
        <input type="number" value={form.min_stock_level} onChange={(e) => setForm({ ...form, min_stock_level: Number(e.target.value) })} placeholder={t("minStockLevel")} className="rounded border border-black/10 px-2 py-1 dark:border-white/20" />
        <button type="submit" className="col-span-2 rounded-full bg-black px-4 py-1 text-white dark:bg-white dark:text-black md:col-span-1">{t("add")}</button>
      </form>

      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); load(e.target.value); }}
        placeholder="Search..."
        className="mt-4 w-full rounded border border-black/10 px-3 py-2 dark:border-white/20"
      />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/10">
              <th className="py-2">{t("sku")}</th>
              <th>{t("name")}</th>
              <th>{t("unit")}</th>
              <th>{t("salePrice")}</th>
              <th>{t("currentStock")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={`border-b border-black/5 dark:border-white/10 ${p.current_stock < p.min_stock_level ? "text-red-600 dark:text-red-400" : ""}`}>
                <td className="py-2 font-mono text-xs">{p.sku}</td>
                <td>{p.name} {p.name_ur && <span dir="rtl" className="text-black/50">({p.name_ur})</span>}</td>
                <td>{p.unit}</td>
                <td>Rs {p.sale_price.toLocaleString()}</td>
                <td>{p.current_stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <RequireAuth>
      <ProductsContent />
    </RequireAuth>
  );
}
