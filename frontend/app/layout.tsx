import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import Nav from "@/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const urdu = Noto_Sans_Arabic({
  variable: "--font-urdu",
  subsets: ["arabic"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "AI TradeFlow", template: "%s | AI TradeFlow" },
  description: "AI-powered inventory & accounting for Pakistan's wholesalers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${urdu.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <a
            href="#workspace"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4"
          >
            Skip to workspace
          </a>
          <Nav />
          <main id="workspace" className="app-main flex-1">
            {children}
          </main>
        </I18nProvider>
      </body>
    </html>
  );
}
