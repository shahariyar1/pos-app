/** Rebuilds table rows from the positioned text pieces of a PDF page (no PDF library needed here). */
export type TextBox = { str: string; x: number; y: number; w: number; h: number };

export function rowsFromItems(items: TextBox[]): string[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  // 1. group pieces that sit on the same visual line (PDF y grows upwards, so sort top to bottom)
  const lines: TextBox[][] = [];
  for (const it of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].y - it.y) <= Math.max(2, it.h * 0.5)) line.push(it);
    else lines.push([it]);
  }

  // 2. on each line, a wide gap means a new cell; a small gap is just a space inside a cell
  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let cur = line[0].str;
      let end = line[0].x + line[0].w;
      for (let i = 1; i < line.length; i++) {
        const it = line[i];
        const gap = it.x - end;
        const h = Math.max(it.h, 1);
        if (gap > h * 0.5) {
          cells.push(cur.trim());
          cur = it.str;
        } else if (gap > h * 0.08 && !cur.endsWith(" ") && !it.str.startsWith(" ")) {
          cur += " " + it.str;
        } else {
          cur += it.str;
        }
        end = it.x + it.w;
      }
      cells.push(cur.trim());
      return cells.filter(Boolean);
    })
    .filter((r) => r.length > 0);
}
