/**
 * Turns the rows of an uploaded Excel / CSV / PDF into inventory items.
 * Pure functions: the upload dialog uses them for the preview, and the server re-validates everything.
 *
 * Two layouts are understood:
 *  - "table": a header row (Name, Code, Location, Cost, Price, Stock ...) and one product per row.
 *  - "cover": rows like your cover sheet: phone models separated by "/", with the location at the end of the row.
 */
export type Sheet = { name: string; rows: string[][] };
export type ProductRow = {
  name: string;
  code: string;
  location: string;
  group: string;
  costPrice: number | null;
  salePrice: number | null;
  stock: number | null;
};
export type CoverRow = { location: string; models: string[] };
export type Analysis = {
  products: ProductRow[];
  covers: CoverRow[];
  kinds: { sheet: string; kind: "table" | "cover" | "empty"; count: number }[];
  warnings: string[];
};
export type Defaults = { costPrice: number; salePrice: number; stock: number };
export type ImportOptions = { addCoverGroups: boolean; addCoverProducts: boolean; existing: "skip" | "add_stock" | "replace" };

/* ---------------- CSV ---------------- */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, "");
  const first = t.split(/\r?\n/, 1)[0] ?? "";
  let delim = ",";
  let best = 0;
  for (const d of [",", ";", "\t"]) {
    const n = first.split(d).length;
    if (n > best) {
      best = n;
      delim = d;
    }
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cell.trim());
      cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

/* ---------------- helpers ---------------- */
export const tidyName = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.toLowerCase() === "iphone" ? "iPhone" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");

