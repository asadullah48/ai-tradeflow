"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, useAuthHydrated } from "@/lib/store";

export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = useAuthStore((s) => s.token);
  const router = useRouter();
  const hydrated = useAuthHydrated();

  useEffect(() => {
    if (hydrated && !token) router.replace("/login");
  }, [token, router, hydrated]);

  if (!hydrated || !token) return null;
  return <>{children}</>;
}
