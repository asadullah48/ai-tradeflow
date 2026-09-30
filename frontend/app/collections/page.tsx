"use client";
import { useState } from "react";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { Empty, Heading, Loading, Notice } from "@/components/Workspace";
import { useI18n } from "@/lib/i18n";
import { useResource } from "@/lib/use-resource";
import { money } from "@/lib/format";

type Row = {
  rank: number;
  party_id: string;
  party_name: string;
  party_name_ur: string | null;
  phone: string | null;
  balance: number;
  overdue: number;
  aging: Record<"current" | "30" | "60" | "90+", number>;
  credit_limit: number;
  over_limit: boolean;
  last_payment_date: string | null;
  days_since_payment: number | null;
  priority_score: number;
  reasons: string[];
  message: { en: string; roman_ur: string };
  whatsapp_url: string | null;
};
type Desk = { as_of: string; total_receivable: number; total_overdue: number; customers: Row[] };

const BUCKET_COLORS = { current: "#9fd8c8", "30": "#f3c46b", "60": "#e8894a", "90+": "#c2413a" } as const;

function AgingBar({ row }: { row: Row }) {
  const { t } = useI18n();
  const total = Math.max(row.balance, 1);
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {(["current", "30", "60", "90+"] as const).map((b) =>
          row.aging[b] > 0 ? (
            <div key={b} style={{ width: `${(row.aging[b] / total) * 100}%`, background: BUCKET_COLORS[b] }} />
          ) : null,
        )}
      </div>
      <p className="muted mt-1.5 flex flex-wrap gap-x-3 text-[11px]">
        {(["current", "30", "60", "90+"] as const).map((b) => (
          <span key={b} className="number">
            {b === "current" ? t("ageCurrent") : b === "90+" ? b : `${b}+`}: {money(row.aging[b])}
          </span>
        ))}
      </p>
    </div>
  );
}

function Content() {
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useResource<Desk>("/collections");
  const [msgLang, setMsgLang] = useState<"roman_ur" | "en">("roman_ur");
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(row: Row) {
    try {
      await navigator.clipboard.writeText(row.message[msgLang]);
      setCopied(row.party_id);
      setTimeout(() => setCopied(null), 2500);
    } catch {}
  }
  const waUrl = (row: Row) =>
    row.whatsapp_url && msgLang === "en"
      ? row.whatsapp_url.replace(/text=.*$/, `text=${encodeURIComponent(row.message.en)}`)
      : row.whatsapp_url;

  return (
    <>
      <Heading
        title={t("collections")}
        description={t("collectionsSubtitle")}
        action={
          <label className="flex items-center gap-2 text-sm">
            <span className="muted whitespace-nowrap">{t("messageLanguage")}</span>
            <select value={msgLang} onChange={(e) => setMsgLang(e.target.value as "roman_ur" | "en")} className="!w-auto">
              <option value="roman_ur">{t("romanUrdu")}</option>
              <option value="en">{t("english")}</option>
            </select>
          </label>
        }
      />
      {error && (
        <Notice>
          {t("loadFailed")}{" "}
          <button onClick={reload} className="underline">{t("retry")}</button>
        </Notice>
      )}
      {loading && !data ? (
        <Loading />
      ) : data && data.customers.length ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="panel !border-[#102f3a] !bg-[#102f3a] text-white">
              <p className="text-sm text-[#b4cbd2]">{t("totalReceivable")}</p>
              <p className="number mt-3 text-2xl font-semibold">{money(data.total_receivable)}</p>
            </div>
            <div className="panel">
              <p className="muted text-sm">{t("totalOverdue")}</p>
              <p className="number mt-3 text-2xl font-semibold">{money(data.total_overdue)}</p>
            </div>
            <div className="panel">
              <p className="muted text-sm">{t("customer")}</p>
              <p className="number mt-3 text-2xl font-semibold">{data.customers.length}</p>
            </div>
          </div>
          <p className="muted mb-4 text-xs">{t("nothingSent")}</p>
          <ol className="space-y-3">
            {data.customers.map((row) => (
              <li key={row.party_id} className="panel grid gap-4 lg:grid-cols-[auto_1.2fr_1fr_auto] lg:items-center">
                <span className="number grid h-10 w-10 place-items-center rounded-full bg-[#e8f3ef] font-semibold text-[#08695f]">
                  {row.rank}
                </span>
                <div className="min-w-0">
                  <Link href={`/khata/${row.party_id}`} className="font-semibold hover:text-teal-700">
                    {lang === "ur" && row.party_name_ur ? row.party_name_ur : row.party_name}
                  </Link>
                  <p className="number mt-1 text-lg font-semibold">{money(row.balance)}</p>
                  <div className="mt-2">
                    <AgingBar row={row} />
                  </div>
                </div>
                <div className="text-sm">
                  <p className="eyebrow mb-1.5">{t("whyRanked")}</p>
                  <ul className="space-y-1">
                    {row.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <p className="muted mt-2 text-xs">
                    {t("lastPayment")}: <span className="number">{row.last_payment_date ?? t("never")}</span>
                    {row.over_limit && <span className="pill pill-warning ms-2">{t("overLimit")}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 lg:flex-col">
                  {waUrl(row) ? (
                    <a href={waUrl(row)!} target="_blank" rel="noreferrer" className="button-primary">
                      {t("sendWhatsApp")}
                    </a>
                  ) : (
                    <span className="muted text-xs">{t("noPhone")}</span>
                  )}
                  <button onClick={() => copy(row)} className="button-secondary">
                    {copied === row.party_id ? t("messageCopied") : t("copyMessage")}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        data && <Empty title={t("noCollections")} />
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
