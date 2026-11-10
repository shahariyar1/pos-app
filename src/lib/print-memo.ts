import { SHOP_ADDRESS, SHOP_NAME, SHOP_PHONES } from "@/lib/shop";
import { formatDateTime, formatMoney } from "@/lib/utils";
import type { Sale } from "@/types";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Opens the browser print dialog with a clean memo. Cost prices are never printed. */
export function printSale(sale: Sale) {
  const shop = SHOP_NAME;

  const rows = sale.items
    .map(
      (i) =>
        `<tr><td>${esc(i.name)}<small>${esc(i.code)}</small></td><td class="r">${i.qty}</td><td class="r">${formatMoney(i.unitPrice)}</td><td class="r">${formatMoney(i.qty * i.unitPrice)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.invoiceNo)}</title>
<style>
  @page { margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Arial, sans-serif; font-size: 13px; color: #111; margin: 0; }
  .wrap { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0; }
  .muted { color: #555; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
  .meta { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; border-bottom: 1px solid #111; padding: 6px 4px; font-size: 12px; }
  td { padding: 6px 4px; border-bottom: 1px solid #ddd; vertical-align: top; }
  small { display: block; color: #666; font-size: 11px; }
  .r { text-align: right; white-space: nowrap; }
  .totals { margin-left: auto; width: 280px; margin-top: 12px; }
  .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
  .grand { font-weight: 700; font-size: 15px; border-top: 1px solid #111; margin-top: 4px; padding-top: 6px !important; }
  .due { font-weight: 700; border: 1px solid #111; padding: 6px !important; margin-top: 6px; }
  .foot { text-align: center; margin-top: 24px; color: #555; }
</style></head><body><div class="wrap">
  <div class="head">
    <div><h1>${esc(shop)}</h1><div>${esc(SHOP_PHONES)}</div><div>${esc(SHOP_ADDRESS)}</div><div class="muted" style="margin-top:4px">Cash Memo</div></div>
    <div class="meta"><strong>${esc(sale.invoiceNo)}</strong><br>${esc(formatDateTime(sale.createdAt))}<br>Customer: <strong>${esc(sale.customerName)}</strong>${sale.customerAddress ? `<br>${esc(sale.customerAddress)}` : ""}${sale.dsr ? `<br><span class="muted">Sold by: ${esc(sale.dsr)}</span>` : ""}</div>
  </div>
  <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals">
    <div><span>Subtotal</span><span>${formatMoney(sale.subtotal)}</span></div>
    ${sale.discount ? `<div><span>Discount</span><span>- ${formatMoney(sale.discount)}</span></div>` : ""}
    ${sale.returnTotal ? `<div><span>Returned items</span><span>- ${formatMoney(sale.returnTotal)}</span></div>` : ""}
    ${sale.previousDue ? `<div><span>${sale.previousDue > 0 ? "Previous due" : "Store credit"}</span><span>${formatMoney(sale.previousDue)}</span></div>` : ""}
    <div class="grand"><span>Grand total</span><span>${formatMoney(sale.grandTotal)}</span></div>
    <div><span>Paid</span><span>${formatMoney(sale.paid)}</span></div>
    ${sale.dueAfter > 0 ? `<div class="due"><span>Due</span><span>${formatMoney(sale.dueAfter)}</span></div>` : `<div class="muted"><span>Paid in full</span><span></span></div>`}
  </div>
  <div class="foot">Thank you for your business</div>
</div></body></html>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  win.onafterprint = () => frame.remove();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 150);
  setTimeout(() => frame.remove(), 120_000); // fallback if the browser never fires afterprint
}
