"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

const LINKS: { href: string; key: "dashboard" | "parties" | "products" | "purchases" | "sales" | "khata" | "munshi" }[] = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/parties", key: "parties" },
  { href: "/products", key: "products" },
  { href: "/purchases", key: "purchases" },
  { href: "/sales", key: "sales" },
  { href: "/khata", key: "khata" },
  { href: "/munshi", key: "munshi" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, clearAuth } = useAuthStore();
  const { t, lang, setLang } = useI18n();

  if (!token) return null;

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/dashboard" className="font-bold">{t("appName")}</Link>
        <nav className="flex flex-wrap gap-3 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathname?.startsWith(link.href) ? "font-semibold underline" : "text-black/60 hover:underline dark:text-white/60"}
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <button onClick={() => setLang(lang === "en" ? "ur" : "en")} className="rounded border border-black/10 px-2 py-1 dark:border-white/20">
            {lang === "en" ? "اردو" : "English"}
          </button>
          <span className="text-black/50 dark:text-white/50">{user?.name}</span>
          <button
            onClick={() => {
              clearAuth();
              router.replace("/login");
            }}
            className="text-red-600 hover:underline dark:text-red-400"
          >
            {t("logout")}
          </button>
        </div>
      </div>
    </header>
  );
}
