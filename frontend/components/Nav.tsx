"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
const LINKS = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/parties", key: "parties" },
  { href: "/products", key: "products" },
  { href: "/purchases", key: "purchases" },
  { href: "/sales", key: "sales" },
  { href: "/khata", key: "khata" },
  { href: "/munshi", key: "munshi" },
] as const;
export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, clearAuth } = useAuthStore();
  const { t, lang, setLang } = useI18n();
  if (!token) return null;
  return (
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
            AI TradeFlow
            <span className="block text-xs font-normal text-[#a3bcc5]">
              {t("brandLine")}
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
          <span className="hidden text-[#b4cbd2] sm:block">{user?.name}</span>
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
  );
}
