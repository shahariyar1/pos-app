# Memo POS: Next.js 16 + MongoDB inventory & point of sale

## Setup
```bash
npm install
cp .env.example .env.local     # set MONGODB_URI, PROFIT_PIN, AUTH_SECRET
npm run dev
```
The shadcn/ui primitives are already in `src/components/ui` (button, input, label, card, table, dialog, alert-dialog,
command, badge, select, sheet, switch, textarea, skeleton). `components.json` is included if you want to add more with the CLI.
Run `npm run typecheck` once after install.

## How the important rules work
- **Stock "+"**: `POST /api/products/:id/stock` is an atomic `$inc` guarded by `stock >= n`, so two tablets can't oversell.
  Removing a line or discarding the memo gives the units back. The memo is persisted (Zustand + localStorage) and survives navigation and refresh.
  Checkout does not decrement stock again.
- **Due tracking**: the server recomputes totals and reads the customer's due itself. Grand total = memo subtotal + previous due.
  Instant sell pays the grand total; Save as due keeps the unpaid part on the customer via an atomic `$inc` delta.
- **Profit is hidden server-side**: cost prices and profit only leave the API after `POST /api/auth/unlock` with `PROFIT_PIN`
  (signed httpOnly cookie, 15 minutes, rate-limited). Sales store a cost snapshot per line, so later cost edits don't rewrite history.
- **Returns**: restock is automatic (can be switched off for damaged goods). Refund is either cash or a reduction of the customer's due.
  Each return stores its profit impact, and net profit = sales margin - returns impact.
- **Dates**: the browser sends the shop's local day boundaries as ISO timestamps, so "today" is correct whatever the server timezone.

## Production notes
- Run MongoDB as a replica set (Atlas) and wrap checkout/returns in `session.withTransaction` if you need all-or-nothing writes.
- The PIN gate protects profit data only. Add real login (Auth.js / Better Auth) for per-user roles; `src/proxy.ts` offers optional basic auth meanwhile.
- Abandoned memos keep their units reserved until discarded. Add a scheduled job if staff may leave memos open overnight.

## Cover finder
`/covers` lists your cover sheet (phone models and the shelf letter where each cover is kept). Type a phone model and it shows
every location that holds a fitting cover. The sheet in `src/data/covers.json` is loaded into MongoDB the first time the page opens;
after that, add, edit and delete groups from the page itself.
