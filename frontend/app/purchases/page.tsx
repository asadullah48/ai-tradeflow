"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Party = { id: string; name: string };
type Product = { id: string; name: string; cost_price: number };
type OrderItem = { product_id: string; qty: number; unit_price: number };
type Order = { id: string; party_id: string; date: string; status: string; total: number; items: OrderItem[] };

function PurchasesContent() {
  const { t } = useI18n();
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [partyId, setPartyId] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);

  function load() {
    api.get<Order[]>("/purchase-orders").then(setOrders).catch(() => {});
  }

  useEffect(() => {
    api.get<Party[]>("/parties").then(setParties);
    api.get<Product[]>("/products").then(setProducts);
    load();
  }, []);

  function addItemRow() {
    if (products.length === 0) return;
    setItems([...items, { product_id: products[0].id, qty: 1, unit_price: products[0].cost_price }]);
  }

  function updateItem(index: number, patch: Partial<OrderItem>) {
    setItems(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!partyId || items.length === 0) return;
    await api.post("/purchase-orders", { party_id: partyId, date: new Date().toISOString().slice(0, 10), items });
    setItems([]);
    load();
  }

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const partyName = (id: string) => parties.find((p) => p.id === id)?.name ?? id;

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("purchases")}</h1>

      <form onSubmit={handleSubmit} className="mt-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <select value={partyId} onChange={(e) => setPartyId(e.target.value)} className="rounded border border-black/10 px-2 py-1 dark:border-white/20">
          <option value="">{t("party")}...</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <div className="mt-3 space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <select value={item.product_id} onChange={(e) => updateItem(i, { product_id: e.target.value })} className="rounded border border-black/10 px-2 py-1 dark:border-white/20">
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" value={item.qty} onChange={(e) => updateItem(i, { qty: Number(e.target.value) })} placeholder={t("qty")} className="w-24 rounded border border-black/10 px-2 py-1 dark:border-white/20" />
              <input type="number" value={item.unit_price} onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })} placeholder={t("unitPrice")} className="w-28 rounded border border-black/10 px-2 py-1 dark:border-white/20" />
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button type="button" onClick={addItemRow} className="rounded-full border border-black/10 px-4 py-1 text-sm dark:border-white/20">+ item</button>
          <button type="submit" className="rounded-full bg-black px-4 py-1 text-sm text-white dark:bg-white dark:text-black">{t("add")}</button>
        </div>
      </form>

      <ul className="mt-4 space-y-2">
        {orders.map((o) => (
          <li key={o.id} className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
            <div className="flex justify-between">
              <span>{partyName(o.party_id)} - {o.date}</span>
              <span className="font-mono">Rs {o.total.toLocaleString()}</span>
            </div>
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              {o.items.map((it) => `${productName(it.product_id)} x${it.qty}`).join(", ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <RequireAuth>
      <PurchasesContent />
    </RequireAuth>
  );
}
