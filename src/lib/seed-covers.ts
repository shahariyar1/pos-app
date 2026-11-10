import sheet1 from "@/data/covers.json";
import sheet2 from "@/data/covers2.json";
import { Counter } from "@/models/counter";
import { CoverGroup } from "@/models/cover-group";

type Group = { location: string; models: string[] };

/** Each sheet has its own flag, so a sheet added later still loads even if the first one was loaded long ago. */
const SHEETS: { flag: string; data: Group[] }[] = [
  { flag: "covers_seeded", data: sheet1 as Group[] },
  { flag: "covers_seeded_sheet2", data: sheet2 as Group[] },
];

/** Loads the cover sheets that ship with the project into MongoDB, once each. */
export async function seedCoversOnce() {
  for (const sheet of SHEETS) {
    const previous = await Counter.findOneAndUpdate({ _id: sheet.flag }, { $setOnInsert: { seq: 1 } }, { upsert: true });
    if (!previous) await CoverGroup.insertMany(sheet.data);
  }
}
