"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type StockAlert = { product_id: string; name: string; current_stock: number; min_stock_level: number; unit: string };
type Dashboard = {
  todays_sales_total: number;
  todays_sales_count: number;
  stock_alerts: StockAlert[];
  total_receivables: number;
  total_payables: number;
  top_udhaar_exposure: { party_id: string; party_name: string; amount: number }[];
  fast_movers: { product_name: string; velocity_per_day: number }[];
  dead_stock: { product_name: string; current_stock: number }[];
};

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <p className="text-sm text-black/60 dark:text-white/60">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function DashboardContent() {
  const { t } = useI18n();
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    api.get<Dashboard>("/dashboard").then(setData).catch(() => {});
  }, []);

  if (!data) return <p>{t("loading")}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("dashboard")}</h1>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card label={t("todaysSales")} value={`Rs ${data.todays_sales_total.toLocaleString()}`} />
        <Card label={t("receivables")} value={`Rs ${data.total_receivables.toLocaleString()}`} />
        <Card label={t("payables")} value={`Rs ${data.total_payables.toLocaleString()}`} />
        <Card label={t("stockAlerts")} value={data.stock_alerts.length} />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="font-semibold">{t("topUdhaar")}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.top_udhaar_exposure.length === 0 && <li className="text-black/50">{t("noData")}</li>}
            {data.top_udhaar_exposure.map((p) => (
              <li key={p.party_id} className="flex justify-between border-b border-black/5 py-1 dark:border-white/10">
                <span>{p.party_name}</span>
                <span className="font-mono">Rs {p.amount.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">{t("stockAlerts")}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.stock_alerts.length === 0 && <li className="text-black/50">{t("noData")}</li>}
            {data.stock_alerts.map((p) => (
              <li key={p.product_id} className="flex justify-between border-b border-black/5 py-1 text-red-600 dark:border-white/10 dark:text-red-400">
                <span>{p.name}</span>
                <span>{p.current_stock}/{p.min_stock_level} {p.unit}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">{t("fastMovers")}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.fast_movers.map((p) => (
              <li key={p.product_name} className="flex justify-between border-b border-black/5 py-1 dark:border-white/10">
                <span>{p.product_name}</span>
                <span>{p.velocity_per_day}/day</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">{t("deadStock")}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.dead_stock.map((p) => (
              <li key={p.product_name} className="flex justify-between border-b border-black/5 py-1 dark:border-white/10">
                <span>{p.product_name}</span>
                <span>{p.current_stock}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
