import { useAuthStore } from "./store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** `browser` = the whole API is served in-browser by lib/demo (public demo). */
export const BROWSER_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "browser";

export class ApiError extends Error {
  status: number;
  code?: string;
  detail?: unknown;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
    if (detail && typeof detail === "object" && "code" in detail)
      this.code = String((detail as { code: unknown }).code);
  }
}

type Options = { method?: string; body?: unknown; headers?: Record<string, string>; raw?: boolean };

function messageFrom(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail)
    return String((detail as { message: unknown }).message);
  return fallback;
}

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const method = options.method ?? "GET";

  let status: number;
  let payload: unknown;
  if (BROWSER_DEMO) {
    const { demoRequest } = await import("./demo/adapter");
    const res = await demoRequest(method, path, options.body as Record<string, unknown> | undefined, headers);
    status = res.status;
    payload = res.body;
  } else {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(0, "Connection unavailable. Please try again.");
    } finally {
      clearTimeout(timeout);
    }
    status = res.status;
    if (options.raw && res.ok) payload = await res.blob();
    else if (status === 204) payload = undefined;
    else {
      try {
        payload = await res.json();
      } catch {
        payload = { detail: res.statusText };
      }
    }
  }

  if (status === 401) useAuthStore.getState().clearAuth();
  if (status < 200 || status >= 300) {
    const detail = (payload as { detail?: unknown } | undefined)?.detail;
    throw new ApiError(status, messageFrom(detail, "Please check the entered values."), detail);
  }
  return payload as T;
}

/** A fresh key per user intent: retries of the SAME submission reuse it. */
export function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: "POST", body, headers }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** Binary download (statement PDF) in both API and browser-demo modes. */
  blob: (path: string) => request<Blob>(path, { raw: true }),
};

export { API_URL };
