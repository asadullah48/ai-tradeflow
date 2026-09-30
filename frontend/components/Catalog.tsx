"use client";
import { useState } from "react";
import Link from "next/link";
import { Heading, Field, Notice, Empty, Loading } from "./Workspace";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/messages";
import { useResource } from "@/lib/use-resource";
import { api } from "@/lib/api";
import { money, quantity } from "@/lib/format";
type Row = { id: string; name: string; [key: string]: string | number | null };
const PRODUCT: Record<string, string | number> = {
  sku: "",
  name: "",
  name_ur: "",
  category: "",
  unit: "piece",
  cost_price: 0,
  sale_price: 0,
  min_stock_level: 0,
};
const PARTY: Record<string, string | number> = {
  name: "",
  name_ur: "",
  type: "customer",
  phone: "",
  city: "",
  credit_limit: 0,
  opening_balance: 0,
};
const KEYS: Record<string, MessageKey> = {
  sku: "sku",
  name: "name",
  name_ur: "nameUr",
  category: "category",
  cost_price: "costPrice",
  sale_price: "salePrice",
  min_stock_level: "minStockLevel",
  phone: "phone",
  city: "city",
  credit_limit: "creditLimit",
  opening_balance: "openingBalance",
};
export default function Catalog({ product }: { product: boolean }) {
  const { t } = useI18n();
  const defaults = product ? PRODUCT : PARTY;
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ ...defaults });
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const endpoint = product ? "/products" : "/parties";
  const {
    data,
    loading,
    error: loadError,
    reload,
  } = useResource<Row[]>(
    `${endpoint}${query ? `?q=${encodeURIComponent(query)}` : ""}`,
  );
  function edit(row: Row) {
    const next: Record<string, string | number> = {};
    for (const key of Object.keys(defaults))
      next[key] = row[key] ?? defaults[key];
    setForm(next);
    setEditing(row.id);
    setOpen(true);
    setSaved(false);
    window.scrollTo({ top: 0 });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const payload = { ...form };
      if (editing) {
        delete payload.sku;
        delete payload.unit;
        delete payload.opening_balance;
        await api.patch(`${endpoint}/${editing}`, payload);
      } else await api.post(endpoint, payload);
      setForm({ ...defaults });
      setEditing(null);
      setOpen(false);
      setSaved(true);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title={t(product ? "products" : "parties")}
        description={t(product ? "productsSubtitle" : "partiesSubtitle")}
        action={
          <button
            className="button-primary"
            onClick={() => {
              setOpen(!open);
              setEditing(null);
              setForm({ ...defaults });
            }}
          >
            + {t(product ? "newProduct" : "newParty")}
          </button>
        }
      />
      {(error || loadError) && (
        <Notice>
          {error ?? loadError}{" "}
          <button onClick={reload} className="underline">
            {t("retry")}
          </button>
        </Notice>
      )}
      {saved && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-teal-50 p-4 text-sm text-teal-800"
        >
          {t("saved")}
        </p>
      )}
      {open && (
        <form onSubmit={submit} className="panel mb-6">
          <h2 className="mb-5 font-semibold">
            {editing ? t("edit") : t(product ? "newProduct" : "newParty")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(defaults).map(([key, value]) =>
              key === "unit" || key === "type" ? (
                <Field key={key} label={t(key)}>
                  <select
                    disabled={key === "unit" && !!editing}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  >
                    {(key === "unit"
                      ? ["piece", "dozen", "carton", "kg", "meter"]
                      : ["customer", "supplier", "both"]
                    ).map((v) => (
                      <option key={v} value={v}>
                        {key === "type"
                          ? t(v as "customer" | "supplier" | "both")
                          : v}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field key={key} label={t(KEYS[key])}>
                  <input
                    disabled={
                      !!editing && (key === "sku" || key === "opening_balance")
                    }
                    type={
                      typeof value === "number"
                        ? "number"
                        : key === "phone"
                          ? "tel"
                          : "text"
                    }
                    required={key === "name" || key === "sku"}
                    min={
                      typeof value === "number" && key !== "opening_balance"
                        ? 0
                        : undefined
                    }
                    step={typeof value === "number" ? "0.01" : undefined}
                    value={form[key]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [key]:
                          typeof value === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                      })
                    }
                    dir={key === "name_ur" ? "rtl" : undefined}
                  />
                </Field>
              ),
            )}
          </div>
          {!product && <p className="muted mt-3 text-xs">{t("openingNote")}</p>}
          <div className="mt-5 flex gap-3">
            <button disabled={busy} className="button-primary" type="submit">
              {busy ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="block w-full sm:max-w-sm">
          <span className="sr-only">{t("search")}</span>
          <input
            type="search"
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="muted text-sm">
          {data?.length ?? 0} {t(product ? "products" : "parties")}
        </span>
      </div>
      {loading && !data ? (
        <Loading />
      ) : data?.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {(product
                  ? [
                      "sku",
                      "name",
                      "unit",
                      "salePrice",
                      "currentStock",
                      "status",
                    ]
                  : ["name", "type", "city", "phone"]
                ).map((key) => (
                  <th key={key}>{t(key as MessageKey)}</th>
                ))}
                <th>
                  <span className="sr-only">{t("edit")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  {product && <td className="number text-xs">{row.sku}</td>}
                  <td>
                    <p className="font-medium">{row.name}</p>
                    {row.name_ur && (
                      <p className="muted mt-1 text-xs" dir="rtl">
                        {row.name_ur}
                      </p>
                    )}
                  </td>
                  {product ? (
                    <>
                      <td>{row.unit}</td>
                      <td className="number">
                        {money(Number(row.sale_price))}
                      </td>
                      <td className="number">
                        {quantity(Number(row.current_stock))}
                      </td>
                      <td>
                        <span
                          className={`pill ${Number(row.current_stock) < Number(row.min_stock_level) ? "pill-warning" : ""}`}
                        >
                          {t(
                            Number(row.current_stock) <
                              Number(row.min_stock_level)
                              ? "lowStock"
                              : "inStock",
                          )}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>
                        <span className="pill">
                          {t(row.type as "customer" | "supplier" | "both")}
                        </span>
                      </td>
                      <td>{row.city || "—"}</td>
                      <td className="number">{row.phone || "—"}</td>
                    </>
                  )}
                  <td>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => edit(row)}
                        className="text-teal-700 underline"
                      >
                        {t("edit")}
                      </button>
                      <Link
                        className="text-teal-700 underline"
                        href={
                          product
                            ? `/purchases?product=${row.id}`
                            : `/khata/${row.id}`
                        }
                      >
                        {t(product ? "newPurchase" : "view")}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={t("noData")}>
          <button
            onClick={() => setOpen(true)}
            className="button-secondary mt-3"
          >
            {t(product ? "newProduct" : "newParty")}
          </button>
        </Empty>
      )}
    </>
  );
}
