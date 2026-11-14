import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getDocumentProxy } from "unpdf";
import { withApi, HttpError } from "@/lib/api-handler";
import { parseCsv, type Sheet } from "@/lib/import-parse";
import { rowsFromItems, type TextBox } from "@/lib/pdf-rows";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel allows about 4.5 MB per request
const MAX_ROWS = 20000;

type PdfItem = { str?: string; transform: number[]; width: number; height: number };

async function pdfSheets(buf: Buffer): Promise<Sheet[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const rows: string[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const boxes: TextBox[] = (content.items as unknown as PdfItem[])
      .filter((i) => typeof i.str === "string" && i.str.trim() !== "")
      .map((i) => ({
        str: i.str as string,
        x: i.transform[4],
        y: i.transform[5],
        w: i.width,
        h: i.height || Math.abs(i.transform[3]) || 10,
      }));
    rows.push(...rowsFromItems(boxes));
  }
  return [{ name: "PDF", rows }];
}

function excelSheets(buf: Buffer): Sheet[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils
      .sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, defval: "" })
      .map((r) => r.map((c) => String(c ?? "").trim()))
      .filter((r) => r.some(Boolean)),
  })).filter((s) => s.rows.length > 0);
}

/** Reads an uploaded Excel, CSV or PDF into plain rows. Nothing is saved here. */
export const POST = withApi(async (req) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "Choose a file to upload");
  if (file.size > MAX_BYTES) throw new HttpError(413, "File is too large. Keep it under 4 MB.");

  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  let sheets: Sheet[];
  try {
    if (name.endsWith(".pdf")) sheets = await pdfSheets(buf);
    else if (name.endsWith(".csv") || name.endsWith(".txt")) sheets = [{ name: "File", rows: parseCsv(buf.toString("utf8")) }];
    else if (/\.(xlsx|xlsm|xls|ods)$/.test(name)) sheets = excelSheets(buf);
    else throw new HttpError(400, "Use an Excel (.xlsx or .xls), CSV or PDF file");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error(e);
    throw new HttpError(422, "Could not read this file. If it is a scanned PDF (a photo), save it as Excel or CSV instead.");
  }

  const total = sheets.reduce((n, s) => n + s.rows.length, 0);
  if (total > MAX_ROWS) throw new HttpError(413, `Too many rows (${total}). Split the file into smaller parts.`);
  return NextResponse.json({ sheets });
});
