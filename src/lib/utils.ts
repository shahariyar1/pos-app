import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const money = new Intl.NumberFormat(process.env.NEXT_PUBLIC_LOCALE ?? "en-BD", {
  style: "currency",
  currency: process.env.NEXT_PUBLIC_CURRENCY ?? "BDT",
  maximumFractionDigits: 2,
});
export const formatMoney = (n: number) => money.format(n);

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date as YYYY-MM-DD (browser timezone). */
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Converts two local dates into an inclusive ISO range, so "today" means the shop's today. */
export function dayRange(from: string, to: string) {
  return {
    from: new Date(`${from}T00:00:00`).toISOString(),
    to: new Date(`${to}T23:59:59.999`).toISOString(),
  };
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
