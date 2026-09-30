"use client";
import { useState } from "react";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { Heading, Notice, Loading, Empty } from "@/components/Workspace";
import { useI18n } from "@/lib/i18n";
import { useResource } from "@/lib/use-resource";
import { money, quantity } from "@/lib/format";
import { api } from "@/lib/api";
type Dashboard = {
  todays_sales_total: number;
  todays_sales_count: number;
  total_receivables: number;
  total_payables: number;
  stock_alerts: {
    product_id: string;
    name: string;
    current_stock: number;
    min_stock_level: number;
    unit: string;
  }[];
  top_udhaar_exposure: {
    party_id: string;
    party_name: string;
    amount: number;
  }[];
  fast_movers: { product_name: string; velocity_per_day: number }[];
  dead_stock: { product_name: string; current_stock: number }[];
};
function DashboardContent() {
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useResource<Dashboard>("/dashboard");
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  async function copyBrief() {
    try {
      const brief = await api.get<{ text: string }>("/reports/daily-summary");
      await navigator.clipboard.writeText(brief.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setActionError(t("loadFailed"));
    }
  }
  return (
    <>
      <Heading
        title={t("dayTitle")}
        description={t("daySubtitle")}
        action={
          <Link href="/sales" className="button-primary">
            + {t("newSale")}
          </Link>
        }
      />
      {error && (
        <Notice>
          {t("loadFailed")}{" "}
          <button onClick={reload} className="underline">
            {t("retry")}
          </button>
        </Notice>
      )}
      {actionError && <Notice>{actionError}</Notice>}
      {loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: t("todaysSales"),
                  value: money(data.todays_sales_total),
                  note: `${data.todays_sales_count} ${t("salesCount")}`,
                },
                {
                  label: t("moneyIn"),
                  value: money(data.total_receivables),
                  note: t("receivables"),
                },
                {
                  label: t("moneyOut"),
                  value: money(data.total_payables),
                  note: t("payables"),
                },
                {
                  label: t("stockAlerts"),
                  value: data.stock_alerts.length,
                  note: t("stockNote"),
                },
              ].map((card, i) => (
                <div
                  key={card.label}
                  className={`panel ${i === 0 ? "!border-[#102f3a] !bg-[#102f3a] text-white" : ""}`}
                >
                  <p
                    className={`text-sm ${i === 0 ? "text-[#b4cbd2]" : "muted"}`}
                  >
                    {card.label}
                  </p>
                  <p className="number mt-4 text-[clamp(1.25rem,2vw,1.875rem)] font-semibold tracking-tight">
                    {card.value}
                  </p>
                  <p
                    className={`mt-3 text-xs ${i === 0 ? "text-[#b4cbd2]" : "muted"}`}
                  >
                    {card.note}
                  </p>
                </div>
              ))}
            </div>
            <div className="mb-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
              <section className="panel">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t("priorities")}</h2>
                  <span className="pill">{t("today")}</span>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="eyebrow mb-3">01 / {t("collectNext")}</p>
                    {data.top_udhaar_exposure.length ? (
                      data.top_udhaar_exposure.slice(0, 3).map((p) => (
                        <Link
                          key={p.party_id}
                          href={`/khata/${p.party_id}`}
                          className="flex items-center justify-between gap-3 border-t border-slate-100 py-3 text-sm hover:text-teal-700"
                        >
                          <span>{p.party_name}</span>
                          <span className="number font-medium">
                            {money(p.amount)}
                          </span>
                        </Link>
                      ))
                    ) : (
                      <p className="muted py-3 text-sm">{t("noReceivables")}</p>
                    )}
                  </div>
                  <div>
                    <p className="eyebrow mb-3">02 / {t("restockNext")}</p>
                    {data.stock_alerts.length ? (
                      data.stock_alerts.slice(0, 3).map((p) => (
                        <Link
                          key={p.product_id}
                          href={`/purchases?product=${p.product_id}`}
                          className="flex items-center justify-between gap-3 border-t border-slate-100 py-3 text-sm hover:text-teal-700"
                        >
                          <span>{p.name}</span>
                          <span className="pill pill-warning number">
                            {quantity(p.current_stock)} /{" "}
                            {quantity(p.min_stock_level)} {p.unit}
                          </span>
                        </Link>
                      ))
                    ) : (
                      <>
                        <p className="mt-2 text-sm font-medium">
                          {t("allClear")}
                        </p>
                        <p className="muted mt-2 text-xs leading-relaxed">
                          {t("healthyStock")}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </section>
              <section className="panel flex flex-col justify-between !border-teal-100 !bg-[#e8f3ef]">
                <div>
                  <p className="eyebrow">{t("munshi")}</p>
                  <h2 className="mt-3 text-xl font-semibold">
                    {t("munshiWelcome")}
                  </h2>
                  <p className="muted mt-3 text-sm leading-relaxed">
                    {t("munshiNote")}
                  </p>
                </div>
                <Link
                  href={`/munshi?q=${encodeURIComponent(lang === "ur" ? "is haftay kya order karna chahiye?" : "What should I reorder this week?")}`}
                  className="button-secondary mt-5 self-start"
                >
                  {t("askReorder")}
                </Link>
              </section>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="panel">
                <h2 className="font-semibold">{t("fastMovers")}</h2>
                <p className="muted mt-1 text-xs">{t("fastNote")}</p>
                <div className="mt-5 space-y-4">
                  {data.fast_movers.length ? (
                    data.fast_movers.slice(0, 5).map((p) => (
                      <div key={p.product_name}>
                        <div className="mb-2 flex justify-between gap-3 text-sm">
                          <span>{p.product_name}</span>
                          <span className="number">
                            {quantity(p.velocity_per_day)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded bg-slate-100">
                          <div
                            className="h-full rounded bg-teal-600"
                            style={{
                              width: `${Math.max(2, (p.velocity_per_day / Math.max(...data.fast_movers.map((m) => m.velocity_per_day), 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="muted text-sm">{t("noData")}</p>
                  )}
                </div>
              </section>
              <section className="panel">
                <h2 className="font-semibold">{t("deadStock")}</h2>
                <p className="muted mt-1 text-xs">{t("deadNote")}</p>
                <div className="mt-4">
                  {data.dead_stock.length ? (
                    data.dead_stock.slice(0, 5).map((p) => (
                      <div
                        key={p.product_name}
                        className="flex justify-between gap-4 border-t border-slate-100 py-3 text-sm"
                      >
                        <span>{p.product_name}</span>
                        <span className="number">
                          {quantity(p.current_stock)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="muted text-sm">{t("noData")}</p>
                  )}
                </div>
              </section>
            </div>
            <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-slate-300 px-5 py-4">
              <div>
                <p className="text-sm">
                  {t("netPosition")}:{" "}
                  <span className="number font-semibold">
                    {money(data.total_receivables - data.total_payables)}
                  </span>
                </p>
                <p className="muted mt-1 text-xs">{t("netNote")}</p>
              </div>
              <button onClick={copyBrief} className="button-secondary">
                {copied ? t("copied") : t("dailyBrief")}
              </button>
            </footer>
          </>
        )
      )}
      {!loading && !data && !error && <Empty title={t("setupTitle")} />}
    </>
  );
}
export default function Page() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