export function parseNum(s: string | undefined): number | null {
  if (s === undefined) return null;
  const cleaned = s.replace(/,/g, "").replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

type Field = "name" | "code" | "group" | "location" | "cost" | "price" | "stock";
const SYNONYMS: Record<Field, string[]> = {
  name: ["name", "productname", "product", "item", "itemname", "model", "description", "title"],
  code: ["code", "sku", "itemcode", "productcode", "barcode", "partno", "partnumber", "id"],
  group: ["group", "category", "section", "class", "department", "productgroup"],
  location: ["location", "shelf", "bin", "rack", "position", "place", "loc"],
  cost: ["cost", "costprice", "buy", "buyprice", "buyingprice", "purchase", "purchaseprice", "wholesale"],
  price: ["price", "saleprice", "salesprice", "sellprice", "sellingprice", "sell", "selling", "sale", "retail", "retailprice", "unitprice", "mrp", "rate"],
  stock: ["stock", "qty", "quantity", "onhand", "balance", "units", "count", "instock"],
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Finds a header row in the first 10 rows: it needs a name column plus at least one other known column. */
function findHeader(rows: string[][]): { index: number; map: Partial<Record<Field, number>> } | null {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const map: Partial<Record<Field, number>> = {};
    rows[i].forEach((cell, col) => {
      const n = norm(cell);
      if (!n) return;
      for (const f of Object.keys(SYNONYMS) as Field[]) {
        if (map[f] === undefined && SYNONYMS[f].includes(n)) {
          map[f] = col;
          break;
        }
      }
    });
    if (map.name !== undefined && Object.keys(map).length >= 2) return { index: i, map };
  }
  return null;
}

const LOC_CELL = /^[A-Za-z]{1,2}\d{0,2}$/;
const LOC_TAIL = /^(.*\S)\s+([A-Z]{1,2}\d{0,2})$/;

/** One row of the cover layout -> location + models. Returns "nolocation" when the row has models but no location. */
function coverRow(cells: string[]): CoverRow | "nolocation" | null {
  const c = cells.map((x) => x.trim()).filter(Boolean);
  if (!c.length) return null;
  let location = "";
  let body = c;
  const last = c[c.length - 1];
  if (c.length > 1 && LOC_CELL.test(last)) {
    location = last;
    body = c.slice(0, -1);
  } else {
    const m = last.match(LOC_TAIL);
    if (m) {
      location = m[2];
      body = [...c.slice(0, -1), m[1]];
    }
  }
  const seen = new Set<string>();
  const models: string[] = [];
  for (const part of body.join("/").split("/")) {
    const m = part.replace(/\s+/g, " ").trim();
    if (m && !seen.has(m.toLowerCase())) {
      seen.add(m.toLowerCase());
      models.push(m);
    }
  }
  if (!models.length) return null;
  if (!location) return "nolocation";
  return { location: location.toUpperCase(), models };
}

/* ---------------- main entry ---------------- */
export function analyse(sheets: Sheet[]): Analysis {
  const out: Analysis = { products: [], covers: [], kinds: [], warnings: [] };

  for (const sheet of sheets) {
    const header = findHeader(sheet.rows);

    if (header) {
      const { map, index } = header;
      const cell = (r: string[], f: Field) => (map[f] === undefined ? "" : (r[map[f] as number] ?? "").trim());
      let count = 0;
      for (const r of sheet.rows.slice(index + 1)) {
        const name = cell(r, "name");
        if (!name) continue;
        out.products.push({
          name,
          code: cell(r, "code") || name.slice(0, 80),
          location: cell(r, "location"),
          group: cell(r, "group"),
          costPrice: parseNum(cell(r, "cost")),
          salePrice: parseNum(cell(r, "price")),
          stock: (() => {
            const n = parseNum(cell(r, "stock"));
            return n === null ? null : Math.max(0, Math.floor(n));
          })(),
        });
        count++;
      }
      out.kinds.push({ sheet: sheet.name, kind: count ? "table" : "empty", count });
      continue;
    }

    let groups = 0;
    let noLocation = 0;
    for (const r of sheet.rows) {
      const parsed = coverRow(r);
      if (parsed === "nolocation") noLocation++;
      else if (parsed) {
        out.covers.push(parsed);
        groups++;
      }
    }
    if (noLocation) {
      out.warnings.push(`${noLocation} row${noLocation === 1 ? "" : "s"} in "${sheet.name}" had no location at the end and were skipped.`);
    }
    out.kinds.push({ sheet: sheet.name, kind: groups ? "cover" : "empty", count: groups });
  }

  if (!out.products.length && !out.covers.length) out.warnings.push("Nothing usable was found in this file.");
  return out;
}

/** Final list sent to the server. Missing numbers use the defaults typed in the dialog. */
export function buildPayload(a: Analysis, d: Defaults, o: ImportOptions) {
  const products: { name: string; code: string; location: string; group: string; costPrice: number; salePrice: number; stock: number }[] = [];
  const seen = new Set<string>();
  const push = (p: (typeof products)[number]) => {
    const k = `${p.name}|${p.code}|${p.location}`.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    products.push(p);
  };

  for (const r of a.products) {
    push({
      name: r.name.slice(0, 120),
      code: r.code.slice(0, 80),
      location: r.location.slice(0, 20),
      group: r.group.slice(0, 40),
      costPrice: Math.max(0, r.costPrice ?? d.costPrice),
      salePrice: Math.max(0, r.salePrice ?? d.salePrice),
      stock: Math.max(0, Math.floor(r.stock ?? d.stock)),
    });
  }
  if (o.addCoverProducts) {
    for (const g of a.covers) {
      for (const m of g.models) {
        push({ name: tidyName(m).slice(0, 120), code: "Cover", location: g.location.slice(0, 20), group: "Cover", costPrice: d.costPrice, salePrice: d.salePrice, stock: d.stock });
      }
    }
  }

  const coverGroups: { location: string; models: string[] }[] = [];
  if (o.addCoverGroups) {
    for (const g of a.covers) {
      const models = g.models.map((m) => m.slice(0, 120));
      for (let i = 0; i < models.length; i += 300) coverGroups.push({ location: g.location.slice(0, 5), models: models.slice(i, i + 300) });
    }
  }
  return { products, coverGroups, existing: o.existing };
}
