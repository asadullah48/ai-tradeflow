"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/lib/store";
import { ApiError, BROWSER_DEMO } from "@/lib/api";
import { DEMO_ACCOUNTS, signIn } from "@/lib/session";

const REPO = "https://github.com/asadullah48/ai-tradeflow";

const DAY = [
  {
    n: "01",
    title: "Post once",
    body: "Receiving stock or recording a sale updates inventory, cost and the party khata in one transaction. Cash settles the invoice; udhaar leaves it open.",
  },
  {
    n: "02",
    title: "Keep the khata honest",
    body: "Invoice-aware aging (current / 30 / 60 / 90+), a running balance on every statement, PDF and WhatsApp-ready text.",
  },
  {
    n: "03",
    title: "Collect first what matters",
    body: "The collections desk ranks who to call, explains why, and opens WhatsApp with a Roman-Urdu or English reminder. Nothing is sent automatically.",
  },
  {
    n: "04",
    title: "Ask Munshi",
    body: "A read-only assistant that answers from your own books — reorder, udhaar, profit — and shows which tools it used.",
  },
];

const GUARANTEES = [
  ["Every business sees only its own books", "One ORM hook scopes every query, write and Munshi tool to the caller's business. Two-business leak tests attack every endpoint."],
  ["Stock cannot be oversold", "Stock is checked under a row lock. A 12-thread race against PostgreSQL proves exactly the available units sell."],
  ["A double tap posts once", "Orders and payments take an Idempotency-Key. A retried request returns the original instead of posting twice."],
  ["History is never edited", "Posted orders are corrected by an owner-only void that appends reversing stock and khata lines."],
  ["Yesterday's profit stays put", "Weighted-average cost is snapshotted on each sale line and money is stored as exact NUMERIC."],
  ["Credit limits mean something", "An udhaar sale over a customer's limit is refused. Only the owner can override it, and the approval is written into the khata."],
];

