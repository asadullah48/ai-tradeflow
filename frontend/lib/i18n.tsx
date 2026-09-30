"use client";
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { messages, type Lang, type MessageKey } from "./messages";
type Context = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey) => string;
  dir: "ltr" | "rtl";
};
const I18nContext = createContext<Context | null>(null);
function snapshot(): Lang {
  try {
    return localStorage.getItem("tradeflow_lang") === "ur" ? "ur" : "en";
  } catch {
    return "en";
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("tradeflow-language", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("tradeflow-language", callback);
  };
}
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, snapshot, () => "en" as Lang);
  const dir = lang === "ur" ? "rtl" : "ltr";
  function setLang(next: Lang) {
    try {
      localStorage.setItem("tradeflow_lang", next);
    } catch {}
    window.dispatchEvent(new Event("tradeflow-language"));
  }
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);
  return (
    <I18nContext.Provider
      value={{ lang, setLang, t: (key) => messages[lang][key], dir }}
    >
      {children}
    </I18nContext.Provider>
  );
}
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n requires I18nProvider");
  return ctx;
}
