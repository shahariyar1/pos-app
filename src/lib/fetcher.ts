import { mutate } from "swr";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

function responseMessage(text: string, url: string, status: number) {
  if (!text.trim()) return `Empty server response (HTTP ${status}) from ${url}`;

  try {
    const data = JSON.parse(text);
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
    if (typeof data?.message === "string" && data.message.trim()) return data.message;
    return `Request failed (HTTP ${status}) from ${url}`;
  } catch {
    // Vercel/proxy failures can return HTML or plain text instead of JSON.
    const readable = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 280);

    return readable
      ? `Server returned a non-JSON response (HTTP ${status}) from ${url}: ${readable}`
      : `Server returned a non-JSON response (HTTP ${status}) from ${url}`;
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const responseText = await res.text();

  if (res.status === 401 && typeof window !== "undefined") {
    const here = window.location.pathname;
    if (!here.startsWith("/login") && !here.startsWith("/owner-login")) {
      window.location.href = here.startsWith("/shop") ? "/login" : "/owner-login";
    }
  }

  let data: T;
  try {
    data = responseText ? (JSON.parse(responseText) as T) : (null as T);
  } catch {
    throw new ApiError(responseMessage(responseText, url, res.status), res.status);
  }

  if (!res.ok) {
    throw new ApiError(responseMessage(responseText, url, res.status), res.status);
  }

  return data;
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
