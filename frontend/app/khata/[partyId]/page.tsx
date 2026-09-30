"use client";
import { useEffect, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { Heading, Field, Notice, Loading } from "@/components/Workspace";
import { api, newIdempotencyKey } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { money, today } from "@/lib/format";
type Balance = {
  party_id: string;
  party_name: string;
  balance: number;
  aging: { label: string; amount: number }[];
};
type Entry = {
  id: string;
  date: string;
  type: string;
  amount: number;
  method: string;
  note: string | null;
};
function Content() {
  const { partyId } = useParams<{ partyId: string }>();
  const { t } = useI18n();
  const [balance, setBalance] = useState<Balance | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("credit");
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [payKey, setPayKey] = useState(newIdempotencyKey);
  const [reminder, setReminder] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [b, e] = await Promise.all([
        api.get<Balance>(`/ledger/parties/${partyId}/balance`),
        api.get<Entry[]>(`/ledger/parties/${partyId}`),
      ]);
      setBalance(b);
      setEntries(e);
      if (b.balance > 0) {
        const desk = await api.get<{ customers: { party_id: string; whatsapp_url: string | null }[] }>("/collections");
        setReminder(desk.customers.find((c) => c.party_id === partyId)?.whatsapp_url ?? null);
      } else setReminder(null);
      setDirection(b.balance < 0 ? "debit" : "credit");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    }
  }, [partyId, t]);
  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (busy || Number(amount) <= 0) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.post(
        "/ledger/entries",
        { party_id: partyId, date: today(), type: direction, amount: Number(amount), method },
        { "Idempotency-Key": payKey },
      );
      setPayKey(newIdempotencyKey());
      setAmount("");
      setSaved(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      const r = await api.get<{ text: string }>(
        `/reports/party-statement/${partyId}`,
      );
      await navigator.clipboard.writeText(r.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(t("loadFailed"));
    }
  }
  async function pdf() {
    try {
      const url = URL.createObjectURL(await api.blob(`/reports/party-statement/${partyId}/pdf`));
      const a = document.createElement("a");
      a.href = url;
      a.download = `statement-${partyId}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(t("loadFailed"));
    }
  }
  return (
    <>
      <Link href="/khata" className="muted mb-4 inline-block text-sm underline">
        {t("khata")}
      </Link>
      {error && (
        <Notice>
          {error}{" "}
          <button onClick={load} className="underline">
            {t("retry")}
          </button>
        </Notice>
      )}
      {!balance ? (
        <Loading />
      ) : (
        <>
          <Heading
            title={balance.party_name}
            description={t("khataSubtitle")}
            action={
              <div className="flex flex-wrap gap-2">
                <button onClick={copy} className="button-secondary">
                  {copied ? t("copied") : t("copyStatement")}
                </button>
                <button onClick={pdf} className="button-secondary">
                  {t("downloadPdf")}
                </button>
                {reminder && (
                  <a href={reminder} target="_blank" rel="noreferrer" className="button-primary">
                    {t("remindWhatsApp")}
                  </a>
                )}
              </div>
            }
          />
          <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
            <div className="panel !bg-[#102f3a] text-white">
              <p className="text-sm text-[#b4cbd2]">
                {t(
                  balance.balance > 0
                    ? "receivable"
                    : balance.balance < 0
                      ? "payable"
                      : "settled",
                )}
              </p>
              <p className="number mt-4 text-3xl font-semibold">
                {money(Math.abs(balance.balance))}
              </p>
            </div>
            <div className="panel grid grid-cols-2 gap-5 sm:grid-cols-4">
              {balance.aging.map((a) => (
                <div key={a.label}>
                  <p className="muted text-sm">
                    {a.label === "current" ? t("ageCurrent") : `${a.label} ${t("days")}`}
                  </p>
                  <p className="number mt-3 font-semibold">{money(a.amount)}</p>
                </div>
              ))}
            </div>
          </div>
          {saved && (
            <p
              role="status"
              className="mb-4 rounded-xl bg-teal-50 p-4 text-sm text-teal-800"
            >
              {t("paymentSaved")}
            </p>
          )}
          <form onSubmit={pay} className="panel mb-7">
            <h2 className="mb-4 font-semibold">{t("recordPayment")}</h2>
            <div className="grid items-end gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field label={t("amount")}>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setPayKey(newIdempotencyKey());
                  }}
                />
              </Field>
              <Field label={t("paymentDirection")}>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                >
                  <option value="credit">{t("receivedPayment")}</option>
                  <option value="debit">{t("paidPayment")}</option>
                </select>
              </Field>
              <Field label={t("paymentMethod")}>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="cash">{t("cash")}</option>
                  <option value="bank">{t("bank")}</option>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">Easypaisa</option>
                </select>
              </Field>
              <button type="submit" disabled={busy} className="button-primary">
                {busy ? t("saving") : t("save")}
              </button>
            </div>
          </form>
          <h2 className="mb-4 text-lg font-semibold">{t("ledgerHistory")}</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("date")}</th>
                  <th>{t("paymentMethod")}</th>
                  <th>{t("note")}</th>
                  <th>{t("amount")}</th>
                  <th>{t("balance")}</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Running balance, oldest first — the way a paper khata reads.
                  let running = balance.balance - entries.reduce((a, x) => a + (x.type === "debit" ? x.amount : -x.amount), 0);
                  return entries.map((e) => {
                    running += e.type === "debit" ? e.amount : -e.amount;
                    return (
                      <tr key={e.id}>
                        <td className="number">{e.date}</td>
                        <td>{e.method}</td>
                        <td className="whitespace-normal">{e.note ?? "—"}</td>
                        <td className="number font-medium">
                          {e.type === "debit" ? "+" : "−"}
                          {money(e.amount)}
                        </td>
                        <td className="number muted">{money(running)}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
            {!entries.length && (
              <p className="muted p-5 text-sm">{t("noData")}</p>
            )}
          </div>
        </>
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
