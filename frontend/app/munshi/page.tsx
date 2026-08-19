"use client";

import { useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Message = { role: "user" | "munshi"; text: string; blocked?: boolean; toolsCalled?: string[] };

const SUGGESTIONS = [
  "is haftay kya order karna chahiye?",
  "kis ka udhaar sab se purana hai?",
  "pichlay mahinay ka profit summary batao",
];

function MunshiContent() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!question.trim()) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const resp = await api.post<{ answer: string; tools_called: string[]; flagged: boolean; blocked: boolean }>("/agent/ask", { question });
      setMessages((m) => [...m, { role: "munshi", text: resp.answer, blocked: resp.blocked, toolsCalled: resp.tools_called }]);
    } catch {
      setMessages((m) => [...m, { role: "munshi", text: "Something went wrong. Please try again.", blocked: false }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col">
      <h1 className="text-2xl font-bold">{t("munshi")}</h1>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => ask(s)} className="rounded-full border border-black/10 px-3 py-1 text-xs dark:border-white/20">
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-lg border border-black/10 p-4 dark:border-white/10">
        {messages.length === 0 && <p className="text-sm text-black/50 dark:text-white/50">{t("noData")}</p>}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div
              className={`inline-block max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : m.blocked
                    ? "border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
                    : "border border-black/10 dark:border-white/10"
              }`}
            >
              {m.text}
            </div>
            {m.toolsCalled && m.toolsCalled.length > 0 && (
              <p className="mt-1 text-xs text-black/40 dark:text-white/40">tools used: {m.toolsCalled.join(", ")}</p>
            )}
          </div>
        ))}
        {loading && <p className="text-sm text-black/50">{t("loading")}</p>}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("askMunshi")}
          className="flex-1 rounded-lg border border-black/10 px-3 py-2 dark:border-white/20"
        />
        <button type="submit" disabled={loading} className="rounded-full bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
          {t("send")}
        </button>
      </form>
    </div>
  );
}

export default function MunshiPage() {
  return (
    <RequireAuth>
      <MunshiContent />
    </RequireAuth>
  );
}
