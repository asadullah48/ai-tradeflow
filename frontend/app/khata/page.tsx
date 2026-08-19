"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Party = { id: string; name: string; type: string };
type Balance = { party_id: string; party_name: string; balance: number; aging: { label: string; amount: number }[] };

function KhataContent() {
  const { t } = useI18n();
  const [parties, setParties] = useState<Party[]>([]);
  const [balances, setBalances] = useState<Record<string, Balance>>({});

  useEffect(() => {
    api.get<Party[]>("/parties").then(async (list) => {
      setParties(list);
      const entries = await Promise.all(
        list.map(async (p) => [p.id, await api.get<Balance>(`/ledger/parties/${p.id}/balance`)] as const)
      );
      setBalances(Object.fromEntries(entries));
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("khata")}</h1>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/10">
              <th className="py-2">{t("party")}</th>
              <th>{t("balance")}</th>
              <th>90+ days</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {parties.map((p) => {
              const balance = balances[p.id];
              const overdue = balance?.aging.find((a) => a.label === "90+")?.amount ?? 0;
              return (
                <tr key={p.id} className="border-b border-black/5 dark:border-white/10">
                  <td className="py-2">{p.name}</td>
                  <td className={balance?.balance > 0 ? "text-green-700 dark:text-green-400" : balance?.balance < 0 ? "text-red-600 dark:text-red-400" : ""}>
                    {balance ? `Rs ${balance.balance.toLocaleString()}` : "..."}
                  </td>
                  <td className={overdue > 0 ? "text-red-600 dark:text-red-400" : ""}>{overdue > 0 ? `Rs ${overdue.toLocaleString()}` : "-"}</td>
                  <td>
                    <Link href={`/khata/${p.id}`} className="text-blue-600 hover:underline dark:text-blue-400">View</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function KhataPage() {
  return (
    <RequireAuth>
      <KhataContent />
    </RequireAuth>
  );
}
