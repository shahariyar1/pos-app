import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerProductDetails } from "@/features/portal/customer-product-details";

export const metadata: Metadata = { title: "Product Details" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f\\d]{24}$/i.test(id)) notFound();
  return <CustomerProductDetails id={id} />;
}
