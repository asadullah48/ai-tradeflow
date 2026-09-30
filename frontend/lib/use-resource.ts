"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
export function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef({ id: 0 });
  const reload = useCallback(async () => {
    const id = ++generation.current.id;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<T>(path);
      if (id === generation.current.id) setData(result);
    } catch (e) {
      if (id === generation.current.id)
        setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      if (id === generation.current.id) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    const state = generation.current;
    const timer = setTimeout(reload, 150);
    return () => {
      clearTimeout(timer);
      state.id++;
    };
  }, [reload]);
  return { data, error, loading, reload };
}
