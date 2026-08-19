"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { api, apiFileUrl } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

type Balance = { party_id: string; party_name: string; balance: number; aging: { label: string; amount: number }[] };
type LedgerEntry = { id: string; date: string; type: string; amount: number; method: string; note: string | null };

function KhataDetailContent() {
  const { t } = useI18n();
  const params = useParams<{ partyId: string }>();
  const partyId = params.partyId;
  const token = useAuthStore((s) => s.token);

  const [balance, setBalance] = useState<Balance | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState("cash");

  function load() {
    api.get<Balance>(`/ledger/parties/${partyId}/balance`).then(setBalance);
    api.get<LedgerEntry[]>(`/ledger/parties/${partyId}`).then(setEntries);
  }

  useEffect(() => { load(); }, [partyId]);

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) return;
    await api.post("/ledger/entries", {
      party_id: partyId, date: new Date().toISOString().slice(0, 10), type: "credit", amount, method,
    });
    setAmount(0);
    load();
  }

  async function downloadPdf() {
    const res = await fetch(apiFileUrl(`/reports/party-statement/${partyId}/pdf`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!balance) return <p>{t("loading")}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">{balance.party_name}</h1>
      <p className="mt-1 text-xl">
        {t("balance")}: <span className={balance.balance >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>Rs {balance.balance.toLocaleString()}</span>
      </p>

      <div className="mt-3 flex gap-4 text-sm">
        {balance.aging.map((a) => (
          <span key={a.label} className={a.amount > 0 && a.label !== "current" ? "text-red-600 dark:text-red-400" : ""}>
            {a.label}: Rs {a.amount.toLocaleString()}
          </span>
        ))}
      </div>

      <button onClick={downloadPdf} className="mt-3 rounded-full border border-black/10 px-4 py-1 text-sm dark:border-white/20">
        Download PDF statement
      </button>

      <form onSubmit={recordPayment} className="mt-6 flex flex-wrap items-end gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Amount" className="rounded border border-black/10 px-2 py-1 dark:border-white/20" />
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded border border-black/10 px-2 py-1 dark:border-white/20">
          <option value="cash">Cash</option>
          <option value="bank">Bank</option>
          <option value="jazzcash">JazzCash</option>
          <option value="easypaisa">Easypaisa</option>
        </select>
        <button type="submit" className="rounded-full bg-black px-4 py-1 text-sm text-white dark:bg-white dark:text-black">Record payment</button>
      </form>

      <ul className="mt-6 space-y-1 text-sm">
        {entries.map((entry) => (
          <li key={entry.id} className="flex justify-between border-b border-black/5 py-1 dark:border-white/10">
            <span>{entry.date} - {entry.method} {entry.note ? `(${entry.note})` : ""}</span>
            <span className={entry.type === "debit" ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}>
              {entry.type === "debit" ? "+" : "-"}Rs {entry.amount.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function KhataDetailPage() {
  return (
    <RequireAuth>
      <KhataDetailContent />
    </RequireAuth>
  );
}
