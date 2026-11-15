import { NextResponse } from "next/server";
import { withApi, HttpError } from "@/lib/api-handler";
import { parseCsv } from "@/lib/import-parse";
import { CoverGroup } from "@/models/cover-group";

const DEFAULT_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7ahdBUeAviIyCwYqevPcDYJckr6cKPS8GqJZlbC1kXZCGr2pfPGajVpO4pmZgrE_in2FoC7lhT1hj/pub?gid=1161836224&single=true&output=csv";

type Pair = { location: string; model: string };

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const pairKey = (p: Pair) => `${p.location.toUpperCase()}| ${clean(p.model).toLocaleLowerCase()}`;

async function readSheet(): Promise<{ pairs: Pair[]; groups: { location: string; models: string[] }[] }> {
  const url = process.env.COVER_SHEET_CSV_URL || DEFAULT_SHEET_CSV_URL;
  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new HttpError(502, "Could not connect to the published Google Sheet. Check that the sheet is published as CSV.");
  }
  if (!response.ok) throw new HttpError(502, `Google Sheets returned HTTP ${response.status}`);

  const rows = parseCsv(await response.text());
  const byLocation = new Map<string, string[]>();
  const seen = new Set<string>();
  let invalidRows = 0;

  for (const raw of rows) {
    const cells = raw.map(clean).filter(Boolean);
    if (!cells.length) continue;
    if (cells.length >= 2 && /^(location|shelf|rack)$/i.test(cells[cells.length - 1])) continue;

    let location = "";
    let modelCells = cells;
    const last = cells[cells.length - 1];
    if (cells.length > 1 && /^[A-Za-z]{1,2}\d{0,2}$/.test(last)) {
      location = last.toUpperCase();
      modelCells = cells.slice(0, -1);
    } else if (cells.length === 1) {
      const match = last.match(/^(.*\S)\s+([A-Z]{1,2}\d{0,2})$/i);
      if (match) {
        location = match[2].toUpperCase();
        modelCells = [match[1]];
      }
    }

    const models = modelCells.join("/").split("/").map(clean).filter(Boolean);
    if (!location || !models.length) {
      invalidRows += 1;
      continue;
    }

    for (const model of models) {
      const pair = { location, model };
      const key = pairKey(pair);
      if (seen.has(key)) continue;
      seen.add(key);
      const list = byLocation.get(location) ?? [];
      list.push(model);
      byLocation.set(location, list);
    }
  }

  if (invalidRows > 0) {
    throw new HttpError(422, `The sheet has ${invalidRows} non-empty row(s) without a valid location. No data was changed; check the sheet format first.`);
  }
  if (!seen.size) throw new HttpError(422, "No cover models were found in the published sheet. No data was changed.");

  const groups = [...byLocation.entries()].map(([location, models]) => ({ location, models }));
  const pairs = groups.flatMap((g) => g.models.map((model) => ({ location: g.location, model })));
  return { pairs, groups };
}

async function currentPairs(): Promise<Pair[]> {
  const docs = await CoverGroup.find().select("location models").lean();
  const pairs: Pair[] = [];
  for (const doc of docs) {
    for (const model of doc.models ?? []) {
      pairs.push({ location: String(doc.location).toUpperCase(), model: clean(String(model)) });
    }
  }
  return pairs;
}

/** Preview the published Google Sheet against the current CoverGroup records. */
export const GET = withApi(async () => {
  const sheet = await readSheet();
  const current = await currentPairs();
  const sheetMap = new Map(sheet.pairs.map((p) => [pairKey(p), p]));
  const currentMap = new Map(current.map((p) => [pairKey(p), p]));
  const added = [...sheetMap].filter(([key]) => !currentMap.has(key)).map(([, p]) => p);
  const removed = [...currentMap].filter(([key]) => !sheetMap.has(key)).map(([, p]) => p);
  return NextResponse.json({
    locations: sheet.groups.length,
    sheetPairs: sheet.pairs.length,
    currentPairs: currentMap.size,
    unchangedPairs: sheet.pairs.length - added.length,
    addedCount: added.length,
    removedCount: removed.length,
    addedSamples: added.slice(0, 20),
    removedSamples: removed.slice(0, 20),
  });
});

/** Replace only the CoverGroup collection after an explicit preview confirmation. */
export const POST = withApi(async (req) => {
  const body = await req.json().catch(() => null);
  if (body?.confirm !== true) throw new HttpError(400, "Preview the changes and confirm before syncing.");

  // Re-read the live sheet at confirmation time; never trust a stale client preview.
  const sheet = await readSheet();
  await CoverGroup.deleteMany({});
  await CoverGroup.insertMany(sheet.groups);

  return NextResponse.json({
    syncedLocations: sheet.groups.length,
    syncedPairs: sheet.pairs.length,
  });
});
