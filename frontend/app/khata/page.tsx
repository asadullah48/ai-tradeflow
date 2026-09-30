"use client";
import Link from "next/link";
import { useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { Heading, Notice, Loading, Empty } from "@/components/Workspace";
import { useResource } from "@/lib/use-resource";
import { useI18n } from "@/lib/i18n";
import { money } from "@/lib/format";
type Balance = {
  party_id: string;
  party_name: string;
  balance: number;
  aging: { label: string; amount: number }[];
};
function Content() {
  const { t } = useI18n();
  const { data, error, loading, reload } =
    useResource<Balance[]>("/ledger/balances");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const rows = (data ?? [])
    .filter(
      (p) =>
        p.party_name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
        (filter === "all" ||
          (filter === "receivable" && p.balance > 0) ||
          (filter === "payable" && p.balance < 0)),
    )
    .sort(
      (a, b) =>
        (b.aging.find((i) => i.label === "90+")?.amount ?? 0) -
        (a.aging.find((i) => i.label === "90+")?.amount ?? 0),
    );
  return (
    <>
      <Heading title={t("khata")} description={t("khataSubtitle")} />
      {error && (
        <Notice>
          {t("loadFailed")}{" "}
          <button onClick={reload} className="underline">
            {t("retry")}
          </button>
        </Notice>
      )}
      <div className="mb-5 flex flex-wrap gap-3">
        <label className="w-full sm:max-w-sm">
          <span className="sr-only">{t("search")}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {["all", "receivable", "payable"].map((k) => (
            <button
              key={k}
              className={filter === k ? "button-primary" : "button-secondary"}
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
            >
              {t(k === "all" ? "allParties" : (k as "receivable" | "payable"))}
            </button>
          ))}
        </div>
      </div>
      {loading && !data ? (
        <Loading />
      ) : rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("party")}</th>
                <th>{t("balance")}</th>
                <th>{t("status")}</th>
                <th>{t("overdue")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.party_id}>
                  <td className="font-medium">{p.party_name}</td>
                  <td className="number font-semibold">
                    {money(Math.abs(p.balance))}
                  </td>
                  <td>
                    <span
                      className={`pill ${p.balance < 0 ? "pill-warning" : ""}`}
                    >
                      {t(
                        p.balance > 0
                          ? "receivable"
                          : p.balance < 0
                            ? "payable"
                            : "settled",
                      )}
                    </span>
                  </td>
                  <td className="number text-amber-800">
                    {money(p.aging.find((a) => a.label === "90+")?.amount ?? 0)}
                  </td>
                  <td>
                    <Link
                      href={`/khata/${p.party_id}`}
                      className="font-medium text-teal-700 underline"
                    >
                      {t("view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={t("noData")}>
          <Link href="/parties" className="button-secondary mt-3">
            {t("newParty")}
          </Link>
        </Empty>
      )}
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
