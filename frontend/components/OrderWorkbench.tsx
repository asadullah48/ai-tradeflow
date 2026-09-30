"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Heading, Notice, Loading, Empty, Field } from "./Workspace";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { money, quantity, today } from "@/lib/format";
type Party = { id: string; name: string; type: string };
type Product = {
  id: string;
  name: string;
  cost_price: number;
  sale_price: number;
  current_stock: number;
  unit: string;
};
type Item = { product_id: string; qty: number; unit_price: number };
type Order = {
  id: string;
  party_id: string;
  date: string;
  status: string;
  total: number;
  items: Item[];
};
export default function OrderWorkbench({ sale }: { sale: boolean }) {
  const { t } = useI18n();
  const params = useSearchParams();
  const suggested = params.get("product");
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [party, setParty] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState("udhaar");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const endpoint = sale ? "/sale-orders" : "/purchase-orders";
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, skus, history] = await Promise.all([
        api.get<Party[]>("/parties"),
        api.get<Product[]>("/products"),
        api.get<Order[]>(endpoint),
      ]);
      setParties(p);
      setProducts(skus);
      setOrders(history);
      return skus;
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
      return [];
    } finally {
      setLoading(false);
    }
  }, [endpoint, t]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void load().then((skus) => {
        if (!active || !suggested) return;
        const p = skus.find((p) => p.id === suggested);
        if (p)
          setItems([
            {
              product_id: p.id,
              qty: 1,
              unit_price: sale ? p.sale_price : p.cost_price,
            },
          ]);
      });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load, suggested, sale]);
  const total = items.reduce(
    (sum, i) => sum + Math.round(i.qty * i.unit_price * 100) / 100,
    0,
  );
  const required = new Map<string, number>();
  for (const i of items)
    required.set(i.product_id, (required.get(i.product_id) ?? 0) + i.qty);
  const short =
    sale &&
    items.some(
      (i) =>
        (required.get(i.product_id) ?? 0) >
        (products.find((p) => p.id === i.product_id)?.current_stock ?? 0),
    );
  function update(index: number, patch: Partial<Item>) {
    setSuccess(false);
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !items.length || short) return;
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      await api.post<Order>(endpoint, {
        party_id: party,
        date,
        items,
        ledger_method: method,
      });
      setItems([]);
      setSuccess(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title={t(sale ? "sales" : "purchases")}
        description={t(sale ? "salesSubtitle" : "purchasesSubtitle")}
      />
      {error && (
        <Notice>
          {error}{" "}
          <button onClick={load} className="underline">
            {t("retry")}
          </button>
        </Notice>
      )}
      {success && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-teal-50 p-4 text-sm text-teal-800"
        >
          {t("posted")}
        </p>
      )}
      {loading && !products.length ? (
        <Loading />
      ) : (
        <>
          <form
            onSubmit={submit}
            className="grid items-start gap-5 xl:grid-cols-[1fr_320px]"
          >
            <section className="panel">
              <h2 className="mb-5 text-lg font-semibold">
                {t(sale ? "newSale" : "newPurchase")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("party")}>
                  <select
                    value={party}
                    onChange={(e) => setParty(e.target.value)}
                    required
                  >
                    <option value="">{t("chooseParty")}</option>
                    {parties
                      .filter(
                        (p) =>
                          p.type === "both" ||
                          p.type === (sale ? "customer" : "supplier"),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label={t("orderDate")}>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-6 space-y-4">
                {items.map((item, index) => {
                  const p = products.find((p) => p.id === item.product_id);
                  return (
                    <div
                      key={index}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                    >
                      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                        <Field label={t("product")}>
                          <select
                            value={item.product_id}
                            onChange={(e) => {
                              const product = products.find(
                                (p) => p.id === e.target.value,
                              );
                              update(index, {
                                product_id: e.target.value,
                                unit_price: product
                                  ? sale
                                    ? product.sale_price
                                    : product.cost_price
                                  : 0,
                              });
                            }}
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label={t("qty")}>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            required
                            value={item.qty}
                            onChange={(e) =>
                              update(index, { qty: Number(e.target.value) })
                            }
                          />
                        </Field>
                        <Field label={t("unitPrice")}>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={item.unit_price}
                            onChange={(e) =>
                              update(index, {
                                unit_price: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <span className="muted">
                          {t("available")}:{" "}
                          <span className="number">
                            {quantity(p?.current_stock ?? 0)} {p?.unit}
                          </span>
                        </span>
                        <div className="flex items-center gap-4">
                          <span className="number font-semibold">
                            {money(
                              Math.round(item.qty * item.unit_price * 100) /
                                100,
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setItems((current) =>
                                current.filter((_, i) => i !== index),
                              )
                            }
                            className="text-red-700 underline"
                          >
                            {t("remove")}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!products.length ? (
                <div className="mt-5">
                  <p className="muted text-sm">{t("emptyOrders")}</p>
                  <Link href="/products" className="button-secondary mt-3">
                    {t("newProduct")}
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setItems((current) => [
                      ...current,
                      {
                        product_id: products[0].id,
                        qty: 1,
                        unit_price: sale
                          ? products[0].sale_price
                          : products[0].cost_price,
                      },
                    ])
                  }
                  className="button-secondary mt-4"
                >
                  + {t("addItem")}
                </button>
              )}
            </section>
            <aside className="panel">
              <p className="eyebrow">{t("reviewOrder")}</p>
              <p className="number my-5 text-3xl font-semibold">
                {money(total)}
              </p>
              <Field label={t("paymentMethod")}>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {["udhaar", "cash", "bank", "jazzcash", "easypaisa"].map(
                    (m) => (
                      <option key={m} value={m}>
                        {m === "jazzcash"
                          ? "JazzCash"
                          : m === "easypaisa"
                            ? "Easypaisa"
                            : t(m as "udhaar" | "cash" | "bank")}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              <p className="muted my-5 text-xs leading-relaxed">
                {t("postingNote")}
              </p>
              {short && <Notice>{t("shortStock")}</Notice>}
              <button
                type="submit"
                disabled={busy || !items.length || !party || short}
                className="button-primary w-full"
              >
                {busy ? t("saving") : t("postOrder")}
              </button>
            </aside>
          </form>
          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold">
              {t("transactionHistory")}
            </h2>
            {orders.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t("party")}</th>
                      <th>{t("date")}</th>
                      <th>{t("product")}</th>
                      <th>{t("status")}</th>
                      <th>{t("total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          {parties.find((p) => p.id === o.party_id)?.name ??
                            o.party_id}
                        </td>
                        <td className="number">{o.date}</td>
                        <td>
                          {o.items
                            .map(
                              (i) =>
                                `${products.find((p) => p.id === i.product_id)?.name ?? i.product_id} × ${quantity(i.qty)}`,
                            )
                            .join(", ")}
                        </td>
                        <td>
                          <span className="pill">{o.status}</span>
                        </td>
                        <td className="number font-semibold">
                          {money(o.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title={t("noOrders")}>{t("emptyOrders")}</Empty>
            )}
          </section>
        </>
      )}
    </>
  );
}