export default function Landing() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openDemo() {
    if (token) return router.push("/dashboard");
    if (!BROWSER_DEMO) return router.push("/login");
    setBusy(true);
    setError(null);
    try {
      await signIn(DEMO_ACCOUNTS.owner.phone, DEMO_ACCOUNTS.owner.password);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The demo could not start. Please try again.");
      setBusy(false);
    }
  }

  const cta = hydrated && token ? "Open your workspace" : BROWSER_DEMO ? "Open the live demo" : "Sign in";

  return (
    // The landing copy is English-only, so it stays LTR even after a visitor switched the app to Urdu.
    <div className="landing" dir="ltr" lang="en">
      <header className="border-b border-white/10 bg-[#102f3a] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <span className="flex items-center gap-3 font-semibold">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-[#b3ead7] font-bold text-[#102f3a]">T</span>
            AI TradeFlow
          </span>
          <nav className="flex items-center gap-4 text-sm">
            <a href={REPO} target="_blank" rel="noreferrer" className="text-[#b4cbd2] hover:text-white">GitHub</a>
            {!BROWSER_DEMO && <Link href="/login" className="text-[#b4cbd2] hover:text-white">Sign in</Link>}
            <button onClick={openDemo} disabled={busy} className="rounded-lg bg-[#b3ead7] px-3 py-2 font-semibold text-[#102f3a]">
              {BROWSER_DEMO ? "Live demo" : "Open app"}
            </button>
          </nav>
        </div>
      </header>

      <section className="bg-[#102f3a] text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.25fr_1fr] lg:pt-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#80d4bd]">Inventory · Khata · Munshi AI</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              The stock register and khata of a Pakistani wholesaler —{" "}
              <span className="text-[#b3ead7]">in books that can&apos;t drift.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#b4cbd2]">
              Jodia Bazaar still runs on registers, udhaar diaries and WhatsApp. TradeFlow posts every sale once, ages every rupee
              of udhaar, tells you whom to collect from first, and answers questions from your own numbers — in English or Urdu.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <button onClick={openDemo} disabled={busy}
                className="min-h-12 rounded-xl bg-[#b3ead7] px-6 font-semibold text-[#102f3a] hover:bg-white">
                {busy ? "Opening the books…" : `${cta} →`}
              </button>
              <a href={REPO} target="_blank" rel="noreferrer"
                className="min-h-12 rounded-xl border border-white/25 px-6 py-3 font-semibold hover:bg-white/5">
                Read the code
              </a>
            </div>
            {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
            <p className="mt-4 text-xs text-[#8fb0ba]">
              {BROWSER_DEMO
                ? "No sign-up. A fictional Karachi wholesaler with 90 days of trade, running entirely in your browser. Switch between owner and munshi to see permissions change."
                : "Sign in to your business, or create one."}
            </p>
          </div>

          <div className="space-y-3" aria-label="What the app produces">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#80d4bd]">Collections desk · rank 1</p>
              <p className="mt-2 font-semibold">Why this customer first</p>
              <ul className="mt-2 space-y-1 text-sm text-[#cfe0e5]">
                <li>· Oldest unpaid invoice is past 60 days</li>
                <li>· No payment for over a month</li>
                <li>· Over the credit limit you set</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0b2530] p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#80d4bd]">WhatsApp reminder · Roman Urdu</p>
              <p className="mt-2 text-sm leading-relaxed text-[#e4eef1]">
                “Assalam-o-Alaikum … ke khata mein aap ka baqaya Rs … hai, jis mein se Rs … 30 din se zyada purana hai.
                Meherbani farma kar jald adaigi kar dein.”
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#80d4bd]">Munshi AI</p>
              <p className="mt-2 text-sm text-[#e4eef1]">“Is haftay kya order karna chahiye?”</p>
              <p className="mt-2 text-xs text-[#8fb0ba]">Answer built from get_sales_velocity · read-only · shows its sources</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="eyebrow">A trading day</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Four jobs, done the same way every time.</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DAY.map((d) => (
            <div key={d.n} className="panel">
              <p className="font-mono text-xs text-[#087f74]">{d.n}</p>
              <h3 className="mt-3 font-semibold">{d.title}</h3>
              <p className="muted mt-2 text-sm leading-relaxed">{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#dce5e9] bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="eyebrow">Built like it holds real money</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">
            The database — not staff discipline — keeps the books correct.
          </h2>
          <div className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {GUARANTEES.map(([title, body]) => (
              <div key={title} className="flex gap-4">
                <span aria-hidden className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#e6f4f0] text-xs font-bold text-[#087f74]">✓</span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="muted mt-1 text-sm leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="muted mt-10 text-sm">
            FastAPI · SQLAlchemy 2 · PostgreSQL · Alembic · Next.js 16 · OpenAI Agents SDK · Expo companion app.
            The test suite, including the PostgreSQL concurrency tests, runs in CI on every push.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Munshi AI</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">An assistant that can read, never write.</h2>
          <p className="muted mt-4 leading-relaxed">
            Munshi runs on the OpenAI Agents SDK with five read-only tools: sales velocity, stock status, receivables aging,
            profit summary and party statement. The model narrates; it never computes the numbers and has no tool that
            changes stock or moves money.
          </p>
        </div>
        <ol className="space-y-3 text-sm">
          {[
            ["Constitution first", "Deterministic rules run before any model call. Requests for fake invoices, two sets of books, hidden income or smuggling are blocked; backdating and credit-limit overrides are flagged for a human."],
            ["Scoped to your business", "Each tool opens its own session scoped to the caller's business. The model never sees, and cannot choose, that scope."],
            ["Works without a model", "With no API key, or when the provider fails, Munshi answers straight from the same tools. The public demo runs in this mode."],
          ].map(([title, body], i) => (
            <li key={title} className="panel flex gap-4">
              <span className="font-mono text-xs text-[#087f74]">0{i + 1}</span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="muted mt-1 leading-relaxed">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[#e8f3ef]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-14 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">See a wholesaler&apos;s day in two minutes.</h2>
            <p className="muted mt-2 max-w-xl text-sm">
              Record a sale on udhaar, hit a credit limit, void a mistake, then open the collections desk. Reset the books any time.
            </p>
          </div>
          <button onClick={openDemo} disabled={busy} className="button-primary !min-h-12 !px-6">
            {cta} →
          </button>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-xs text-[#607480] sm:flex-row sm:justify-between">
        <p>
          Built by{" "}
          <a className="underline" href="https://asadullahshafique-devunity.vercel.app" target="_blank" rel="noreferrer">
            Asadullah Shafique
          </a>
          . Source on GitHub.
        </p>
        <p>Demo businesses, people and figures are fictional.</p>
      </footer>
    </div>
  );
}
