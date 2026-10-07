import { inflateRawSync } from "node:zlib";

export type SheetGrid = {
  name: string;
  rows: Record<number, Record<string, string>>;
};

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function unzipXlsx(buffer: Buffer) {
  const marker = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (marker < 0) throw new Error("That file is not an Excel workbook.");
  const count = buffer.readUInt16LE(marker + 10);
  let cursor = buffer.readUInt32LE(marker + 16);
  const files = new Map<string, Buffer>();
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(start, start + compressedSize);
    files.set(name, method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function sharedStrings(xml: string) {
  const values: string[] = [];
  const pattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  for (const match of xml.matchAll(pattern)) {
    values.push(decodeXml([...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join("")));
  }
  return values;
}

export function parseSheetXml(xml: string, strings: string[] = []) {
  const rows: Record<number, Record<string, string>> = {};
  const pattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  for (const match of xml.matchAll(pattern)) {
    const attrs = match[1];
    const body = match[2] || "";
    const ref = /r="([A-Z]+)(\d+)"/.exec(attrs);
    if (!ref) continue;
    const type = /t="([^"]+)"/.exec(attrs)?.[1] || "";
    let value = "";
    if (type === "inlineStr") {
      value = decodeXml([...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join(""));
    } else {
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] || "";
      value = type === "s" ? strings[Number(raw)] || "" : decodeXml(raw);
    }
    if (!value) continue;
    const row = Number(ref[2]);
    rows[row] = rows[row] || {};
    rows[row][ref[1]] = value;
  }
  return rows;
}

export function readXlsxSheets(buffer: Buffer): SheetGrid[] {
  const files = unzipXlsx(buffer);
  const workbook = files.get("xl/workbook.xml")?.toString("utf8");
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
  if (!workbook || !rels) throw new Error("That file is not an Excel workbook.");
  const strings = sharedStrings(files.get("xl/sharedStrings.xml")?.toString("utf8") || "");
  const targets = new Map<string, string>();
  for (const match of rels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    targets.set(match[1], match[2].replace(/^\//, "").replace(/^xl\//, ""));
  }
  const sheets: SheetGrid[] = [];
  for (const match of workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/?>/g)) {
    const target = targets.get(match[2]);
    const xml = target ? files.get(`xl/${target}`)?.toString("utf8") : "";
    if (!xml) continue;
    sheets.push({ name: decodeXml(match[1]), rows: parseSheetXml(xml, strings) });
  }
  return sheets;
}
