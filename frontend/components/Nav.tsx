"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { BROWSER_DEMO } from "@/lib/api";
import { DEMO_ACCOUNTS, signIn } from "@/lib/session";

const LINKS = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/sales", key: "sales" },
  { href: "/purchases", key: "purchases" },
  { href: "/khata", key: "khata" },
  { href: "/collections", key: "collections" },
  { href: "/munshi", key: "munshi" },
  { href: "/products", key: "products" },
  { href: "/parties", key: "parties" },
  { href: "/team", key: "team" },
] as const;

function DemoBar() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const [busy, setBusy] = useState(false);
  async function switchTo(role: "owner" | "munshi") {
    if (busy || user?.role === role) return;
    setBusy(true);
    try {
      await signIn(DEMO_ACCOUNTS[role].phone, DEMO_ACCOUNTS[role].password);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    const { resetDemoBooks } = await import("@/lib/demo/adapter");
    resetDemoBooks();
    window.location.reload();
  }
  return (
    <div className="no-print border-b border-amber-200 bg-amber-50 text-amber-950">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-2 text-xs md:px-8">
        <p>{t("demoBanner")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1" role="group" aria-label={t("viewAs")}>
            <span className="me-1">{t("viewAs")}:</span>
            {(["owner", "munshi"] as const).map((role) => (
              <button
                key={role}
                disabled={busy}
                aria-pressed={user?.role === role}
                onClick={() => switchTo(role)}
                className={`rounded-md border px-2 py-1 ${user?.role === role ? "border-amber-900 bg-amber-900 text-white" : "border-amber-300 bg-white"}`}
              >
                {t(role === "owner" ? "ownerRole" : "munshiRole")}
              </button>
            ))}
          </span>
          <button onClick={reset} className="underline">
            {t("resetDemo")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, clearAuth } = useAuthStore();
  const { t, lang, setLang } = useI18n();
  if (!token || pathname === "/") return null;
  return (
    <>
      {BROWSER_DEMO && <DemoBar />}
      <header className="app-navigation border-b border-[#203d47] bg-[#102f3a] text-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-lg bg-[#b3ead7] text-xl font-bold text-[#102f3a]"
            >
              T
            </span>
            <span className="text-lg font-semibold tracking-tight">
              {user?.business_name ?? "AI TradeFlow"}
              <span className="block text-xs font-normal text-[#a3bcc5]">
                AI TradeFlow · {t("brandLine")}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => setLang(lang === "en" ? "ur" : "en")}
              className="min-h-10 rounded-lg border border-white/20 px-3"
            >
              {lang === "en" ? "اردو" : "English"}
            </button>
            <span className="hidden text-end text-[#b4cbd2] sm:block">
              {user?.name}
              {user?.role && (
                <span className="block text-xs text-[#80b4b4]">
                  {t(user.role === "owner" ? "ownerRole" : "munshiRole")}
                </span>
              )}
            </span>
            <button
              onClick={() => {
                clearAuth();
                router.replace("/login");
              }}
              className="text-[#b4cbd2] hover:text-white"
            >
              {t("logout")}
            </button>
          </div>
        </div>
        <nav
          aria-label={t("navigation")}
          className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 pb-0 md:px-7"
        >
          {LINKS.map((link, i) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors ${active ? "border-[#b3ead7] bg-white/5 text-[#b3ead7]" : "border-transparent text-[#b4cbd2] hover:bg-white/5 hover:text-white"}`}
              >
                <span aria-hidden className="font-mono text-[11px] opacity-50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {t(link.key)}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
