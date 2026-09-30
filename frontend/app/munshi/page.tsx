"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { Heading, Field } from "@/components/Workspace";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
type Message = {
  role: "user" | "munshi";
  text: string;
  blocked?: boolean;
  flagged?: boolean;
  tools?: string[];
};
function Content() {
  const { t, lang } = useI18n();
  const params = useSearchParams();
  const [input, setInput] = useState(() => params.get("q") ?? "");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages, loading]);
  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);
    try {
      const r = await api.post<{
        answer: string;
        tools_called: string[];
        flagged: boolean;
        blocked: boolean;
      }>("/agent/ask", { question });
      setMessages((m) => [
        ...m,
        {
          role: "munshi",
          text: r.answer,
          blocked: r.blocked,
          flagged: r.flagged,
          tools: r.tools_called,
        },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "munshi", text: t("loadFailed") }]);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <Heading title={t("munshi")} description={t("munshiSubtitle")} />
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="panel h-fit !bg-[#e8f3ef]">
          <span className="pill">{t("auditNote")}</span>
          <h2 className="mt-5 text-xl font-semibold">{t("munshiWelcome")}</h2>
          <p className="muted mt-3 text-sm leading-relaxed">
            {t("munshiNote")}
          </p>
          <div className="mt-6 space-y-3">
            {["questionReorder", "questionCredit", "questionProfit"].map(
              (k, i) => (
                <button
                  key={k}
                  onClick={() =>
                    ask(
                      lang === "ur"
                        ? [
                            "is haftay kya order karna chahiye?",
                            "kis ka udhaar sab se purana hai?",
                            "pichlay mahinay ka profit summary batao",
                          ][i]
                        : t(
                            k as
                              | "questionReorder"
                              | "questionCredit"
                              | "questionProfit",
                          ),
                    )
                  }
                  disabled={loading}
                  className="button-secondary w-full !justify-start text-start leading-relaxed"
                >
                  {t(
                    k as
                      | "questionReorder"
                      | "questionCredit"
                      | "questionProfit",
                  )}
                </button>
              ),
            )}
          </div>
        </aside>
        <section className="panel flex min-h-[60dvh] flex-col">
          <div
            role="log"
            aria-live="polite"
            className="flex max-h-[55dvh] flex-1 flex-col gap-5 overflow-y-auto pb-6"
          >
            {messages.length === 0 && (
              <div className="m-auto max-w-sm py-16 text-center">
                <p className="eyebrow">{t("munshi")}</p>
                <p className="mt-4 text-xl font-semibold">
                  {t("munshiWelcome")}
                </p>
                <p className="muted mt-3 text-sm">{t("munshiNote")}</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user" ? "ms-auto max-w-[90%]" : "max-w-[95%]"
                }
              >
                <p className="muted mb-2 text-xs">
                  {m.role === "munshi" ? t("munshi") : t("name")}
                </p>
                <div
                  className={`whitespace-pre-wrap rounded-xl p-4 text-sm leading-relaxed ${m.role === "user" ? "bg-[#102f3a] text-white" : m.blocked ? "border border-red-200 bg-red-50 text-red-800" : "border border-slate-200 bg-slate-50"}`}
                >
                  {m.text}
                </div>
                {m.blocked && (
                  <span className="pill pill-warning mt-2">{t("blocked")}</span>
                )}
                {m.flagged && (
                  <span className="pill pill-warning mt-2">
                    {t("humanReview")}
                  </span>
                )}
                {!!m.tools?.length && (
                  <p className="muted mt-2 text-xs">
                    {t("evidence")}:{" "}
                    <span className="number">{m.tools.join(", ")}</span>
                  </p>
                )}
              </div>
            ))}
            {loading && (
              <p role="status" className="muted text-sm">
                {t("thinking")}
              </p>
            )}
            <div ref={bottom} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className="flex items-end gap-3 border-t border-slate-200 pt-4"
          >
            <div className="min-w-0 flex-1">
              <Field label={t("askMunshi")}>
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  required
                  maxLength={2000}
                />
              </Field>
            </div>
            <button
              disabled={loading || !input.trim()}
              className="button-primary"
              type="submit"
            >
              {t("send")}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
export default function Page() {
  return (
    <RequireAuth>
      <Suspense>
        <Content />
      </Suspense>
    </RequireAuth>
  );
}
