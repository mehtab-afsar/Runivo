/** Codes from CSV text: first column of each line, header "code" skipped, de-duplicated. */
export function parseCodes(csv: string): string[] {
  const seen = new Set<string>();
  for (const line of csv.split(/\r?\n/)) {
    const first = line.split(/[,;\t]/)[0]?.replace(/^"|"$/g, '').trim();
    if (!first || /^code$/i.test(first)) continue;
    if (first.length > 80) continue;
    seen.add(first);
  }
  return [...seen];
}
