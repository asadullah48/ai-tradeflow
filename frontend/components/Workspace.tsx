"use client";
import { useId, cloneElement, isValidElement, type ReactNode, type ReactElement } from "react";
import { useI18n } from "@/lib/i18n";
export function Heading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-2">{t("workspace")}</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        <p className="muted mt-2 max-w-2xl text-sm leading-relaxed">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      {children}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel py-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <div className="muted mx-auto mt-2 max-w-lg text-sm">{children}</div>
    </div>
  );
}
export function Loading() {
  const { t } = useI18n();
  return (
    <div role="status" className="panel space-y-4">
      <p className="muted text-sm">{t("loading")}</p>
      <div className="h-5 w-2/3 rounded bg-slate-100" />
      <div className="h-5 w-1/3 rounded bg-slate-100" />
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children) ? cloneElement(children as ReactElement<{id?: string}>, {id}) : children}
    </div>
  );
}
