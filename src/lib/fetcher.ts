import { mutate } from "swr";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401 && typeof window !== "undefined") {
    const here = window.location.pathname;
    if (!here.startsWith("/login") && !here.startsWith("/owner-login")) {
      window.location.href = here.startsWith("/shop") ? "/login" : "/owner-login";
    }
  }
  if (!res.ok) throw new ApiError(data?.error ?? "Request failed", res.status);
  return data as T;
}

export const fetcher = <T>(url: string) => api<T>(url);

/** Re-fetch every SWR key that starts with the prefix, e.g. revalidate("/api/products"). */
export const revalidate = (prefix: string) =>
  mutate((key) => typeof key === "string" && key.startsWith(prefix));

export function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
